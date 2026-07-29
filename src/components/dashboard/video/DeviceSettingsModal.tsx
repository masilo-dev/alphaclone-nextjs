import React, { useState, useEffect } from 'react';
import { X, Mic, Video as VideoIcon, Volume2, Check, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

interface DeviceSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    setAudioDevice: (deviceId: string) => Promise<void>;
    setVideoDevice: (deviceId: string) => Promise<void>;
}

export const DeviceSettingsModal: React.FC<DeviceSettingsModalProps> = ({
    isOpen,
    onClose,
    setAudioDevice,
    setVideoDevice,
}) => {
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [activeAudioId, setActiveAudioId] = useState<string>('');
    const [activeVideoId, setActiveVideoId] = useState<string>('');

    useEffect(() => {
        if (!isOpen) return;

        const loadDevices = async () => {
            try {
                // Request permissions first to ensure we get labels
                await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                const allDevices = await navigator.mediaDevices.enumerateDevices();
                setDevices(allDevices);
                
                // Set initial active devices based on current tracks if possible
                // For now, default to the first available if none selected
                const audios = allDevices.filter(d => d.kind === 'audioinput');
                const videos = allDevices.filter(d => d.kind === 'videoinput');
                
                if (audios.length > 0 && !activeAudioId) setActiveAudioId(audios[0].deviceId);
                if (videos.length > 0 && !activeVideoId) setActiveVideoId(videos[0].deviceId);
            } catch (err) {
                console.error('Error loading devices:', err);
                toast.error('Could not access devices. Please check permissions.');
            }
        };

        loadDevices();
    }, [isOpen]);

    if (!isOpen) return null;

    const audioDevices = devices.filter(d => d.kind === 'audioinput');
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    const outputDevices = devices.filter(d => d.kind === 'audiooutput'); // Optional, Daily supports output switching but not exposed yet

    const handleSelectAudio = async (deviceId: string) => {
        try {
            await setAudioDevice(deviceId);
            setActiveAudioId(deviceId);
            toast.success('Microphone changed');
        } catch (err) {
            toast.error('Failed to change microphone');
        }
    };

    const handleSelectVideo = async (deviceId: string) => {
        try {
            await setVideoDevice(deviceId);
            setActiveVideoId(deviceId);
            toast.success('Camera changed');
        } catch (err) {
            toast.error('Failed to change camera');
        }
    };

    return (
<<<<<<< HEAD
        <div className="fixed inset-0 z-[1110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
=======
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
>>>>>>> origin/main
            <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/50">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Settings className="w-5 h-5 text-slate-400" />
                        Device Settings
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                    {/* Camera */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                            <VideoIcon className="w-4 h-4 text-teal-400" />
                            Camera
                        </label>
                        {videoDevices.length === 0 ? (
                            <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-sm text-slate-400">
                                No cameras found or permission denied
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {videoDevices.map(device => (
                                    <button
                                        key={device.deviceId}
                                        onClick={() => handleSelectVideo(device.deviceId)}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                                            activeVideoId === device.deviceId
                                                ? 'bg-teal-500/10 border-teal-500/50 text-teal-100'
                                                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                                        }`}
                                    >
                                        <span className="text-sm truncate pr-2">{device.label || 'Unknown Camera'}</span>
                                        {activeVideoId === device.deviceId && <Check className="w-4 h-4 text-teal-400 flex-shrink-0" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Microphone */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                            <Mic className="w-4 h-4 text-amber-400" />
                            Microphone
                        </label>
                        {audioDevices.length === 0 ? (
                            <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-sm text-slate-400">
                                No microphones found or permission denied
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {audioDevices.map(device => (
                                    <button
                                        key={device.deviceId}
                                        onClick={() => handleSelectAudio(device.deviceId)}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                                            activeAudioId === device.deviceId
                                                ? 'bg-amber-500/10 border-amber-500/50 text-amber-100'
                                                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                                        }`}
                                    >
                                        <span className="text-sm truncate pr-2">{device.label || 'Unknown Microphone'}</span>
                                        {activeAudioId === device.deviceId && <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-white/10 bg-slate-900/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors text-sm"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
