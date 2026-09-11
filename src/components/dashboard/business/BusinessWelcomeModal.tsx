'use client';

import React from 'react';
import { Modal, Button } from '@/components/ui/UIComponents';
import { UserPlus, FileText, Mail, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BusinessWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
}

const FIRST_STEPS = [
  {
    title: 'Add a client',
    description: 'CRM → quick add a contact',
    href: '/dashboard/crm/workspace?quickAdd=true',
    icon: UserPlus,
  },
  {
    title: 'Create an invoice',
    description: 'Billing → new invoice',
    href: '/dashboard/business/billing/manage?create=true',
    icon: FileText,
  },
  {
    title: 'Connect inbox',
    description: 'Mail → connect email',
    href: '/dashboard/mail',
    icon: Mail,
  },
];

export function BusinessWelcomeModal({ isOpen, onClose, userName }: BusinessWelcomeModalProps) {
  const router = useRouter();
  const firstName = userName.split(' ')[0] || 'there';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="space-y-6 py-2">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-teal-400 mb-2">
            Workspace ready
          </p>
          <h3 className="text-2xl font-bold text-white tracking-tight">
            Welcome, {firstName}
          </h3>
          <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
            Your 14-day trial is live. Here is exactly what to do next — most owners finish these three steps in under 10 minutes.
          </p>
        </div>

        <div className="space-y-2">
          {FIRST_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <button
                key={step.title}
                type="button"
                onClick={() => {
                  onClose();
                  router.push(step.href);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-teal-500/40 hover:bg-teal-500/5 text-left transition-colors"
              >
                <span className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-teal-400 shrink-0">
                  {index + 1}
                </span>
                <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{step.title}</p>
                  <p className="text-xs text-slate-500">{step.description}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
              </button>
            );
          })}
        </div>

        <Button onClick={onClose} className="w-full bg-teal-600 hover:bg-teal-500">
          Go to dashboard
        </Button>
      </div>
    </Modal>
  );
}
