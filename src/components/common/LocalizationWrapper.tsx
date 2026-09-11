import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface LocalizationWrapperProps {
  children: React.ReactNode;
}

const LocalizationWrapper: React.FC<LocalizationWrapperProps> = ({ children }) => {
  const [isClient, setIsClient] = useState(false);
  const [language, setLanguage] = useState('en');
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
    
    // Set initial language from browser
    const browserLang = navigator.language?.split('-')[0] || 'en';
    setLanguage(browserLang);
    
    // Add meta tag to prevent automatic translation
    const metaTag = document.createElement('meta');
    metaTag.name = 'google';
    metaTag.content = 'notranslate';
    document.head.appendChild(metaTag);
    
    // Prevent automatic translation
    document.documentElement.setAttribute('translate', 'no');
    document.documentElement.lang = browserLang;
    
    return () => {
      document.head.removeChild(metaTag);
    };
  }, []);

  // Hydration safety: we still keep isClient for browser-only logic, 
  // but we NO LONGER return null to prevent blank screen on first paint.
  useEffect(() => {
    setIsClient(true);
    // ... rest of effect
  }, []);

  return (
    <div 
      className={`localization-wrapper ${!isClient ? 'is-hydrating' : ''}`}
      style={{ 
        contain: 'layout style paint',
        overflowWrap: 'break-word',
        wordBreak: 'break-word'
      }}
      // These attributes help prevent Google Translate and other auto-translators
      // from breaking React hydration without needing a null return.
      translate="no"
      lang="en"
      suppressHydrationWarning
    >
      {children}
    </div>
  );
};

export default LocalizationWrapper;