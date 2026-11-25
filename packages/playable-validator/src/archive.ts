import { promises as fs } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { load as loadHtml } from 'cheerio';
import type {
  ArtifactEntry,
  InlineAssetBreakdownItem,
  LoadedArtifact,
  SizeBreakdown
} from './types.js';

const IGNORED_PATH_SEGMENTS = new Set(['__MACOSX', '.DS_Store', 'Thumbs.db']);

function normalizePosixPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '');
}

function shouldIgnoreEntry(posixPath: string): boolean {
  const parts = posixPath.split('/');
  return parts.some((part) => IGNORED_PATH_SEGMENTS.has(part) || part.startsWith('._'));
}

function categorizeExt(ext: string): string {
  switch (ext) {
    case '.html':
    case '.htm':
      return 'html';
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'js';
    case '.css':
      return 'css';
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.webp':
    case '.avif':
    case '.gif':
    case '.svg':
    case '.ico':
    case '.ktx':
    case '.pvr':
    case '.astc':
      return 'image';
    case '.mp3':
    case '.ogg':
    case '.wav':
    case '.m4a':
    case '.aac':
    case '.mp4':
    case '.webm':
      return 'media';
    case '.woff':
    case '.woff2':
    case '.ttf':
    case '.otf':
    case '.eot':
      return 'font';
    case '.wasm':
      return 'wasm';
    case '.json':
      return 'json';
    default:
      return 'other';
  }
}

async function collectDirectoryEntries(rootDir: string, currentDir = rootDir): Promise<ArtifactEntry[]> {
  const dirents = await fs.readdir(currentDir, { withFileTypes: true });
  const results: ArtifactEntry[] = [];

  for (const dirent of dirents) {
    const absPath = path.join(currentDir, dirent.name);
    const relPath = normalizePosixPath(path.relative(rootDir, absPath));
    if (shouldIgnoreEntry(relPath)) {
      continue;
    }

    if (dirent.isDirectory()) {
      const nested = await collectDirectoryEntries(rootDir, absPath);
      results.push(...nested);
    } else if (dirent.isFile()) {
      const content = await fs.readFile(absPath);
      results.push({
        path: relPath,
        bytes: content.byteLength,
        ext: path.extname(relPath).toLowerCase(),
        content
      });
    }
  }

  return results;
}

function detectNestedRootFolder(entries: ArtifactEntry[]): string | null {
  if (entries.length === 0) return null;
  const hasRootHtml = entries.some(
    (e) => !e.path.includes('/') && (e.ext === '.html' || e.ext === '.htm')
  );
  if (hasRootHtml) return null;

  const firstSegments = new Set(
    entries.filter((e) => e.path.includes('/')).map((e) => e.path.split('/')[0])
  );
  if (firstSegments.size !== 1) return null;

  const allInsideFolder = entries.every((e) => e.path.includes('/'));
  if (!allInsideFolder) return null;

  const [onlyFolder] = firstSegments;
  const hasNestedHtml = entries.some(
    (e) =>
      e.path.startsWith(`${onlyFolder}/`) &&
      e.path.split('/').length === 2 &&
      (e.ext === '.html' || e.ext === '.htm')
  );
  return hasNestedHtml ? onlyFolder : null;
}

function pickEntryHtml(entries: ArtifactEntry[], archiveBaseName: string): ArtifactEntry | null {
  const rootIndex = entries.find((e) => e.path.toLowerCase() === 'index.html');
  if (rootIndex) return rootIndex;

  const rootAd = entries.find((e) => e.path.toLowerCase() === 'ad.html');
  if (rootAd) return rootAd;

  // Mintegral convention: <name>/<name>.html
  const matchingMintegral = entries.find(
    (e) => e.path.toLowerCase() === `${archiveBaseName.toLowerCase()}/${archiveBaseName.toLowerCase()}.html`
  );
  if (matchingMintegral) return matchingMintegral;

  const nestedIndex = entries.find((e) => e.path.toLowerCase().endsWith('/index.html'));
  if (nestedIndex) return nestedIndex;

  const anyHtml = entries.find((e) => e.ext === '.html' || e.ext === '.htm');
  return anyHtml ?? null;
}

export async function loadArtifact(inputPath: string): Promise<LoadedArtifact> {
  const absPath = path.resolve(inputPath);
  const stat = await fs.stat(absPath);

  if (stat.isDirectory()) {
    const archiveBaseName = path.basename(absPath);
    const entries = await collectDirectoryEntries(absPath);
    const totalBytes = entries.reduce((sum, e) => sum + e.bytes, 0);
    const entryHtml = pickEntryHtml(entries, archiveBaseName);
    const nestedFolder = detectNestedRootFolder(entries);
    return {
      inputPath: absPath,
      archiveBaseName,
      format: 'directory',
      artifactBytes: totalBytes,
      entries,
      entryHtmlPath: entryHtml?.path ?? null,
      entryHtmlBytes: entryHtml?.bytes ?? 0,
      entryHtmlContent: entryHtml ? entryHtml.content.toString('utf-8') : null,
      hasNestedRootFolder: Boolean(nestedFolder),
      nestedRootFolderName: nestedFolder
    };
  }

  const ext = path.extname(absPath).toLowerCase();
  const archiveBaseName = path.basename(absPath, ext);
  const rawBuffer = await fs.readFile(absPath);

  if (ext === '.html' || ext === '.htm') {
    const fileName = path.basename(absPath);
    const entry: ArtifactEntry = {
      path: fileName,
      bytes: rawBuffer.byteLength,
      ext,
      content: rawBuffer
    };
    return {
      inputPath: absPath,
      archiveBaseName,
      format: 'single-html',
      artifactBytes: rawBuffer.byteLength,
      entries: [entry],
      entryHtmlPath: fileName,
      entryHtmlBytes: rawBuffer.byteLength,
      entryHtmlContent: rawBuffer.toString('utf-8'),
      hasNestedRootFolder: false,
      nestedRootFolderName: null
    };
  }

  if (ext === '.zip') {
    const zip = await JSZip.loadAsync(rawBuffer);
    const entries: ArtifactEntry[] = [];

    for (const [rawName, zipObj] of Object.entries(zip.files)) {
      if (zipObj.dir) continue;
      const posixPath = normalizePosixPath(rawName);
      if (shouldIgnoreEntry(posixPath)) continue;
      const content = await zipObj.async('nodebuffer');
      entries.push({
        path: posixPath,
        bytes: content.byteLength,
        ext: path.extname(posixPath).toLowerCase(),
        content
      });
    }

    const entryHtml = pickEntryHtml(entries, archiveBaseName);
    const nestedFolder = detectNestedRootFolder(entries);
    return {
      inputPath: absPath,
      archiveBaseName,
      format: 'zip',
      artifactBytes: rawBuffer.byteLength,
      entries,
      entryHtmlPath: entryHtml?.path ?? null,
      entryHtmlBytes: entryHtml?.bytes ?? 0,
      entryHtmlContent: entryHtml ? entryHtml.content.toString('utf-8') : null,
      hasNestedRootFolder: Boolean(nestedFolder),
      nestedRootFolderName: nestedFolder
    };
  }

  throw new Error(
    `Unsupported input "${inputPath}". Expected a .html file, a .zip archive, or a build directory.`
  );
}

const DATA_URI_REGEX = /data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=]{64,})/g;

function classifyMimeKind(mime: string): InlineAssetBreakdownItem['kind'] {
  const lower = mime.toLowerCase();
  if (lower.startsWith('image/')) return 'data-uri-image';
  if (lower.startsWith('audio/') || lower.startsWith('video/')) return 'data-uri-audio';
  if (lower.startsWith('font/') || lower.includes('font') || lower.includes('woff') || lower.includes('ttf')) {
    return 'data-uri-font';
  }
  return 'data-uri-other';
}

export function analyzeSizeBreakdown(artifact: LoadedArtifact, topN = 10): SizeBreakdown {
  const byCategory: Record<string, number> = {};
  const contributors: InlineAssetBreakdownItem[] = [];

  let uncompressedBytes = 0;
  let inlineBase64Bytes = 0;
  let estimatedBase64OverheadBytes = 0;

  for (const entry of artifact.entries) {
    uncompressedBytes += entry.bytes;
    const cat = categorizeExt(entry.ext);
    byCategory[cat] = (byCategory[cat] ?? 0) + entry.bytes;

    if (artifact.format !== 'single-html') {
      contributors.push({
        label: entry.path,
        kind: 'file',
        bytes: entry.bytes,
        sourcePath: entry.path
      });
    }

    const isTextCode = entry.ext === '.html' || entry.ext === '.htm' || entry.ext === '.js' || entry.ext === '.css';
    if (!isTextCode) continue;

    const text = entry.content.toString('utf-8');

    let match: RegExpExecArray | null;
    DATA_URI_REGEX.lastIndex = 0;
    let uriIndex = 0;
    while ((match = DATA_URI_REGEX.exec(text)) !== null) {
      uriIndex++;
      const mime = match[1];
      const payload = match[2];
      const encodedBytes = Buffer.byteLength(match[0], 'utf-8');
      const rawBytes = Math.floor((payload.length * 3) / 4);
      const overhead = Math.max(0, encodedBytes - rawBytes);

      inlineBase64Bytes += encodedBytes;
      estimatedBase64OverheadBytes += overhead;

      if (encodedBytes >= 4096) {
        contributors.push({
          label: `inline ${mime} #${uriIndex} (base64)`,
          kind: classifyMimeKind(mime),
          bytes: encodedBytes,
          estimatedRawBytes: rawBytes,
          sourcePath: entry.path
        });
      }
    }

    if (artifact.format === 'single-html' && (entry.ext === '.html' || entry.ext === '.htm')) {
      const $ = loadHtml(text);
      $('script').each((idx, el) => {
        const scriptBody = $(el).text();
        if (!scriptBody) return;
        const bytes = Buffer.byteLength(scriptBody, 'utf-8');
        if (bytes >= 2048) {
          const dataId = $(el).attr('data-id') || $(el).attr('id');
          contributors.push({
            label: dataId ? `<script data-id="${dataId}">` : `inline <script> #${idx + 1}`,
            kind: 'script',
            bytes,
            sourcePath: entry.path
          });
        }
      });
      $('style').each((idx, el) => {
        const styleBody = $(el).text();
        if (!styleBody) return;
        const bytes = Buffer.byteLength(styleBody, 'utf-8');
        if (bytes >= 2048) {
          contributors.push({
            label: `inline <style> #${idx + 1}`,
            kind: 'style',
            bytes,
            sourcePath: entry.path
          });
        }
      });
    }
  }

  if (contributors.length === 0 && artifact.entries.length > 0) {
    for (const entry of artifact.entries) {
      contributors.push({
        label: entry.path,
        kind: 'file',
        bytes: entry.bytes,
        sourcePath: entry.path
      });
    }
  }

  contributors.sort((a, b) => b.bytes - a.bytes);

  return {
    totalBytes: artifact.artifactBytes,
    uncompressedBytes,
    entryHtmlBytes: artifact.entryHtmlBytes,
    fileCount: artifact.entries.length,
    byCategory,
    topContributors: contributors.slice(0, topN),
    inlineBase64Bytes,
    estimatedBase64OverheadBytes
  };
}
