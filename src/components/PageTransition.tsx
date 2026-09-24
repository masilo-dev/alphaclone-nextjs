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
    transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.995,
    pointerEvents: 'none',
    transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  },
};

const reducedMotionVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.1 } },
  exit: { opacity: 0, pointerEvents: 'none', transition: { duration: 0.1 } },
};

const dashboardVariants: Variants = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 0, pointerEvents: 'none', transition: { duration: 0.12 } },
};

export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname() ?? '/';
  const reduceMotion = useReducedMotion();
  const isDashboard = pathname.startsWith('/dashboard');
  // Keep dashboard shell stable across internal dashboard routes so tab navigation
  // never causes full-tree remounts, opacity flicker, or click blocking.
  const transitionKey = isDashboard ? '/dashboard' : pathname;
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
