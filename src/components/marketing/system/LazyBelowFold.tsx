'use client';

import dynamic from 'next/dynamic';

// Lazy-load heavy below-the-fold sections to reduce initial JS payload
const InteractiveWorkflowStory = dynamic(() => import('./InteractiveWorkflowStory'), {
  loading: () => <div className="h-64 animate-pulse rounded-2xl bg-slate-900/40" aria-hidden="true" />,
  ssr: false,
});

const DifferentiationMatrix = dynamic(() => import('./DifferentiationMatrix'), {
  loading: () => <div className="h-48 animate-pulse rounded-2xl bg-slate-900/40" aria-hidden="true" />,
  ssr: false,
});

const BonnieAiSection = dynamic(() => import('./BonnieAiSection'), {
  loading: () => <div className="h-64 animate-pulse rounded-2xl bg-slate-900/40" aria-hidden="true" />,
  ssr: false,
});

const StackSavingsCalculator = dynamic(() => import('./StackSavingsCalculator'), {
  loading: () => <div className="h-48 animate-pulse rounded-2xl bg-slate-900/40" aria-hidden="true" />,
  ssr: false,
});

export {
  InteractiveWorkflowStory,
  DifferentiationMatrix,
  BonnieAiSection,
  StackSavingsCalculator,
};
