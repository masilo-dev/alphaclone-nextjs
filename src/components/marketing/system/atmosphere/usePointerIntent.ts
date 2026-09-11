'use client';

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export default function usePointerIntent(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled || !window.matchMedia('(pointer: fine)').matches) return;

    const move = (event: PointerEvent) => {
      if (frame.current !== null) return;
      frame.current = window.requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth - 0.5) * 12;
        const y = (event.clientY / window.innerHeight - 0.5) * 9;
        node.style.setProperty('--orb-pointer-x', `${x.toFixed(2)}px`);
        node.style.setProperty('--orb-pointer-y', `${y.toFixed(2)}px`);
        frame.current = null;
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      node.style.removeProperty('--orb-pointer-x');
      node.style.removeProperty('--orb-pointer-y');
    };
  }, [enabled, ref]);
}
