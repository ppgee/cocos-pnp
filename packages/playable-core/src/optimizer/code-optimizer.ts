import path from 'node:path';
import { load as loadHtml } from 'cheerio';
import type { VirtualFile } from '../types.js';

export const JS_EXTS = new Set(['.js', '.mjs', '.cjs']);

export interface CodeOptimizeOptions {
  /** Minify JS and CSS assets via esbuild (default: true) */
  minifyCode?: boolean;
  /** Bundle and tree-shake local <script type="module"> graphs via esbuild (default: true) */
  treeShakeModules?: boolean;
  /** Strip console.* calls during minification (default: false; enabled in aggressive/ultra budget tiers) */
  dropConsole?: boolean;
}

interface EsbuildModule {
  transform: (
    input: string,
    options?: Record<string, unknown>
  ) => Promise<{ code: string }>;
  build: (
    options: Record<string, unknown>
  ) => Promise<{ outputFiles?: Array<{ text: string; contents: Uint8Array }>; metafile?: { inputs: Record<string, unknown> } }>;
}

let esbuildCache: Promise<EsbuildModule | null> | null = null;

export function loadEsbuild(): Promise<EsbuildModule | null> {
  if (!esbuildCache) {
    const pkgName = 'esbuild';
    esbuildCache = import(pkgName)
      .then((mod: unknown) => {
        const m = mod as Partial<EsbuildModule> & { default?: Partial<EsbuildModule> };
        const api = (typeof m.transform === 'function' ? m : m.default) as EsbuildModule | undefined;
        return api && typeof api.transform === 'function' && typeof api.build === 'function' ? api : null;
      })
      .catch(() => null);
  }
  return esbuildCache;
}

function normalizePosix(p: string): string {
  return path.posix.normalize(p.replace(/\\/g, '/')).replace(/^\.\//, '');
}

function resolveVirtualModule(
  fileMap: Map<string, VirtualFile>,
  importer: string,
  specifier: string
): string | null {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    return null;
  }
  const baseDir = importer ? path.posix.dirname(importer) : '.';
  const raw = specifier.startsWith('/')
    ? specifier.replace(/^\/+/, '')
    : path.posix.join(baseDir, specifier);
  const normalized = normalizePosix(raw);

  const candidates = [
    normalized,
    `${normalized}.js`,
    `${normalized}.mjs`,
    `${normalized}.json`,
    `${normalized}/index.js`,
    `${normalized}/index.mjs`
  ];
  for (const cand of candidates) {
    if (fileMap.has(cand)) return cand;
  }
  return null;
}

export interface TreeShakeReportItem {
  path: string;
  originalBytes: number;
  optimizedBytes: number;
  savedBytes: number;
  applied: boolean;
  reason?: string;
}

/**
 * Traces local `<script type="module" src="...">` entry points referenced by HTML files,
 * bundles + tree-shakes dead exports/unused modules via esbuild in-memory, converts the
 * entry tag to a standard IIFE `<script src="...">` (compatible with strict AdWebViews),
 * and prunes orphaned dependency modules no longer referenced anywhere else.
 */
export async function treeShakeEsModules(
  files: VirtualFile[],
  esbuild: EsbuildModule,
  options: { dropConsole?: boolean; minSavingsBytes?: number } = {}
): Promise<{
  files: VirtualFile[];
  items: TreeShakeReportItem[];
  handledPaths: Set<string>;
}> {
  const fileMap = new Map<string, VirtualFile>();
  for (const f of files) {
    fileMap.set(f.path, f);
  }

  const items: TreeShakeReportItem[] = [];
  const handledPaths = new Set<string>();
  const entryUpdates = new Map<string, Buffer>();
  const htmlUpdates = new Map<string, Buffer>();
  const consumedDeps = new Set<string>();
  const bundledEntries = new Set<string>();

  const drop: string[] = options.dropConsole ? ['console', 'debugger'] : ['debugger'];

  for (const htmlFile of files) {
    if (htmlFile.ext !== '.html' && htmlFile.ext !== '.htm') continue;
    const htmlDir = path.posix.dirname(htmlFile.path);
    const $ = loadHtml(htmlFile.content.toString('utf-8'));
    let htmlChanged = false;

    const moduleScripts = $('script[type="module"][src]').toArray();
    for (const el of moduleScripts) {
      const src = ($(el).attr('src') || '').trim();
      if (!src || /^https?:\/\//i.test(src) || src.startsWith('data:')) continue;

      const resolvedEntry = normalizePosix(
        src.startsWith('/') ? src.replace(/^\/+/, '') : path.posix.join(htmlDir, src)
      );
      const entryFile = fileMap.get(resolvedEntry);
      if (!entryFile || !JS_EXTS.has(entryFile.ext)) continue;

      const visitedInputs = new Set<string>();

      try {
        const buildRes = await esbuild.build({
          entryPoints: [resolvedEntry],
          bundle: true,
          treeShaking: true,
          minify: true,
          format: 'iife',
          target: ['es2018'],
          legalComments: 'none',
          drop,
          write: false,
          metafile: true,
          plugins: [
            {
              name: 'playable-virtual-fs',
              setup(build: {
                onResolve: (
                  opts: { filter: RegExp },
                  cb: (args: { path: string; importer: string }) => unknown
                ) => void;
                onLoad: (
                  opts: { filter: RegExp; namespace: string },
                  cb: (args: { path: string }) => unknown
                ) => void;
              }) {
                build.onResolve({ filter: /.*/ }, (args) => {
                  if (!args.importer) {
                    return { path: normalizePosix(args.path), namespace: 'vfs' };
                  }
                  const target = resolveVirtualModule(fileMap, args.importer, args.path);
                  if (target) {
                    return { path: target, namespace: 'vfs' };
                  }
                  // Keep unresolved external specifiers untouched (do not fail build)
                  return { path: args.path, external: true };
                });

                build.onLoad({ filter: /.*/, namespace: 'vfs' }, (args) => {
                  const hit = fileMap.get(args.path);
                  if (!hit) return null;
                  visitedInputs.add(hit.path);
                  const loader = hit.ext === '.json' ? 'json' : 'js';
                  return {
                    contents: hit.content.toString('utf-8'),
                    loader
                  };
                });
              }
            }
          ]
        });

        const outFile = buildRes.outputFiles?.[0];
        if (!outFile) continue;

        const outBuf = Buffer.from(outFile.contents);
        let graphOrigBytes = 0;
        for (const p of visitedInputs) {
          graphOrigBytes += fileMap.get(p)?.content.byteLength ?? 0;
        }

        const minSave = options.minSavingsBytes ?? 64;
        const totalSaved = graphOrigBytes - outBuf.byteLength;
        if (visitedInputs.size > 1 || totalSaved >= minSave) {
          entryUpdates.set(resolvedEntry, outBuf);
          bundledEntries.add(resolvedEntry);
          handledPaths.add(resolvedEntry);

          for (const dep of visitedInputs) {
            if (dep !== resolvedEntry) {
              consumedDeps.add(dep);
            }
          }

          // Convert `<script type="module">` to classic `<script>` since bundle is IIFE
          $(el).removeAttr('type');
          htmlChanged = true;

          items.push({
            path: resolvedEntry,
            originalBytes: entryFile.content.byteLength,
            optimizedBytes: outBuf.byteLength,
            savedBytes: entryFile.content.byteLength - outBuf.byteLength,
            applied: true,
            reason:
              visitedInputs.size > 1
                ? `Tree-shaken & bundled ${visitedInputs.size} ES module(s) into IIFE`
                : 'Minified ES module into IIFE'
          });
        }
      } catch {
        // Non-fatal: leave module untouched if dynamic/unusual syntax prevents bundling
      }
    }

    if (htmlChanged) {
      htmlUpdates.set(htmlFile.path, Buffer.from($.html(), 'utf-8'));
    }
  }

  if (bundledEntries.size === 0) {
    return { files, items, handledPaths };
  }

  // Only prune consumed dependency files if they are not referenced by any remaining non-bundled file
  const remainingRefCorpus = files
    .filter((f) => !consumedDeps.has(f.path) && !bundledEntries.has(f.path))
    .map((f) => (htmlUpdates.get(f.path) ?? f.content).toString('utf-8'))
    .join('\n');

  const prunedDeps = new Set<string>();
  for (const dep of consumedDeps) {
    const baseName = path.posix.basename(dep);
    if (!remainingRefCorpus.includes(dep) && !remainingRefCorpus.includes(baseName)) {
      prunedDeps.add(dep);
      handledPaths.add(dep);
      const orig = fileMap.get(dep)?.content.byteLength ?? 0;
      items.push({
        path: dep,
        originalBytes: orig,
        optimizedBytes: 0,
        savedBytes: orig,
        applied: true,
        reason: 'Pruned after ES module tree-shaking & bundling'
      });
    }
  }

  const nextFiles: VirtualFile[] = [];
  for (const f of files) {
    if (prunedDeps.has(f.path)) continue;
    const updatedHtml = htmlUpdates.get(f.path);
    if (updatedHtml) {
      nextFiles.push({ ...f, content: updatedHtml });
      continue;
    }
    const updatedEntry = entryUpdates.get(f.path);
    if (updatedEntry) {
      nextFiles.push({ ...f, content: updatedEntry });
      continue;
    }
    nextFiles.push(f);
  }

  return { files: nextFiles, items, handledPaths };
}

/**
 * Minifies a standalone JS or CSS buffer via esbuild.
 */
export async function minifyCodeBuffer(
  content: Buffer,
  ext: string,
  esbuild: EsbuildModule,
  options: { dropConsole?: boolean } = {}
): Promise<Buffer> {
  const loader = ext === '.css' ? 'css' : 'js';
  const drop: string[] =
    loader === 'js'
      ? options.dropConsole
        ? ['console', 'debugger']
        : ['debugger']
      : [];

  const res = await esbuild.transform(content.toString('utf-8'), {
    loader,
    minify: true,
    legalComments: 'none',
    ...(loader === 'js' ? { target: 'es2018', drop } : {})
  });

  return Buffer.from(res.code, 'utf-8');
}
