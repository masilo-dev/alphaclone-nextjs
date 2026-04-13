'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { X, SlidersHorizontal, RotateCw, Crop, Wand2, Scissors } from 'lucide-react';
import toast from 'react-hot-toast';

type SocialPreset = 'original' | 'square' | 'portrait' | 'landscape' | 'story';

const PRESET_LABELS: Record<SocialPreset, string> = {
  original: 'Original',
  square: 'Square 1:1',
  portrait: 'Portrait 4:5',
  landscape: 'Landscape 16:9',
  story: 'Story 9:16',
};

function targetRatio(preset: SocialPreset): number | null {
  switch (preset) {
    case 'square':
      return 1;
    case 'portrait':
      return 4 / 5;
    case 'landscape':
      return 16 / 9;
    case 'story':
      return 9 / 16;
    default:
      return null;
  }
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  if (parts.length !== 2) {
    throw new Error('Invalid data URL');
  }
  const header = parts[0];
  const base64 = parts[1];
  const mimeMatch = /data:(.*?);base64/.exec(header);
  const mime = mimeMatch?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes.buffer], { type: mime });
}

type Props = {
  file: File;
  onClose: () => void;
  onApply: (file: File, meta?: { coverFrameFile?: File; coverFrameTimePct?: number }) => void;
};

export default function MediaStudioModal({ file, onClose, onApply }: Props) {
  const objectUrl = useMemo(() => URL.createObjectURL(file), [file]);
  const isVideo = file.type.startsWith('video/');
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  const [preset, setPreset] = useState<SocialPreset>('original');
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [saving, setSaving] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [previewTimePct, setPreviewTimePct] = useState(0);
  const [coverTimePct, setCoverTimePct] = useState(0);
  const [coverFramePreview, setCoverFramePreview] = useState<string | null>(null);
  const [timelineFrames, setTimelineFrames] = useState<string[]>([]);
  const [ffmpegReady, setFfmpegReady] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [ffmpegProgress, setFfmpegProgress] = useState(0);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    if (!isVideo) return;
    let cancelled = false;

    const loadFfmpeg = async () => {
      setFfmpegLoading(true);
      try {
        const ffmpeg = new FFmpeg();
        ffmpegRef.current = ffmpeg;
        ffmpeg.on('progress', ({ progress }) => {
          if (!cancelled) setFfmpegProgress(Math.round(progress * 100));
        });

        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        if (!cancelled) setFfmpegReady(true);
      } catch (err) {
        console.error('[MediaStudio] FFmpeg load failed', err);
        toast.error('Video editor engine could not load in this browser');
      } finally {
        if (!cancelled) setFfmpegLoading(false);
      }
    };

    void loadFfmpeg();
    return () => {
      cancelled = true;
      ffmpegRef.current = null;
    };
  }, [isVideo]);

  async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
    return new Promise((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = Math.max(0, Math.min(time, (video.duration || time) - 0.01));
    });
  }

  async function captureFrameAt(video: HTMLVideoElement, timePct: number): Promise<string | null> {
    if (!video.videoWidth || !video.videoHeight || !video.duration) return null;
    const prev = video.currentTime;
    await seekVideo(video, (timePct / 100) * video.duration);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.75);
    await seekVideo(video, prev);
    return data;
  }

  const generateTimelineFrames = async () => {
    if (!isVideo || !videoPreviewRef.current) return;
    const video = videoPreviewRef.current;
    if (!video.duration) return;
    const points = [0, 20, 40, 60, 80, 100];
    const frames: string[] = [];
    for (const p of points) {
      const data = await captureFrameAt(video, p);
      if (data) frames.push(data);
    }
    setTimelineFrames(frames);
  };

  const updateCoverPreview = async (pct: number) => {
    if (!isVideo || !videoPreviewRef.current) return;
    const frame = await captureFrameAt(videoPreviewRef.current, pct);
    if (frame) setCoverFramePreview(frame);
  };

  const applyImageEdits = async () => {
    setSaving(true);
    try {
      const img = await loadImage(objectUrl);
      const baseW = img.naturalWidth;
      const baseH = img.naturalHeight;

      let srcX = 0;
      let srcY = 0;
      let srcW = baseW;
      let srcH = baseH;

      const ratio = targetRatio(preset);
      if (ratio) {
        const currentRatio = baseW / baseH;
        if (currentRatio > ratio) {
          srcW = Math.round(baseH * ratio);
          srcX = Math.round((baseW - srcW) / 2);
        } else if (currentRatio < ratio) {
          srcH = Math.round(baseW / ratio);
          srcY = Math.round((baseH - srcH) / 2);
        }
      }

      const rotate = ((rotation % 360) + 360) % 360;
      const swap = rotate === 90 || rotate === 270;
      const outW = swap ? srcH : srcW;
      const outH = swap ? srcW : srcH;

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');

      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate((rotate * Math.PI) / 180);
      ctx.drawImage(img, srcX, srcY, srcW, srcH, -srcW / 2, -srcH / 2, srcW, srcH);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      if (!blob) throw new Error('Could not export image');

      const edited = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '-edited.jpg', {
        type: 'image/jpeg',
      });
      onApply(edited);
      toast.success('Image edits applied');
      onClose();
    } catch (err) {
      console.error('[MediaStudio] image apply failed', err);
      toast.error('Could not apply image edits');
    } finally {
      setSaving(false);
    }
  };

  const applyVideoEdits = async () => {
    setSaving(true);
    try {
      const ffmpeg = ffmpegRef.current;
      if (!ffmpeg || !ffmpegReady) {
        toast.error('Video engine is still loading');
        return;
      }
      if (!videoDuration || !videoWidth || !videoHeight) {
        toast.error('Could not read video metadata');
        return;
      }

      const startSeconds = (trimStart / 100) * videoDuration;
      const endSeconds = (trimEnd / 100) * videoDuration;
      if (endSeconds <= startSeconds + 0.1) {
        toast.error('Trim range is too short');
        return;
      }

      const ratio = targetRatio(preset);
      let cropW = videoWidth;
      let cropH = videoHeight;
      let cropX = 0;
      let cropY = 0;
      if (ratio) {
        const currentRatio = videoWidth / videoHeight;
        if (currentRatio > ratio) {
          cropW = Math.floor(videoHeight * ratio);
          cropX = Math.floor((videoWidth - cropW) / 2);
        } else if (currentRatio < ratio) {
          cropH = Math.floor(videoWidth / ratio);
          cropY = Math.floor((videoHeight - cropH) / 2);
        }
      }

      const inputName = `input-${Date.now()}.mp4`;
      const outputName = `output-${Date.now()}.mp4`;
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      const filters: string[] = [];
      if (ratio) {
        filters.push(`crop=${cropW}:${cropH}:${cropX}:${cropY}`);
      }
      if (rotation % 360 !== 0) {
        const rotate = ((rotation % 360) + 360) % 360;
        if (rotate === 90) filters.push('transpose=1');
        if (rotate === 180) filters.push('transpose=1,transpose=1');
        if (rotate === 270) filters.push('transpose=2');
      }

      const args = [
        '-i', inputName,
        '-ss', startSeconds.toFixed(2),
        '-to', endSeconds.toFixed(2),
      ];

      if (filters.length > 0) {
        args.push('-vf', filters.join(','));
      }

      args.push(
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-c:a', 'aac',
        '-movflags', '+faststart',
        outputName
      );

      await ffmpeg.exec(args);
      const out = await ffmpeg.readFile(outputName);
      const bytes = new Uint8Array(out as Uint8Array);
      const blob = new Blob([bytes.buffer], { type: 'video/mp4' });
      const edited = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '-edited.mp4', { type: 'video/mp4' });
      let coverFile: File | undefined;
      if (coverFramePreview) {
        const coverBlob = dataUrlToBlob(coverFramePreview);
        coverFile = new File([coverBlob], file.name.replace(/\.[^/.]+$/, '') + '-cover.jpg', { type: 'image/jpeg' });
      }
      onApply(edited, { coverFrameFile: coverFile, coverFrameTimePct: coverTimePct });
      toast.success(`Video edited and exported (${Math.max(1, Math.round(endSeconds - startSeconds))}s)`);
      onClose();
    } catch (err) {
      console.error('[MediaStudio] video apply failed', err);
      toast.error('Could not render edited video');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Media Studio</h3>
            <p className="text-xs text-slate-400">Professional editing controls for non-technical users</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-[1fr_320px]">
          <div className="rounded-xl border border-slate-800 bg-black/30 p-4">
            <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-slate-800 bg-black/50 p-2">
            {isVideo ? (
              <video
                ref={videoPreviewRef}
                src={objectUrl}
                controls
                onLoadedMetadata={() => {
                  const el = videoPreviewRef.current;
                  if (!el) return;
                  setVideoDuration(el.duration || 0);
                  setVideoWidth(el.videoWidth || 0);
                  setVideoHeight(el.videoHeight || 0);
                  void generateTimelineFrames();
                  void updateCoverPreview(0);
                }}
                className="max-h-[60vh] w-full max-w-[960px] rounded-lg object-contain"
              />
            ) : (
              <img src={objectUrl} alt="Editor preview" className="max-h-[60vh] w-full max-w-[960px] rounded-lg object-contain" />
            )}
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <Crop className="h-4 w-4 text-blue-400" />
                Social Presets
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PRESET_LABELS) as SocialPreset[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPreset(p)}
                    className={`rounded-lg border px-2 py-1.5 text-xs ${
                      preset === p
                        ? 'border-blue-500 bg-blue-500/20 text-blue-200'
                        : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {PRESET_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            {isVideo ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Scissors className="h-4 w-4 text-violet-400" />
                    Timeline Trim
                  </div>
                  <label className="text-xs text-slate-400">Start ({trimStart}%)</label>
                  <input
                    type="range"
                    min={0}
                    max={95}
                    value={trimStart}
                    onChange={(e) => setTrimStart(Math.min(Number(e.target.value), trimEnd - 1))}
                    className="w-full"
                  />
                  <label className="text-xs text-slate-400">End ({trimEnd}%)</label>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    value={trimEnd}
                    onChange={(e) => setTrimEnd(Math.max(Number(e.target.value), trimStart + 1))}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Scissors className="h-4 w-4 text-blue-400" />
                    Timeline Preview
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={previewTimePct}
                    onChange={async (e) => {
                      const pct = Number(e.target.value);
                      setPreviewTimePct(pct);
                      const v = videoPreviewRef.current;
                      if (v?.duration) v.currentTime = (pct / 100) * v.duration;
                    }}
                    className="w-full"
                  />
                  {timelineFrames.length > 0 && (
                    <div className="grid grid-cols-6 gap-1">
                      {timelineFrames.map((f, idx) => (
                        <img key={`${idx}-${f.slice(0, 16)}`} src={f} alt="frame" className="h-10 w-full rounded object-cover" />
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-300">Cover frame ({coverTimePct}%)</label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={coverTimePct}
                    onChange={async (e) => {
                      const pct = Number(e.target.value);
                      setCoverTimePct(pct);
                      await updateCoverPreview(pct);
                    }}
                    className="w-full"
                  />
                  {coverFramePreview && (
                    <img src={coverFramePreview} alt="Video cover frame" className="h-28 w-full rounded border border-slate-700 object-cover" />
                  )}
                </div>
                <p className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-slate-300">
                  Duration: {videoDuration ? `${videoDuration.toFixed(1)}s` : '...'} | Resolution: {videoWidth || '?'}x{videoHeight || '?'}
                </p>
                {ffmpegLoading && (
                  <p className="rounded-lg border border-amber-700/40 bg-amber-500/10 p-2 text-xs text-amber-200">
                    Loading video engine... {ffmpegProgress}%
                  </p>
                )}
              </>
            ) : (
              <>
                <div>
                  <button
                    onClick={() => {
                      setBrightness(108);
                      setContrast(115);
                      setSaturation(112);
                      toast.success('Auto-enhance applied');
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs text-violet-200 hover:bg-violet-500/20"
                  >
                    <Wand2 className="h-4 w-4" />
                    Auto-enhance
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <SlidersHorizontal className="h-4 w-4 text-teal-400" />
                    Color Precision
                  </div>
                  <label className="text-xs text-slate-400">Brightness ({brightness}%)</label>
                  <input type="range" min={60} max={160} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full" />
                  <label className="text-xs text-slate-400">Contrast ({contrast}%)</label>
                  <input type="range" min={60} max={160} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full" />
                  <label className="text-xs text-slate-400">Saturation ({saturation}%)</label>
                  <input type="range" min={0} max={200} value={saturation} onChange={(e) => setSaturation(Number(e.target.value))} className="w-full" />
                </div>

                <div>
                  <button
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700"
                  >
                    <RotateCw className="h-4 w-4" />
                    Rotate 90 deg
                  </button>
                </div>
              </>
            )}

            <div className="border-t border-slate-800 pt-3">
              <button
                onClick={isVideo ? applyVideoEdits : applyImageEdits}
                disabled={saving}
                className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {saving ? 'Applying...' : 'Apply In Media Studio'}
              </button>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
                <Wand2 className="h-3.5 w-3.5" />
                Presets are tuned for Facebook reach and quality.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

