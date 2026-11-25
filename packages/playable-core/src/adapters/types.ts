import type { CheerioAPI } from 'cheerio';
import type { VirtualFile } from '../types.js';
import type { PayloadEncoding } from '../vfs/payload.js';

export interface AdapterTransformContext {
  /** Parsed cheerio DOM of the entry HTML */
  $: CheerioAPI;
  /** Entry HTML relative POSIX path */
  entryHtmlPath: string;
  /** Filtered map of all files (excluding .map/.gz/.br/.zip) */
  fileMap: Map<string, VirtualFile>;
  /** Enable pako deflate compression when beneficial */
  compress?: boolean;
  /** Binary payload encoding for compressed VFS ('base64' | 'base122' | 'auto') */
  encoding?: PayloadEncoding;
  /** Adapter-specific extra options */
  adapterOptions?: Record<string, unknown>;
}

export interface EngineAdapter {
  /** Unique engine adapter identifier, e.g. 'generic-web', 'playcanvas', 'cocos-3x' */
  readonly id: string;
  readonly displayName: string;
  /**
   * When true, ZIP channels (Google/Meta/TikTok/Liftoff) prefer the slim-ZIP layout
   * (lightweight index.html + externalized js/playable-N.js) to stay under file-count,
   * extension-whitelist, and entry-HTML-size limits.
   */
  readonly preferSlimZip?: boolean;
  /** Return true if this adapter recognizes the given build files */
  detect(files: VirtualFile[]): boolean;
  /** Transform the entry HTML and files into a self-contained single HTML string */
  transformSingleHtml(ctx: AdapterTransformContext): string;
}
