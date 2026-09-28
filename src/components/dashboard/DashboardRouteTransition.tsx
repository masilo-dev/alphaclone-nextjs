'use client';

import { motion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

const variants: Variants = {
  // A transform on the route wrapper becomes the containing block for fixed
  // dialogs rendered inside modules, trapping them beneath sticky chrome.
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.15 },
  },
};

export function DashboardRouteTransition({
  routeKey,
  children,
  className,
}: {
  routeKey: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      key={routeKey}
      initial="initial"
      animate="animate"
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
}
