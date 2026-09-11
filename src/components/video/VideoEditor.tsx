'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { 
    Scissors, 
    Play, 
    Pause, 
    Download, 
    Loader2, 
    CheckCircle2, 
    AlertCircle,
    RotateCcw,
    X,
    Maximize2
} from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';
import toast from 'react-hot-toast';

interface VideoEditorProps {
    source: File | string; // File object or URL
    onSave: (editedVideo: Blob) => void;
    onCancel: () => void;
}

export default function VideoEditor({ source, onSave, onCancel }: VideoEditorProps) {
    const [loaded, setLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    
    const ffmpegRef = useRef(new FFmpeg());
    const videoRef = useRef<HTMLVideoElement>(null);
    
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        loadFFmpeg();
    }, []);

    const loadFFmpeg = async () => {
        setIsLoading(true);
        try {
            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
            const ffmpeg = ffmpegRef.current;
            
            ffmpeg.on('log', ({ message }) => {
                console.log('FFmpeg Log:', message);
            });

            ffmpeg.on('progress', ({ progress }) => {
                setProgress(Math.round(progress * 100));
            });

            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            });
            
            setLoaded(true);
        } catch (err: any) {
            console.error('Failed to load FFmpeg:', err);
            setError('Browser does not support multithreading / SharedArrayBuffer. Enable COOP/COEP.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            const d = videoRef.current.duration;
            setDuration(d);
            setEndTime(d);
        }
    };

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleProcess = async () => {
        if (!loaded || isProcessing) return;

        setIsProcessing(true);
        setProgress(0);
        
        try {
            const ffmpeg = ffmpegRef.current;
            const inputName = 'input.mp4';
            const outputName = 'output.mp4';

            // Write the file to FFmpeg's virtual file system
            await ffmpeg.writeFile(inputName, await fetchFile(source));

            // Run the trim command
            // -ss : start time, -to : end time (or -t for duration)
            await ffmpeg.exec([
                '-i', inputName,
                '-ss', startTime.toString(),
                '-to', endTime.toString(),
                '-c', 'copy', // Fast copy without re-encoding if possible
                outputName
            ]);

            // Read the result
            const data = await ffmpeg.readFile(outputName);
            const blob = new Blob([data as any], { type: 'video/mp4' });
            
            onSave(blob);
            toast.success('Video processed successfully!');
        } catch (err: any) {
            console.error('Video processing error:', err);
            toast.error('Failed to trim video.');
        } finally {
            setIsProcessing(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 bg-slate-950/80 rounded-3xl border border-white/5 backdrop-blur-xl">
                <Loader2 className="w-12 h-12 text-teal-400 animate-spin mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Initializing Cloud Engine</h3>
                <p className="text-slate-400 text-center max-w-xs">Loading open-source video processing modules into your browser.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 bg-rose-500/10 border border-rose-500/20 rounded-3xl text-center">
                <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Requirement Error</h3>
                <p className="text-slate-400 mb-6">{error}</p>
                <Button onClick={onCancel} variant="outline" className="border-slate-800 text-white">Go Back</Button>
            </div>
        );
    }

    const videoUrl = typeof source === 'string' ? source : URL.createObjectURL(source);

    return (
        <div className="flex flex-col h-full bg-slate-900 rounded-3xl border border-white/10 shadow-2xl overflow-hidden max-h-[90vh]">
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-slate-950/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
                        <Scissors className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-white">Video Studio</h2>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-black">Open-Source Engine</p>
                    </div>
                </div>
                <button onClick={onCancel} className="p-2 hover:bg-white/5 rounded-full text-slate-400 transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Video Viewport */}
            <div className="flex-1 bg-black relative flex items-center justify-center min-h-0">
                <video
                    ref={videoRef}
                    src={videoUrl}
                    className="max-h-full max-w-full"
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={() => {
                        if (videoRef.current && videoRef.current.currentTime >= endTime) {
                            videoRef.current.pause();
                            setIsPlaying(false);
                            videoRef.current.currentTime = startTime;
                        }
                    }}
                />
            </div>

            {/* Controls */}
            <div className="p-6 bg-slate-950/80 border-t border-white/5 space-y-6">
                {/* Timeline Sliders */}
                <div className="space-y-4">
                    <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <span>Timeline Control</span>
                        <span className="text-teal-400">{formatTime(startTime)} - {formatTime(endTime)}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400">START POINT</label>
                            <input 
                                type="range" 
                                min={0} 
                                max={duration} 
                                step={0.1}
                                value={startTime}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setStartTime(Math.min(val, endTime - 0.1));
                                    if (videoRef.current) videoRef.current.currentTime = val;
                                }}
                                className="w-full accent-teal-500 h-1bg-slate-800 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400">END POINT</label>
                            <input 
                                type="range" 
                                min={0} 
                                max={duration} 
                                step={0.1}
                                value={endTime}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setEndTime(Math.max(val, startTime + 0.1));
                                    if (videoRef.current) videoRef.current.currentTime = val;
                                }}
                                className="w-full accent-teal-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="primary" 
                            onClick={togglePlay}
                            className="w-12 h-12 rounded-full p-0 flex items-center justify-center bg-white/10 hover:bg-white/20 border-white/5"
                        >
                            {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white translate-x-0.5" />}
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => {
                                if (videoRef.current) videoRef.current.currentTime = startTime;
                            }}
                            className="w-12 h-12 rounded-full p-0 flex items-center justify-center border-slate-800 text-slate-400 hover:text-white"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="flex-1">
                        {isProcessing ? (
                            <div className="bg-slate-900 border border-teal-500/30 rounded-2xl p-3 flex items-center gap-4">
                                <Loader2 className="w-4 h-4 text-teal-400 animate-spin shrink-0" />
                                <div className="flex-1">
                                    <div className="flex justify-between text-xs text-slate-400 mb-1 font-bold">
                                        <span>PROCESSING VIDEO</span>
                                        <span>{progress}%</span>
                                    </div>
                                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-teal-500 transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <Button 
                                onClick={handleProcess}
                                className="w-full py-6 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-sm uppercase tracking-widest shadow-[0_20px_40px_-10px_rgba(20,184,166,0.3)] rounded-2xl"
                            >
                                <Scissors className="w-4 h-4 mr-2" />
                                Render Edits
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

