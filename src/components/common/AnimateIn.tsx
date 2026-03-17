'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';

type AnimationType = 'fadeUp' | 'fadeIn' | 'fadeLeft' | 'fadeRight' | 'scaleIn' | 'stagger';

interface AnimateInProps {
    children: React.ReactNode;
    type?: AnimationType;
    delay?: number;
    duration?: number;
    className?: string;
    /** When used as a stagger parent, pass index to auto-calculate delay */
    index?: number;
    once?: boolean;
}

const variants: Record<AnimationType, Variants> = {
    fadeUp: {
        hidden: { opacity: 0, y: 32 },
        visible: (delay: number) => ({
            opacity: 1,
            y: 0,
            transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] },
        }),
    },
    fadeIn: {
        hidden: { opacity: 0 },
        visible: (delay: number) => ({
            opacity: 1,
            transition: { duration: 0.5, delay, ease: 'easeOut' },
        }),
    },
    fadeLeft: {
        hidden: { opacity: 0, x: -32 },
        visible: (delay: number) => ({
            opacity: 1,
            x: 0,
            transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] },
        }),
    },
    fadeRight: {
        hidden: { opacity: 0, x: 32 },
        visible: (delay: number) => ({
            opacity: 1,
            x: 0,
            transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] },
        }),
    },
    scaleIn: {
        hidden: { opacity: 0, scale: 0.9 },
        visible: (delay: number) => ({
            opacity: 1,
            scale: 1,
            transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] },
        }),
    },
    stagger: {
        hidden: { opacity: 0, y: 20 },
        visible: (delay: number) => ({
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, delay, ease: 'easeOut' },
        }),
    },
};

/**
 * AnimateIn — scroll-triggered entrance animation wrapper.
 * Wraps children with a Framer Motion whileInView animation.
 *
 * @example
 * <AnimateIn type="fadeUp" delay={0.1}>
 *   <h2>Section Title</h2>
 * </AnimateIn>
 *
 * // For grid items, pass an index to stagger:
 * {items.map((item, i) => (
 *   <AnimateIn key={i} type="stagger" index={i}>
 *     <Card ... />
 *   </AnimateIn>
 * ))}
 */
const AnimateIn: React.FC<AnimateInProps> = ({
    children,
    type = 'fadeUp',
    delay = 0,
    duration,
    className,
    index,
    once = true,
}) => {
    // If index provided, stagger by 0.08s per item
    const computedDelay = index !== undefined ? index * 0.08 + delay : delay;
    const variant = variants[type];

    return (
        <motion.div
            className={className}
            variants={variant}
            initial="hidden"
            whileInView="visible"
            viewport={{ once, amount: 0.15 }}
            custom={computedDelay}
        >
            {children}
        </motion.div>
    );
};

export default AnimateIn;
