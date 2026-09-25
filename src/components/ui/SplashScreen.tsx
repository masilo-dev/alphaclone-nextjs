'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { APP_TAGLINE } from '@/constants';

interface SplashScreenProps {
  isVisible?: boolean;
  mode?: 'loading' | 'opening';
  className?: string;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ 
  isVisible = true, 
  mode = 'loading',
  className = ""
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ 
            opacity: 0,
            scale: mode === 'opening' ? 1.5 : 1,
            transition: { duration: 0.8, ease: [0.43, 0.13, 0.23, 0.96] }
          }}
          className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[#020D1A] overflow-hidden ${className}`}
        >
          {/* Animated Background */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-teal-500/15 via-transparent to-transparent" />
          <motion.div
            className="absolute inset-0 opacity-30"
            animate={{ rotate: 360 }}
            transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
            style={{
              background: 'conic-gradient(from 0deg, transparent, rgba(65,153,164,0.2), transparent, rgba(65,153,164,0.06), transparent)',
            }}
          />
          
          <div className="relative flex flex-col items-center">
            {/* Logo Wrapper */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                y: [0, -10, 0]
              }}
              transition={{
                scale: { duration: 1, ease: "easeOut" },
                opacity: { duration: 1 },
                y: { repeat: Infinity, duration: 4, ease: "easeInOut" }
              }}
              className="relative mb-8"
            >
              {/* Outer Glow */}
              <div className="absolute inset-0 bg-teal-500/30 blur-3xl rounded-full scale-150 animate-pulse" />
              
              <Image 
                src="/logo.png" 
                alt="AlphaClone" 
                width={96}
                height={96}
                className="object-contain relative z-10 sm:w-28 sm:h-28"
                priority
              />
            </motion.div>

            {/* Brand Name */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="flex flex-col items-center gap-2"
            >
              <h1 className="text-2xl sm:text-3xl font-black tracking-caps text-white">
                ALPHA<span className="text-teal-400">CLONE</span>
              </h1>
              <p className="type-caption uppercase tracking-caps text-teal-400/60 font-medium text-center px-4">
                {APP_TAGLINE}
              </p>
            </motion.div>

            {/* Premium Loader */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-12 flex items-center gap-1.5"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    scaleY: [1, 2, 1],
                    opacity: [0.3, 1, 0.3],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1,
                    delay: i * 0.1,
                    ease: "easeInOut"
                  }}
                  className="w-1 h-4 bg-teal-400 rounded-full"
                />
              ))}
            </motion.div>
          </div>

          {/* Opening Transition Cover */}
          {mode === 'opening' && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 4, opacity: 1 }}
              transition={{ delay: 0.2, duration: 1.2, ease: "easeInOut" }}
              className="absolute inset-0 bg-white/5 backdrop-blur-sm rounded-full pointer-events-none"
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;

