'use client';

import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import useReducedMotion from '@/components/marketing/system/atmosphere/useReducedMotion';

interface PageTransitionProps {
  children: ReactNode;
}

const pageVariants: Variants = {
  initial: { opacity: 0, y: 18, scale: 0.988 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.46, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.995,
    transition: { duration: 0.2, ease: [0.7, 0, 0.84, 0] },
  },
};

const reducedMotionVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.1 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

const dashboardVariants: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.995 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.998,
    transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname() ?? '/';
  const reduceMotion = useReducedMotion();
  const isDashboard = pathname.startsWith('/dashboard');
  const transitionKey = pathname;
  const variants = reduceMotion
    ? reducedMotionVariants
    : isDashboard
      ? dashboardVariants
      : pageVariants;

  return (
    <AnimatePresence mode="sync" initial={false}>
      <motion.div
        key={transitionKey}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        className="ac-page-transition"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
