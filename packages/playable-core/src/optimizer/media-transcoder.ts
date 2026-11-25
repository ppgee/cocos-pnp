import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac']);
export const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm']);

export interface MediaTranscodeOptions {
  ffmpegPath?: string;
  /** Audio bitrate in kbps for lossy formats (default: 64) */
  audioBitrateKbps?: number;
  /** Audio sample rate in Hz (default: 24000) */
  audioSampleRate?: number;
  /** Audio channel count: 1=mono (default), 2=stereo */
  audioChannels?: 1 | 2;
  /** H.264/VP8 CRF quality factor (higher = smaller; default: 28) */
  videoCrf?: number;
  /** Max video width in pixels; preserves aspect ratio with even dimensions (default: 720) */
  videoMaxWidth?: number;
  /** Target video FPS cap (default: 24) */
  videoFps?: number;
  /** Audio bitrate for video audio tracks in kbps (default: 48) */
  videoAudioBitrateKbps?: number;
  /** Strip audio track completely from videos (default: false) */
  stripVideoAudio?: boolean;
}

const ffmpegProbeCache = new Map<string, Promise<string | null>>();

/**
 * Detects whether a usable `ffmpeg` binary is available on the local machine.
 * Cached per binary path to avoid repeated spawn overhead.
 */
export function detectFfmpegBinary(explicitPath?: string): Promise<string | null> {
  const candidate = explicitPath || process.env.FFMPEG_PATH || 'ffmpeg';
  const cached = ffmpegProbeCache.get(candidate);
  if (cached) return cached;

  const probe = execFileAsync(candidate, ['-version'], { timeout: 5000 })
    .then(() => candidate)
    .catch(() => null);

  ffmpegProbeCache.set(candidate, probe);
  return probe;
}

function nearestOpusSampleRate(hz: number): number {
  const supported = [8000, 12000, 16000, 24000, 48000];
  let best = supported[0];
  let bestDiff = Math.abs(hz - best);
  for (const rate of supported) {
    const diff = Math.abs(hz - rate);
    if (diff < bestDiff) {
      best = rate;
      bestDiff = diff;
    }
  }
  return best;
}

function buildAudioArgs(ext: string, inPath: string, outPath: string, opts: MediaTranscodeOptions): string[] {
  const bitrate = Math.max(16, Math.min(320, Math.round(opts.audioBitrateKbps ?? 64)));
  const sampleRate = Math.max(8000, Math.min(48000, Math.round(opts.audioSampleRate ?? 24000)));
  const channels = opts.audioChannels === 2 ? 2 : 1;

  const base = ['-y', '-v', 'error', '-i', inPath, '-vn', '-map_metadata', '-1'];

  if (ext === '.mp3') {
    return [
      ...base,
      '-c:a', 'libmp3lame',
      '-b:a', `${bitrate}k`,
      '-ac', String(channels),
      '-ar', String(sampleRate),
      outPath
    ];
  }

  if (ext === '.m4a') {
    return [
      ...base,
      '-c:a', 'aac',
      '-b:a', `${bitrate}k`,
      '-ac', String(channels),
      '-ar', String(sampleRate),
      '-movflags', '+faststart',
      outPath
    ];
  }

  if (ext === '.aac') {
    return [
      ...base,
      '-c:a', 'aac',
      '-b:a', `${bitrate}k`,
      '-ac', String(channels),
      '-ar', String(sampleRate),
      '-f', 'adts',
      outPath
    ];
  }

  if (ext === '.ogg') {
    return [
      ...base,
      '-c:a', 'libopus',
      '-b:a', `${bitrate}k`,
      '-ac', String(channels),
      '-ar', String(nearestOpusSampleRate(sampleRate)),
      outPath
    ];
  }

  // .wav -> mono downsampled 16-bit PCM (universally supported by Web Audio & HTMLAudioElement)
  return [
    ...base,
    '-c:a', 'pcm_s16le',
    '-ac', String(channels),
    '-ar', String(sampleRate),
    outPath
  ];
}

function buildVideoArgs(ext: string, inPath: string, outPath: string, opts: MediaTranscodeOptions): string[] {
  const crf = Math.max(18, Math.min(42, Math.round(opts.videoCrf ?? 28)));
  const maxWidth = Math.max(160, Math.min(1920, Math.round(opts.videoMaxWidth ?? 720)));
  const fps = Math.max(8, Math.min(60, Math.round(opts.videoFps ?? 24)));
  const audioBitrate = Math.max(16, Math.min(192, Math.round(opts.videoAudioBitrateKbps ?? 48)));
  const stripAudio = Boolean(opts.stripVideoAudio);

  // Preserve aspect ratio, never upscale, force even width/height for yuv420p compatibility
  const vf = `scale='trunc(min(${maxWidth},iw)/2)*2':-2`;
  const base = ['-y', '-v', 'error', '-i', inPath, '-map_metadata', '-1', '-vf', vf, '-r', String(fps)];

  if (ext === '.webm') {
    const audioArgs = stripAudio
      ? ['-an']
      : ['-c:a', 'libopus', '-b:a', `${audioBitrate}k`, '-ac', '1', '-ar', '24000'];
    return [
      ...base,
      '-c:v', 'libvpx',
      '-crf', String(crf),
      '-b:v', '800k',
      '-pix_fmt', 'yuv420p',
      ...audioArgs,
      outPath
    ];
  }

  // .mp4 / .mov -> Baseline H.264 + yuv420p + faststart moov atom (Liftoff & iOS/Android AdWebView compliant)
  const audioArgs = stripAudio
    ? ['-an']
    : ['-c:a', 'aac', '-b:a', `${audioBitrate}k`, '-ac', '1', '-ar', '24000'];
  return [
    ...base,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-profile:v', 'baseline',
    '-level', '3.0',
    '-pix_fmt', 'yuv420p',
    '-crf', String(crf),
    '-movflags', '+faststart',
    ...audioArgs,
    outPath
  ];
}

/**
 * Transcodes an audio or video buffer in an isolated temp directory via local `ffmpeg`.
 * Preserves container/extension so engine manifests and URL references never break.
 */
export async function transcodeMediaBuffer(
  content: Buffer,
  ext: string,
  kind: 'audio' | 'video',
  ffmpegBin: string,
  options: MediaTranscodeOptions = {}
): Promise<Buffer> {
  const normalizedExt = ext.toLowerCase();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'playable-media-'));
  const inPath = path.join(tmpDir, `input${normalizedExt}`);
  const outPath = path.join(tmpDir, `output${normalizedExt}`);

  try {
    await fs.writeFile(inPath, content);
    const args =
      kind === 'audio'
        ? buildAudioArgs(normalizedExt, inPath, outPath, options)
        : buildVideoArgs(normalizedExt, inPath, outPath, options);

    await execFileAsync(ffmpegBin, args, {
      timeout: kind === 'video' ? 120_000 : 45_000,
      maxBuffer: 10 * 1024 * 1024
    });

    return await fs.readFile(outPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
