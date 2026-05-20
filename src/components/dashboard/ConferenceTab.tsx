'use client';

import React, { useState } from 'react';
import { Video, Plus, Users, Clock, Mic, MicOff, Camera, CameraOff, Share2, X, Copy, Link } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

type RoomFilter = 'all' | 'live' | 'scheduled' | 'ended';

interface Room {
  id: string; name: string; status: 'live' | 'scheduled' | 'ended';
  participants: number; scheduledAt?: string;
}

const MOCK_ROOMS: Room[] = [
  { id: '1', name: 'Team Standup', status: 'live', participants: 4 },
  { id: '2', name: 'Client Review', status: 'scheduled', participants: 2, scheduledAt: new Date(Date.now() + 3600000).toISOString() },
  { id: '3', name: 'Design Sprint', status: 'ended', participants: 6 },
];

const FILTERS: RoomFilter[] = ['all', 'live', 'scheduled', 'ended'];

// ── Pre-Join Screen ────────────────────────────────────────────────────────────
const PreJoinScreen: React.FC<{ room: Room; onJoin: () => void; onBack: () => void }> = ({ room, onJoin, onBack }) => {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  return (
    <div className="flex flex-col h-full p-4 pb-8 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
          <X className="w-4 h-4 text-slate-300" />
        </button>
        <h2 className="text-[20px] font-bold text-white text-center flex-1">{room.name}</h2>
      </div>

      {/* Camera preview placeholder */}
      <div className="relative bg-slate-800 rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
        <div className="absolute inset-0 flex items-center justify-center">
          {camOn ? (
            <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center">
              <Camera className="w-7 h-7 text-slate-400" />
            </div>
          ) : (
            <div className="text-slate-500 text-center">
              <CameraOff className="w-10 h-10 mx-auto mb-2" />
              <span className="text-[13px]">Camera off</span>
            </div>
          )}
        </div>
      </div>

      {/* Participant stacks */}
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {[...Array(Math.min(room.participants, 4))].map((_, i) => (
            <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 border-2 border-slate-950 flex items-center justify-center text-[11px] font-bold text-white">{i + 1}</div>
          ))}
        </div>
        <span className="text-[13px] text-slate-400">{room.participants} participant{room.participants !== 1 ? 's' : ''}</span>
      </div>

      {/* Mic / Cam toggles */}
      <div className="flex justify-center gap-6">
        <button onClick={() => setMicOn(p => !p)} className={`w-[52px] h-[52px] rounded-full flex items-center justify-center ${micOn ? 'bg-slate-800' : 'bg-red-500'}`}>
          {micOn ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6 text-white" />}
        </button>
        <button onClick={() => setCamOn(p => !p)} className={`w-[52px] h-[52px] rounded-full flex items-center justify-center ${camOn ? 'bg-slate-800' : 'bg-red-500'}`}>
          {camOn ? <Camera className="w-6 h-6 text-white" /> : <CameraOff className="w-6 h-6 text-white" />}
        </button>
      </div>

      <button onClick={onJoin} className="w-full h-[52px] bg-teal-600 hover:bg-teal-500 rounded-2xl text-white font-black uppercase tracking-wider text-[13px] transition-colors">
        Join Room
      </button>

      {/* Share link */}
      <div className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2.5">
        <Link className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="flex-1 text-[13px] text-slate-400 truncate">meet.alphaclone.app/{room.id}</span>
        <button onClick={() => { navigator.clipboard.writeText(`meet.alphaclone.app/${room.id}`); toast.success('Link copied!'); }}>
          <Copy className="w-4 h-4 text-teal-400" />
        </button>
      </div>
    </div>
  );
};

// ── In-Call UI ────────────────────────────────────────────────────────────────
const InCallUI: React.FC<{ room: Room; onEnd: () => void }> = ({ room, onEnd }) => {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const tiles = Array.from({ length: room.participants }, (_, i) => i);

  const gridClass = tiles.length === 1 ? 'grid-cols-1' :
    tiles.length === 2 ? 'grid-cols-1' :
    'grid-cols-2';

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Video grid */}
      <div className={`flex-1 grid ${gridClass} gap-0.5`}>
        {tiles.map(i => (
          <div key={i} className="relative bg-slate-900 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center text-lg font-bold text-white">{i + 1}</div>
            <span className="absolute bottom-2 left-2 text-[11px] text-white/80 font-bold">Participant {i + 1}</span>
            {i % 2 === 0 && <MicOff className="absolute top-2 right-2 w-4 h-4 text-white/60" />}
          </div>
        ))}
      </div>

      {/* Controls bar */}
      <div className="bg-black/60 backdrop-blur-lg flex items-center justify-center gap-4 px-4 pb-[env(safe-area-inset-bottom,16px)] pt-4" style={{ minHeight: 80 }}>
        <button onClick={() => setMicOn(p => !p)} className={`w-[52px] h-[52px] rounded-full flex items-center justify-center ${!micOn ? 'bg-red-500' : 'bg-white/10'}`}>
          {micOn ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
        </button>
        <button onClick={() => setCamOn(p => !p)} className={`w-[52px] h-[52px] rounded-full flex items-center justify-center ${!camOn ? 'bg-red-500' : 'bg-white/10'}`}>
          {camOn ? <Camera className="w-5 h-5 text-white" /> : <CameraOff className="w-5 h-5 text-white" />}
        </button>
        <button className="w-[52px] h-[52px] rounded-full bg-white/10 flex items-center justify-center">
          <Share2 className="w-5 h-5 text-white" />
        </button>
        <button className="w-[52px] h-[52px] rounded-full bg-white/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-white" />
        </button>
        <button onClick={onEnd} className="w-[60px] h-[52px] rounded-full bg-red-500 flex items-center justify-center">
          <Phone className="w-5 h-5 text-white rotate-[135deg]" />
        </button>
      </div>
    </div>
  );
};

// ── Main ConferenceTab ─────────────────────────────────────────────────────────
const Phone: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
  </svg>
);

const ConferenceTab: React.FC = () => {
  const [filter, setFilter] = useState<RoomFilter>('all');
  const [preJoinRoom, setPreJoinRoom] = useState<Room | null>(null);
  const [inCallRoom, setInCallRoom] = useState<Room | null>(null);
  const rooms = MOCK_ROOMS;

  const filtered = filter === 'all' ? rooms : rooms.filter(r => r.status === filter);

  if (inCallRoom) return <InCallUI room={inCallRoom} onEnd={() => setInCallRoom(null)} />;
  if (preJoinRoom) return <PreJoinScreen room={preJoinRoom} onJoin={() => { setInCallRoom(preJoinRoom); setPreJoinRoom(null); }} onBack={() => setPreJoinRoom(null)} />;

  return (
    <div className="relative flex flex-col h-full">
      {/* Filter tabs */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide border-b border-white/5">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`flex-shrink-0 h-[34px] px-3.5 rounded-full text-[12px] font-bold capitalize transition-all ${filter === f ? 'bg-teal-500 text-white' : 'bg-slate-900 text-slate-400 border border-white/5'}`}>{f}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pb-20 bg-slate-950 divide-y divide-white/5">
        {filtered.map(room => (
          <button key={room.id} onClick={() => setPreJoinRoom(room)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left">
            <div className="relative flex-shrink-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${room.status === 'live' ? 'bg-red-500/20' : 'bg-slate-800'}`}>
                <Video className={`w-5 h-5 ${room.status === 'live' ? 'text-red-400' : 'text-slate-400'}`} />
              </div>
              {room.status === 'live' && (
                <span className="absolute -top-1 -right-1 flex items-center gap-0.5 bg-red-500 rounded-full px-1.5 py-0.5">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  <span className="text-[8px] font-black text-white">LIVE</span>
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-bold text-white truncate">{room.name}</div>
              {room.scheduledAt && <div className="text-[13px] text-slate-500 opacity-55">{new Date(room.scheduledAt).toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
              {room.status === 'ended' && <div className="text-[13px] text-slate-500 opacity-55">Ended</div>}
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full flex-shrink-0">
              {room.participants} <Users className="w-3 h-3 inline" />
            </span>
          </button>
        ))}
      </div>

      <button className="fixed bottom-20 right-4 w-14 h-14 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 z-30">
        <Video className="w-6 h-6 text-white" />
      </button>
    </div>
  );
};

export default ConferenceTab;
