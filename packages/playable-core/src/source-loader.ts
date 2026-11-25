import { promises as fs } from 'node:fs';
import path from 'node:path';
import { resolveEngineAdapter } from './adapters/registry.js';
import type { EngineAdapter } from './adapters/types.js';
import type { LoadedSource, VirtualFile } from './types.js';

const IGNORED = new Set(['.DS_Store', 'Thumbs.db', '__MACOSX']);

function toPosix(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '');
}

async function readDirFiles(rootDir: string, curDir = rootDir): Promise<VirtualFile[]> {
  const dirents = await fs.readdir(curDir, { withFileTypes: true });
  const files: VirtualFile[] = [];

  for (const d of dirents) {
    if (IGNORED.has(d.name) || d.name.startsWith('._')) continue;
    const abs = path.join(curDir, d.name);
    if (d.isDirectory()) {
      files.push(...(await readDirFiles(rootDir, abs)));
    } else if (d.isFile()) {
      const rel = toPosix(path.relative(rootDir, abs));
      const content = await fs.readFile(abs);
      files.push({
        path: rel,
        ext: path.extname(rel).toLowerCase(),
        content
      });
    }
  }
  return files;
}

export async function loadSource(
  inputPath: string,
  options: { engine?: string; adapters?: EngineAdapter[] } = {}
): Promise<LoadedSource> {
  const absPath = path.resolve(inputPath);
  const stat = await fs.stat(absPath);

  let files: VirtualFile[];
  if (stat.isDirectory()) {
    files = await readDirFiles(absPath);
  } else if (stat.isFile()) {
    const ext = path.extname(absPath).toLowerCase();
    if (ext !== '.html' && ext !== '.htm') {
      throw new Error(`Unsupported source file "${inputPath}". Provide a build directory or an .html file.`);
    }
    const content = await fs.readFile(absPath);
    files = [{ path: 'index.html', ext: '.html', content }];
  } else {
    throw new Error(`Unsupported source path "${inputPath}".`);
  }

  const entry =
    files.find((f) => f.path.toLowerCase() === 'index.html') ||
    files.find((f) => f.ext === '.html' || f.ext === '.htm');

  if (!entry) {
    throw new Error(`No entry HTML file (index.html) found in "${absPath}".`);
  }

  const adapter = resolveEngineAdapter(files, options.engine, options.adapters);

  return {
    inputPath: absPath,
    engineId: adapter.id,
    adapter,
    entryHtmlPath: entry.path,
    files
  };
}
