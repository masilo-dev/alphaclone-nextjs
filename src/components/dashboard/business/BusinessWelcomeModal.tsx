'use client';

import React from 'react';
import { Modal, Button } from '@/components/ui/UIComponents';
import { ArrowRight, Sparkles } from 'lucide-react';

interface BusinessWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
}

/**
 * A short welcome intentionally introduces the goal picker instead of duplicating
 * dashboard setup cards. The next modal performs the durable user-level choice.
 */
export function BusinessWelcomeModal({ isOpen, onClose, userName }: BusinessWelcomeModalProps) {
  const firstName = userName.split(' ')[0] || 'there';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="space-y-6 py-2 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--brand-blue-500,#356AF4)]/30 bg-[var(--brand-blue-500,#356AF4)]/10 text-[var(--brand-blue-400,#91B5FF)]">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-blue-400,#91B5FF)]">
            Welcome to AlphaClone
          </p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-white">
            Welcome, {firstName}
          </h3>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
            You do not need to set up everything today. Choose one useful business outcome and AlphaClone will take you to the right starting point.
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-left">
          <p className="text-sm font-semibold text-white">Start with what matters now</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">
            For example: get more local customers, post to social media, manage enquiries, send a promotion, or create an invoice.
          </p>
        </div>

        <Button
          onClick={onClose}
          className="w-full bg-[var(--brand-blue-500,#356AF4)] hover:bg-[var(--brand-blue-600,#2854C5)] focus-visible:ring-2 focus-visible:ring-[var(--brand-blue-400,#91B5FF)]"
        >
          Choose my first goal
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </Modal>
  );
}
