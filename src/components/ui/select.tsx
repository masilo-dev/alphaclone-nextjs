'use client';

import React from 'react';
import { FIELD_CONTROL_CLASS } from './input';

/** Native selection preserves keyboard navigation and the mobile OS picker. */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...props }, ref) => (
    <select ref={ref} className={`${FIELD_CONTROL_CLASS} appearance-auto ${className}`} {...props}>
      {children}
    </select>
  )
);
Select.displayName = 'Select';
