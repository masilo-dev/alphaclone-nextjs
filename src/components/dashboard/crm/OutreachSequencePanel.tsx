'use client';

import React, { useState } from 'react';
import { outreachSequenceService, OutreachSequence } from '@/services/outreachSequenceService';
import { Play, Mail, MessageSquare, Clock, CheckCircle2, Send, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

interface OutreachSequencePanelProps {
  leadName?: string;
  leadEmail?: string;
  leadPhone?: string;
  leadCompany?: string;
}

export function OutreachSequencePanel({
  leadName = 'John Doe',
  leadEmail = 'john@example.com',
  leadPhone = '+15550199823',
  leadCompany = 'Acme Corp',
}: OutreachSequencePanelProps) {
  const sequences = outreachSequenceService.getSequences();
  const [selectedSeqId, setSelectedSeqId] = useState<string>(sequences[0].id);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [running, setRunning] = useState<boolean>(false);

  const currentSeq = sequences.find(s => s.id === selectedSeqId) || sequences[0];

  const handleExecuteStep = (stepIndex: number) => {
    const step = currentSeq.steps[stepIndex];
    if (step.channel === 'whatsapp') {
      const waText = step.template.replace(/{{name}}/g, leadName).replace(/{{company}}/g, leadCompany);
      const url = outreachSequenceService.generateWhatsAppUrl(leadPhone, waText);
      window.open(url, '_blank');
      toast.success(`Opened WhatsApp outreach for ${leadName}`);
    } else {
      toast.success(`Dispatched Brevo Email step: "${step.title}" to ${leadEmail}`);
    }
    setActiveStepIndex(stepIndex + 1);
  };

  const handleStartSequence = () => {
    setRunning(true);
    toast.success(`Sequence "${currentSeq.name}" enrolled for ${leadName}`);
  };

  return (
    <div className="ac-workspace-panel rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Send size={15} className="text-teal-400" /> Automated Drip Sequence Engine
          </h4>
          <p className="text-[11px] text-slate-400">Multi-step Brevo email & WhatsApp outreach pipeline</p>
        </div>
        <button
          onClick={handleStartSequence}
          disabled={running}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors disabled:opacity-50"
        >
          <Play size={12} /> {running ? 'Enrolled' : 'Start Sequence'}
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Select Sequence Template
          </label>
          <select
            value={selectedSeqId}
            onChange={(e) => {
              setSelectedSeqId(e.target.value);
              setActiveStepIndex(0);
              setRunning(false);
            }}
            className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs font-bold outline-none focus:border-teal-500/50"
          >
            {sequences.map(s => (
              <option key={s.id} value={s.id}>{s.name} - ({s.steps.length} Steps)</option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400 mt-1">{currentSeq.description}</p>
        </div>

        <div className="relative pl-6 space-y-3 pt-2">
          <div className="absolute left-2.5 top-3 bottom-3 w-px bg-white/10" />
          {currentSeq.steps.map((step, idx) => {
            const isCompleted = idx < activeStepIndex;
            const isCurrent = idx === activeStepIndex;
            return (
              <div key={idx} className="relative flex items-start gap-3">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 -ml-6 text-[10px] font-black ${
                    isCompleted
                      ? 'bg-emerald-500 text-slate-950'
                      : isCurrent
                      ? 'bg-teal-400 text-slate-950 ring-4 ring-teal-400/20'
                      : 'bg-slate-800 text-slate-400 border border-white/10'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 size={12} /> : idx + 1}
                </div>
                <div className={`flex-1 rounded-xl p-3 border transition-all ${
                  isCurrent ? 'bg-teal-500/10 border-teal-500/30' : 'bg-slate-900/50 border-white/5'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {step.channel === 'email' ? (
                        <Mail size={13} className="text-indigo-400" />
                      ) : (
                        <MessageSquare size={13} className="text-emerald-400" />
                      )}
                      <span className="text-xs font-bold text-white">{step.title}</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded-full">
                      Day {step.day}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 italic">"{step.template}"</p>
                  <div className="mt-2 text-right">
                    <button
                      onClick={() => handleExecuteStep(idx)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-400 hover:text-teal-300 transition-colors"
                    >
                      {step.channel === 'whatsapp' ? 'Open WhatsApp' : 'Dispatch Now'} <ExternalLink size={10} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
