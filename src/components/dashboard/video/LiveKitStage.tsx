'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type LocalTrack, type RemoteTrack } from 'livekit-client';
import { Mic, MicOff, PhoneOff, Video as VideoIcon, VideoOff } from 'lucide-react';

type VideoTile = { key: string; track: LocalTrack | RemoteTrack; label: string };

export type LiveKitStageProps = {
    url: string;
    token: string;
    displayName: string;
    secondsElapsed: number;
    formatElapsed: (seconds: number) => string;
    requestHardStop: boolean;
    onHardStopConsumed: () => void;
    onLeave: () => void;
    onFatalError: (message: string) => void;
    /** Fired once the session is visually ready (video tiles) so the parent can hide any bridging UI. */
    onBridgeReady?: () => void;
};

function VideoTileView({ track, label }: { track: LocalTrack | RemoteTrack; label: string }) {
    const ref = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        track.attach(el);
        return () => {
            track.detach(el);
        };
    }, [track]);

    return (
        <div className="relative rounded-3xl overflow-hidden bg-slate-900 ring-1 ring-white/5 shadow-2xl min-h-[120px]">
            <video ref={ref} className="w-full h-full object-cover aspect-video bg-slate-950" playsInline autoPlay muted />
            <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                <span className="text-xs font-semibold text-white">{label}</span>
            </div>
        </div>
    );
}

export default function LiveKitStage({
    url,
    token,
    displayName,
    secondsElapsed,
    formatElapsed,
    requestHardStop,
    onHardStopConsumed,
    onLeave,
    onFatalError,
    onBridgeReady,
}: LiveKitStageProps) {
    const roomRef = useRef<Room | null>(null);
    const audioElementsRef = useRef<HTMLAudioElement[]>([]);
    const [tiles, setTiles] = useState<VideoTile[]>([]);
    const [micEnabled, setMicEnabled] = useState(true);
    const [camEnabled, setCamEnabled] = useState(true);
    const leavingRef = useRef(false);
    const bridgeOnceRef = useRef(false);
    const [showConnectionLayer, setShowConnectionLayer] = useState(true);

    const rebuildTiles = useCallback(
        (room: Room) => {
            const next: VideoTile[] = [];
            room.localParticipant.videoTrackPublications.forEach((pub) => {
                const t = pub.track;
                if (t && t.kind === Track.Kind.Video) {
                    next.push({ key: `local-${pub.trackSid}`, track: t, label: `${displayName} (You)` });
                }
            });
            room.remoteParticipants.forEach((p) => {
                p.videoTrackPublications.forEach((pub) => {
                    const t = pub.track;
                    if (pub.isSubscribed && t && t.kind === Track.Kind.Video) {
                        next.push({ key: `${p.identity}-${pub.trackSid}`, track: t, label: p.name || p.identity });
                    }
                });
            });
            setTiles(next);
        },
        [displayName]
    );

    const disconnect = useCallback(async () => {
        audioElementsRef.current.forEach((a) => {
            try {
                a.remove();
            } catch {
                /* ignore */
            }
        });
        audioElementsRef.current = [];
        const r = roomRef.current;
        roomRef.current = null;
        if (r) {
            try {
                await r.disconnect();
            } catch {
                /* ignore */
            }
        }
    }, []);

    useEffect(() => {
        bridgeOnceRef.current = false;
        setShowConnectionLayer(true);
        let cancelled = false;
        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        const onAny = () => {
            if (!cancelled) rebuildTiles(room);
        };

        const onSubscribed = (track: RemoteTrack) => {
            if (track.kind === Track.Kind.Audio) {
                const a = document.createElement('audio');
                a.autoplay = true;
                track.attach(a);
                audioElementsRef.current.push(a);
            }
            onAny();
        };

        room
            .on(RoomEvent.TrackSubscribed, onSubscribed)
            .on(RoomEvent.TrackUnsubscribed, onAny)
            .on(RoomEvent.LocalTrackPublished, onAny)
            .on(RoomEvent.LocalTrackUnpublished, onAny)
            .on(RoomEvent.ParticipantConnected, onAny)
            .on(RoomEvent.ParticipantDisconnected, onAny);

        void (async () => {
            try {
                await room.connect(url, token);
                if (cancelled) return;
                await room.localParticipant.setCameraEnabled(true);
                await room.localParticipant.setMicrophoneEnabled(true);
                setMicEnabled(room.localParticipant.isMicrophoneEnabled);
                setCamEnabled(room.localParticipant.isCameraEnabled);
                rebuildTiles(room);
            } catch (e) {
                if (!cancelled) {
                    onFatalError(e instanceof Error ? e.message : 'connection_failed');
                }
            }
        })();

        return () => {
            cancelled = true;
            void disconnect();
        };
    }, [url, token, rebuildTiles, onFatalError, disconnect]);

    const signalBridgeReady = useCallback(() => {
        if (bridgeOnceRef.current) return;
        bridgeOnceRef.current = true;
        setShowConnectionLayer(false);
        onBridgeReady?.();
    }, [onBridgeReady]);

    useEffect(() => {
        if (tiles.length > 0) {
            signalBridgeReady();
        }
    }, [tiles.length, signalBridgeReady]);

    useEffect(() => {
        const t = window.setTimeout(() => signalBridgeReady(), 12000);
        return () => window.clearTimeout(t);
    }, [signalBridgeReady]);

    useEffect(() => {
        if (!requestHardStop) return;
        onHardStopConsumed();
        void (async () => {
            await disconnect();
            if (!leavingRef.current) {
                leavingRef.current = true;
                onLeave();
            }
        })();
    }, [requestHardStop, disconnect, onLeave, onHardStopConsumed]);

    const gridClass = useMemo(() => {
        const n = tiles.length;
        if (n <= 1) return 'grid-cols-1';
        if (n === 2) return 'grid-cols-2';
        if (n <= 4) return 'grid-cols-2';
        return 'grid-cols-2 lg:grid-cols-3';
    }, [tiles.length]);

    const handleEnd = async () => {
        if (leavingRef.current) return;
        leavingRef.current = true;
        await disconnect();
        onLeave();
    };

    const toggleMic = async () => {
        const room = roomRef.current;
        if (!room) return;
        const next = !room.localParticipant.isMicrophoneEnabled;
        await room.localParticipant.setMicrophoneEnabled(next);
        setMicEnabled(next);
    };

    const toggleCam = async () => {
        const room = roomRef.current;
        if (!room) return;
        const next = !room.localParticipant.isCameraEnabled;
        await room.localParticipant.setCameraEnabled(next);
        setCamEnabled(next);
    };

    return (
        <div className="fixed inset-0 bg-slate-950 z-[100] text-white flex flex-col overflow-hidden select-none">
            <header className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/60 to-transparent z-[110] px-6 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-4 pointer-events-auto">
                    <div className="flex items-center gap-2 bg-slate-900/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-2xl">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse" />
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-white/90">
                            REC • {formatElapsed(secondsElapsed)}
                        </span>
                    </div>
                    <div className="flex items-end gap-0.5 h-3">
                        <div className="w-0.5 h-full bg-teal-500 rounded-full" />
                        <div className="w-0.5 h-4/5 bg-teal-500 rounded-full" />
                        <div className="w-0.5 h-3/5 bg-teal-500 rounded-full" />
                    </div>
                </div>
            </header>

            <main className="flex-1 relative mt-16 mb-28 overflow-hidden p-4 sm:p-6">
                {tiles.length === 0 ? (
                    <div className="flex h-full min-h-[200px] items-center justify-center bg-slate-950" aria-hidden />
                ) : (
                    <div className={`grid gap-3 sm:gap-6 w-full h-full ${gridClass}`}>
                        {tiles.map((t) => (
                            <VideoTileView key={t.key} track={t.track} label={t.label} />
                        ))}
                    </div>
                )}
            </main>

            {showConnectionLayer ? (
                <div
                    className="absolute inset-0 z-[120] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm"
                    role="status"
                    aria-live="polite"
                >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-teal-500/10 via-transparent to-transparent opacity-50" />
                    <div className="relative text-center px-6">
                        <div className="relative w-24 h-24 mx-auto mb-8">
                            <div className="absolute inset-0 rounded-full border-4 border-teal-500/20" />
                            <div className="absolute inset-0 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
                        </div>
                        <h2 className="text-white text-2xl font-bold tracking-tight mb-2">Connecting to meeting…</h2>
                        <p className="text-slate-400 font-medium">Securing your encrypted channel</p>
                    </div>
                </div>
            ) : null}

            <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-8 pointer-events-none">
                <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />
                <div className="relative max-w-md mx-auto flex items-center justify-center gap-6 pointer-events-auto bg-slate-950/40 backdrop-blur-2xl border border-white/5 rounded-3xl p-4 ring-1 ring-white/10">
                    <button
                        type="button"
                        onClick={() => void toggleMic()}
                        className={`flex flex-col items-center gap-1 ${!micEnabled ? 'text-red-400' : 'text-slate-200'}`}
                        title={micEnabled ? 'Mute' : 'Unmute'}
                    >
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/80 border border-white/10">
                            {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                        </span>
                        <span className="text-xs font-medium text-slate-400">Audio</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => void toggleCam()}
                        className={`flex flex-col items-center gap-1 ${!camEnabled ? 'text-red-400' : 'text-slate-200'}`}
                        title={camEnabled ? 'Stop video' : 'Start video'}
                    >
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/80 border border-white/10">
                            {camEnabled ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                        </span>
                        <span className="text-xs font-medium text-slate-400">Video</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleEnd()}
                        className="flex flex-col items-center gap-1 text-white"
                        title="End call"
                    >
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/40">
                            <PhoneOff className="w-5 h-5" />
                        </span>
                        <span className="text-xs font-medium text-slate-400">End</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

