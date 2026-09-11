import { useState, useEffect } from 'react';

export const useBreakpoint = () => {
  // Use a safe initial value for SSR
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    // Call once to set initial width
    handler();

    return () => window.removeEventListener('resize', handler);
  }, []);

  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    isSmallMobile: width <= 375,
  };
};
