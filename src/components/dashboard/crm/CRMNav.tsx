'use client';

import React from 'react';
import { SubNavigation } from '@/components/ui/os';
import { getModuleSubnav } from '@/lib/dashboard/moduleSubnav';

export function CRMNav({ pathname }: { pathname: string }) {
  return (
    <SubNavigation
      moduleId="crm"
      items={getModuleSubnav('crm')}
      activeHref={pathname}
      className="mb-1"
    />
  );
}
