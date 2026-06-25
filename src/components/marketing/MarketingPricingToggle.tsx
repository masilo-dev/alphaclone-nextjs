'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/marketing/ui/tabs';

export type BillingPeriod = 'monthly' | 'annual';

type MarketingPricingToggleProps = {
  value: BillingPeriod;
  onChange: (value: BillingPeriod) => void;
  className?: string;
};

export default function MarketingPricingToggle({ value, onChange, className }: MarketingPricingToggleProps) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as BillingPeriod)} className={className}>
      <div className="flex flex-col items-center gap-3">
        <TabsList>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="annual">Annual</TabsTrigger>
        </TabsList>
        <p className="text-xs font-medium text-teal-400/90">
          Save up to 20% with annual billing
        </p>
      </div>
    </Tabs>
  );
}
