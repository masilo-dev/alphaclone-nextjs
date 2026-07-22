'use client';

import React, { Suspense } from 'react';
import BonnieFullView from '@/components/dashboard/bonnie/BonnieFullView';

function BonnieWorkspaceInner() {
  return (
    <div className="min-h-dvh bg-slate-950">
      <BonnieFullView variant="popout" />
    </div>
  );
}

export default function BonnieWorkspaceClient() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-slate-950" />}>
      <BonnieWorkspaceInner />
    </Suspense>
  );
}
