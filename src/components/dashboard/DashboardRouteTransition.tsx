'use client';

import { motion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

const variants: Variants = {
  initial: { opacity: 0, y: 10, scale: 0.995 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
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
