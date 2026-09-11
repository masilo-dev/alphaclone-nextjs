'use client';

import React from 'react';
import { Activity, CheckCircle2, Clock3, Cpu, Shield, XCircle } from 'lucide-react';

export interface MissionControlMission {
  id: string;
  description: string;
  status: 'running' | 'completed' | 'failed';
  logs: string[];
  timestamp?: string;
}

export default function MissionControl({ missions }: { missions: MissionControlMission[] }) {
  const running = missions.filter(mission => mission.status === 'running').length;
  const completed = missions.filter(mission => mission.status === 'completed').length;
  const failed = missions.filter(mission => mission.status === 'failed').length;

  return (
    <div className="flex flex-col gap-6 p-6 bg-[#000F15] border border-[#00FFD1]/20 font-mono text-[#00FFD1]">
      <div className="flex flex-col gap-4 border-b border-[#00FFD1]/10 pb-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 border border-[#00FFD1]/30 flex items-center justify-center bg-[#001720]">
            <Activity className={`w-6 h-6 ${running ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-[0.2em] uppercase">Mission operations</h2>
            <span className="flex items-center gap-1 text-xs text-[#00FFD1]/60"><Shield className="w-3 h-3" /> Tenant-isolated durable execution history</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div className="border border-cyan-400/20 bg-cyan-400/5 px-4 py-2"><div className="text-lg text-white">{running}</div>Running</div>
          <div className="border border-emerald-400/20 bg-emerald-400/5 px-4 py-2"><div className="text-lg text-white">{completed}</div>Completed</div>
          <div className="border border-red-400/20 bg-red-400/5 px-4 py-2"><div className="text-lg text-white">{failed}</div>Failed</div>
        </div>
      </div>

      {missions.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-[#00FFD1]/15 text-[#00FFD1]/45">
          <Cpu className="mx-auto mb-3 h-8 w-8" />
          No missions have been submitted in this workspace.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {missions.map(mission => {
            const StatusIcon = mission.status === 'completed' ? CheckCircle2 : mission.status === 'failed' ? XCircle : Clock3;
            return (
              <article key={mission.id} className="border border-[#00FFD1]/10 bg-[#001720] p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-white">{mission.description}</div>
                    <div className="mt-1 text-[10px] opacity-40">{mission.id}</div>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] uppercase"><StatusIcon className="h-3 w-3" />{mission.status}</span>
                </div>
                <div className="max-h-40 space-y-1 overflow-y-auto border-t border-[#00FFD1]/10 pt-3 text-[10px] text-[#00FFD1]/65">
                  {mission.logs.slice(-8).map((log, index) => <div key={`${mission.id}-${index}`}>{log}</div>)}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
