'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
<<<<<<< HEAD
import { Room, RoomEvent, Track, type RemoteTrack, type Participant, type Track as LiveKitTrack } from 'livekit-client';
import {
    Mic,
    MicOff,
    Monitor,
    MonitorOff,
    Copy,
    Check,
    PhoneOff,
    ShieldCheck,
    Video as VideoIcon,
    VideoOff,
    Wifi,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { WORKSPACE } from '@/constants/design';

type VideoTile = { key: string; track: LiveKitTrack; label: string };
=======
import { Room, RoomEvent, Track, type LocalTrack, type RemoteTrack } from 'livekit-client';
import { Mic, MicOff, PhoneOff, ShieldCheck, Video as VideoIcon, VideoOff, Wifi } from 'lucide-react';

type VideoTile = { key: string; track: LocalTrack | RemoteTrack; label: string };
>>>>>>> origin/main

export type LiveKitStageProps = {
    url: string;
    token: string;
    displayName: string;
<<<<<<< HEAD
    callId?: string;
=======
>>>>>>> origin/main
    secondsElapsed: number;
    formatElapsed: (seconds: number) => string;
    requestHardStop: boolean;
    onHardStopConsumed: () => void;
    onLeave: () => void;
    onFatalError: (message: string) => void;
<<<<<<< HEAD
    onBridgeReady?: () => void;
};

function VideoTileView({
    track,
    label,
    isScreenShare = false,
}: {
    track: LiveKitTrack;
    label: string;
    isScreenShare?: boolean;
}) {
=======
    /** Fired once the session is visually ready (video tiles) so the parent can hide any bridging UI. */
    onBridgeReady?: () => void;
};

function VideoTileView({ track, label }: { track: LocalTrack | RemoteTrack; label: string }) {
>>>>>>> origin/main
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
<<<<<<< HEAD
        <div
            className={`relative min-h-[120px] overflow-hidden bg-slate-900 ring-1 ring-white/5 shadow-none ${
                isScreenShare ? 'h-full rounded-lg' : 'rounded-lg'
            }`}
        >
            <video
                ref={ref}
                className={`w-full h-full bg-slate-950 ${isScreenShare ? 'object-contain' : 'object-cover aspect-video'}`}
                playsInline
                autoPlay
                muted={!isScreenShare}
            />
            <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 backdrop-blur-md">
                {isScreenShare && <Monitor className="w-3.5 h-3.5 text-emerald-300" />}
=======
        <div className="relative rounded-3xl overflow-hidden bg-slate-900 ring-1 ring-white/5 shadow-2xl min-h-[120px]">
            <video ref={ref} className="w-full h-full object-cover aspect-video bg-slate-950" playsInline autoPlay muted />
            <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
>>>>>>> origin/main
                <span className="text-xs font-semibold text-white">{label}</span>
            </div>
        </div>
    );
}

export default function LiveKitStage({
    url,
    token,
    displayName,
<<<<<<< HEAD
    callId,
=======
>>>>>>> origin/main
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
<<<<<<< HEAD
    const [cameraTiles, setCameraTiles] = useState<VideoTile[]>([]);
    const [screenTiles, setScreenTiles] = useState<VideoTile[]>([]);
    const [micEnabled, setMicEnabled] = useState(true);
    const [camEnabled, setCamEnabled] = useState(true);
    const [screenSharing, setScreenSharing] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const leavingRef = useRef(false);
    const bridgeOnceRef = useRef(false);
    const onFatalErrorRef = useRef(onFatalError);
    const onBridgeReadyRef = useRef(onBridgeReady);

    useEffect(() => {
        onFatalErrorRef.current = onFatalError;
    }, [onFatalError]);

    useEffect(() => {
        onBridgeReadyRef.current = onBridgeReady;
    }, [onBridgeReady]);

=======
    const [tiles, setTiles] = useState<VideoTile[]>([]);
    const [micEnabled, setMicEnabled] = useState(true);
    const [camEnabled, setCamEnabled] = useState(true);
    const leavingRef = useRef(false);
    const bridgeOnceRef = useRef(false);
>>>>>>> origin/main
    const [showConnectionLayer, setShowConnectionLayer] = useState(true);
    const [connectionState, setConnectionState] = useState('connecting');
    const [connectionQuality, setConnectionQuality] = useState('unknown');

    const rebuildTiles = useCallback(
        (room: Room) => {
<<<<<<< HEAD
            const cameras: VideoTile[] = [];
            const screens: VideoTile[] = [];

            const collectFromParticipant = (participant: Participant, isLocal: boolean) => {
                participant.videoTrackPublications.forEach((pub) => {
                    const t = pub.track;
                    if (!t || t.kind !== Track.Kind.Video) return;
                    if (!isLocal && !pub.isSubscribed) return;

                    const label = isLocal
                        ? `${displayName} (You)`
                        : participant.name || participant.identity;

                    if (pub.source === Track.Source.ScreenShare) {
                        screens.push({
                            key: `${participant.identity}-screen-${pub.trackSid}`,
                            track: t,
                            label: isLocal ? 'Your screen' : `${label}'s screen`,
                        });
                    } else if (pub.source === Track.Source.Camera) {
                        cameras.push({
                            key: `${participant.identity}-cam-${pub.trackSid}`,
                            track: t,
                            label,
                        });
                    }
                });
            };

            collectFromParticipant(room.localParticipant, true);
            room.remoteParticipants.forEach((p) => collectFromParticipant(p, false));

            setScreenTiles(screens);
            setCameraTiles(cameras);
            setScreenSharing(room.localParticipant.isScreenShareEnabled);
=======
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
>>>>>>> origin/main
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

        const onConnectionStateChanged = (state: unknown) => {
            setConnectionState(String(state || 'connected'));
        };

        const onConnectionQualityChanged = (quality: unknown, participant: { identity?: string } | undefined) => {
            if (participant?.identity === room.localParticipant.identity) {
                setConnectionQuality(String(quality || 'unknown'));
            }
        };

        room
            .on(RoomEvent.TrackSubscribed, onSubscribed)
            .on(RoomEvent.TrackUnsubscribed, onAny)
            .on(RoomEvent.LocalTrackPublished, onAny)
            .on(RoomEvent.LocalTrackUnpublished, onAny)
            .on(RoomEvent.ParticipantConnected, onAny)
            .on(RoomEvent.ParticipantDisconnected, onAny)
            .on(RoomEvent.ConnectionStateChanged, onConnectionStateChanged)
            .on(RoomEvent.ConnectionQualityChanged, onConnectionQualityChanged);

        void (async () => {
            try {
                await room.connect(url, token);
                if (cancelled) return;
                setConnectionState('connected');
                await room.localParticipant.setCameraEnabled(true);
                await room.localParticipant.setMicrophoneEnabled(true);
                setMicEnabled(room.localParticipant.isMicrophoneEnabled);
                setCamEnabled(room.localParticipant.isCameraEnabled);
                rebuildTiles(room);
            } catch (e) {
                if (!cancelled) {
<<<<<<< HEAD
                    onFatalErrorRef.current(e instanceof Error ? e.message : 'connection_failed');
=======
                    onFatalError(e instanceof Error ? e.message : 'connection_failed');
>>>>>>> origin/main
                }
            }
        })();

        return () => {
            cancelled = true;
            void disconnect();
        };
<<<<<<< HEAD
    }, [url, token, rebuildTiles, disconnect]);
=======
    }, [url, token, rebuildTiles, onFatalError, disconnect]);
>>>>>>> origin/main

    const signalBridgeReady = useCallback(() => {
        if (bridgeOnceRef.current) return;
        bridgeOnceRef.current = true;
        setShowConnectionLayer(false);
<<<<<<< HEAD
        onBridgeReadyRef.current?.();
    }, []);

    useEffect(() => {
        if (cameraTiles.length > 0 || screenTiles.length > 0) {
            signalBridgeReady();
        }
    }, [cameraTiles.length, screenTiles.length, signalBridgeReady]);
=======
        onBridgeReady?.();
    }, [onBridgeReady]);

    useEffect(() => {
        if (tiles.length > 0) {
            signalBridgeReady();
        }
    }, [tiles.length, signalBridgeReady]);
>>>>>>> origin/main

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
<<<<<<< HEAD
        const n = cameraTiles.length;
=======
        const n = tiles.length;
>>>>>>> origin/main
        if (n <= 1) return 'grid-cols-1';
        if (n === 2) return 'grid-cols-2';
        if (n <= 4) return 'grid-cols-2';
        return 'grid-cols-2 lg:grid-cols-3';
<<<<<<< HEAD
    }, [cameraTiles.length]);
=======
    }, [tiles.length]);
>>>>>>> origin/main

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

<<<<<<< HEAD
    const toggleScreenShare = async () => {
        const room = roomRef.current;
        if (!room) return;
        try {
            const next = !room.localParticipant.isScreenShareEnabled;
            await room.localParticipant.setScreenShareEnabled(next);
            setScreenSharing(next);
            rebuildTiles(room);
            if (next) {
                toast.success('Screen sharing started');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Screen sharing failed';
            if (/cancel|abort/i.test(message)) {
                toast.error('Screen share cancelled');
            } else if (/not supported|NotSupported/i.test(message)) {
                toast.error('Screen sharing is not supported on this device or browser');
            } else {
                toast.error('Could not share screen. Try Chrome or Edge on desktop.');
            }
            setScreenSharing(false);
        }
    };

    const copyInviteLink = async () => {
        try {
            const link = callId
                ? `${window.location.origin}/meet/${callId}`
                : window.location.href;
            await navigator.clipboard.writeText(link);
            setLinkCopied(true);
            toast.success('Meeting link copied');
            setTimeout(() => setLinkCopied(false), 2000);
        } catch {
            toast.error('Failed to copy link');
        }
    };

    const primaryScreen = screenTiles[0];

    return (
        <div className="fixed inset-0 bg-slate-950 z-[1100] text-white flex flex-col overflow-hidden select-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <header className="absolute top-[env(safe-area-inset-top)] left-0 right-0 h-16 sm:h-20 bg-gradient-to-b from-black/60 to-transparent z-[110] px-4 sm:px-6 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-4 pointer-events-auto">
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/60 px-3 sm:px-4 py-1.5 sm:py-2 backdrop-blur-md">
                        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse" />
                        <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-white/90">
                            {formatElapsed(secondsElapsed)}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2 pointer-events-auto">
                    <div className="hidden sm:flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 backdrop-blur-md">
                        <ShieldCheck className="w-4 h-4 text-emerald-300" />
                        <span className="text-xs font-black uppercase text-emerald-100">Secure room</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/60 px-2.5 sm:px-3 py-1.5 sm:py-2 backdrop-blur-md">
                        <Wifi className="w-4 h-4 text-teal-300" />
                        <span className="text-[10px] sm:text-xs font-semibold text-white/80 capitalize hidden sm:inline">
=======
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
                <div className="hidden sm:flex items-center gap-2 pointer-events-auto">
                    <div className="flex items-center gap-2 bg-emerald-500/10 backdrop-blur-md border border-emerald-400/20 px-3 py-2 rounded-2xl">
                        <ShieldCheck className="w-4 h-4 text-emerald-300" />
                        <span className="text-xs font-black uppercase text-emerald-100">Secure Alpha Room</span>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-900/60 backdrop-blur-md border border-white/10 px-3 py-2 rounded-2xl">
                        <Wifi className="w-4 h-4 text-teal-300" />
                        <span className="text-xs font-semibold text-white/80 capitalize">
>>>>>>> origin/main
                            {connectionState} · {connectionQuality}
                        </span>
                    </div>
                </div>
            </header>

<<<<<<< HEAD
            <main className="flex-1 relative mt-14 sm:mt-16 mb-28 overflow-hidden p-3 sm:p-6">
                {primaryScreen ? (
                    <div className="flex h-full flex-col gap-3">
                        <div className="flex-1 min-h-0">
                            <VideoTileView
                                track={primaryScreen.track}
                                label={primaryScreen.label}
                                isScreenShare
                            />
                        </div>
                        {cameraTiles.length > 0 && (
                            <div className="flex shrink-0 gap-2 h-24 sm:h-28 overflow-x-auto pb-1">
                                {cameraTiles.map((t) => (
                                    <div key={t.key} className="h-full w-36 sm:w-44 shrink-0">
                                        <VideoTileView track={t.track} label={t.label} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : cameraTiles.length === 0 ? (
                    <div className="flex h-full min-h-[200px] items-center justify-center bg-slate-950" aria-hidden />
                ) : (
                    <div className={`grid gap-3 sm:gap-6 w-full h-full ${gridClass}`}>
                        {cameraTiles.map((t) => (
=======
            <main className="flex-1 relative mt-16 mb-28 overflow-hidden p-4 sm:p-6">
                {tiles.length === 0 ? (
                    <div className="flex h-full min-h-[200px] items-center justify-center bg-slate-950" aria-hidden />
                ) : (
                    <div className={`grid gap-3 sm:gap-6 w-full h-full ${gridClass}`}>
                        {tiles.map((t) => (
>>>>>>> origin/main
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

<<<<<<< HEAD
            <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pointer-events-none">
                <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />
                <div className={`relative mx-auto flex max-w-2xl items-center justify-center gap-3 border border-white/5 bg-slate-950/40 p-3 ring-1 ring-white/10 pointer-events-auto sm:gap-5 sm:p-4 ${WORKSPACE.panel.radius} backdrop-blur-2xl`}>
                    <ControlBtn
                        onClick={() => void toggleMic()}
                        active={!micEnabled}
                        label={micEnabled ? 'Mute' : 'Unmute'}
                        icon={micEnabled ? Mic : MicOff}
                    />
                    <ControlBtn
                        onClick={() => void toggleCam()}
                        active={!camEnabled}
                        label={camEnabled ? 'Video' : 'Start'}
                        icon={camEnabled ? VideoIcon : VideoOff}
                    />
                    <ControlBtn
                        onClick={() => void toggleScreenShare()}
                        highlight={screenSharing}
                        label={screenSharing ? 'Stop' : 'Share'}
                        icon={screenSharing ? MonitorOff : Monitor}
                    />
                    <ControlBtn
                        onClick={() => void copyInviteLink()}
                        label={linkCopied ? 'Copied' : 'Invite'}
                        icon={linkCopied ? Check : Copy}
                    />
                    <ControlBtn
                        onClick={() => void handleEnd()}
                        danger
                        label="End"
                        icon={PhoneOff}
                    />
=======
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
>>>>>>> origin/main
                </div>
            </div>
        </div>
    );
}
<<<<<<< HEAD

function ControlBtn({
    onClick,
    active,
    highlight,
    danger,
    label,
    icon: Icon,
}: {
    onClick: () => void;
    active?: boolean;
    highlight?: boolean;
    danger?: boolean;
    label: string;
    icon: React.ElementType;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex flex-col items-center gap-1 min-w-[52px]"
            title={label}
        >
            <span
                className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border transition-colors ${
                    danger
                        ? 'bg-red-600 hover:bg-red-500 border-red-500/50 shadow-lg shadow-red-900/40 text-white'
                        : highlight
                          ? 'bg-teal-600 border-teal-400/50 text-white'
                          : active
                            ? 'bg-red-500/20 border-red-500/50 text-red-400'
                            : 'bg-slate-800/80 border-white/10 text-slate-200 hover:bg-slate-700'
                }`}
            >
                <Icon className="w-5 h-5" />
            </span>
            <span className="text-[10px] sm:text-xs font-medium text-slate-400">{label}</span>
        </button>
    );
}
=======
>>>>>>> origin/main
