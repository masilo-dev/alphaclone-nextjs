'use client';

/**
 * Chart Wrapper Utilities
 * 
 * Helper functions to wrap Recharts components with ChartContainer
 * to prevent dimension errors
 */

import React from 'react';
import { ChartContainer } from '@/components/ui/ChartContainer';
import { ResponsiveContainer } from 'recharts';

interface WrapChartProps {
  children: React.ReactNode;
  height?: number;
  className?: string;
}

/**
 * Wraps any Recharts component with proper container and ResponsiveContainer
 * 
 * Usage:
 * <WrapChart height={300}>
 *   <BarChart data={data}>...</BarChart>
 * </WrapChart>
 */
export function WrapChart({ children, height = 300, className }: WrapChartProps) {
  return (
    <ChartContainer className={className || `h-[${height}px]`} minHeight={height}>
      <ResponsiveContainer width="100%" height={height} minWidth={0} minHeight={height}>
        {children}
      </ResponsiveContainer>
    </ChartContainer>
  );
}

export default WrapChart;
