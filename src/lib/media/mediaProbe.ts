import 'server-only';

import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);

export type MediaTechnicalMetadata = {
  byte_size: number; checksum_sha256: string; mime_type: string;
  width: number | null; height: number | null; duration_seconds: number | null;
  video_codec: string | null; frame_rate: number | null; bitrate: number | null;
  audio_codec: string | null; fully_decoded: boolean;
};

function parseRate(value?: string): number | null {
  if (!value) return null;
  const [a, b = 1] = value.split('/').map(Number);
  return Number.isFinite(a / b) && b !== 0 ? a / b : null;
}

export async function probeMediaBytes(buffer: Buffer, mimeType: string): Promise<MediaTechnicalMetadata> {
  const base = {
    byte_size: buffer.length,
    checksum_sha256: createHash('sha256').update(buffer).digest('hex'),
    mime_type: mimeType,
  };
  if (mimeType.startsWith('image/')) {
    const metadata = await sharp(buffer, { failOn: 'error', limitInputPixels: 80_000_000 }).metadata();
    if (!metadata.width || !metadata.height) throw new Error('MEDIA_DECODE_FAILED: missing image dimensions');
    await sharp(buffer, { failOn: 'error', limitInputPixels: 80_000_000 }).raw().toBuffer();
    return { ...base, width: metadata.width, height: metadata.height, duration_seconds: null,
      video_codec: null, frame_rate: null, bitrate: null, audio_codec: null, fully_decoded: true };
  }
  if (!mimeType.startsWith('video/')) throw new Error('MEDIA_PROBE_UNSUPPORTED: only images and videos are supported');
  const dir = await mkdtemp(join(tmpdir(), 'alphaclone-probe-'));
  const path = join(dir, 'media');
  await writeFile(path, buffer);
  let parsed: any;
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path,
    ], { maxBuffer: 4 * 1024 * 1024, timeout: 30_000 });
    parsed = JSON.parse(stdout);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  const video = parsed.streams?.find((stream: any) => stream.codec_type === 'video');
  const audio = parsed.streams?.find((stream: any) => stream.codec_type === 'audio');
  if (!video?.width || !video?.height || !video?.codec_name) {
    throw new Error('MEDIA_DECODE_FAILED: ffprobe could not decode a video stream');
  }
  return {
    ...base, width: Number(video.width), height: Number(video.height),
    duration_seconds: Number(parsed.format?.duration || video.duration) || null,
    video_codec: String(video.codec_name), frame_rate: parseRate(video.avg_frame_rate || video.r_frame_rate),
    bitrate: Number(parsed.format?.bit_rate || video.bit_rate) || null,
    audio_codec: audio?.codec_name ? String(audio.codec_name) : null, fully_decoded: true,
  };
}
