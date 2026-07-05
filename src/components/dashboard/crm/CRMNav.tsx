'use client';

import React from 'react';
import { SalesWorkspaceTabs } from '../hubs/SalesWorkspaceTabs';

export function CRMNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Sales workspace sections" className="mb-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-1.5">
      <SalesWorkspaceTabs pathname={pathname} compact className="m-0 px-0 pb-0" />
    </nav>
  );
}
