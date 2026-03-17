import React, { useState, useEffect } from 'react';

interface LanguageDetectorProps {
  onLanguageChange: (lang: string) => void;
}

const LanguageDetector: React.FC<LanguageDetectorProps> = ({ onLanguageChange }) => {
  const [currentLang, setCurrentLang] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    // Detect browser language
    const browserLang = navigator.language || 'en';
    const primaryLang = browserLang.split('-')[0];
    
    // Only set if it's a supported language to prevent crashes
    const supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi'];
    
    if (supportedLanguages.includes(primaryLang)) {
      setCurrentLang(primaryLang);
      onLanguageChange(primaryLang);
    } else {
      setCurrentLang('en');
      onLanguageChange('en');
    }
  }, [onLanguageChange]);

  // Monitor for translation changes
  useEffect(() => {
    const handleTranslationChange = () => {
      // Check if Google Translate or other translation tools are active
      const translateElement = document.querySelector('.goog-te-banner-frame, .goog-te-menu-frame, [id*="goog"]');
      const hasTranslation = !!translateElement || document.documentElement.lang !== currentLang;
      
      if (hasTranslation && !isTranslating) {
        setIsTranslating(true);
        // Add protective styling to prevent layout breaks
        document.body.style.overflowX = 'hidden';
        document.body.style.wordBreak = 'break-word';
      } else if (!hasTranslation && isTranslating) {
        setIsTranslating(false);
        document.body.style.overflowX = '';
        document.body.style.wordBreak = '';
      }
    };

    // Monitor DOM changes for translation tools
    const observer = new MutationObserver(handleTranslationChange);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'id', 'lang']
    });

    // Also check periodically
    const interval = setInterval(handleTranslationChange, 1000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
      document.body.style.overflowX = '';
      document.body.style.wordBreak = '';
    };
  }, [currentLang, isTranslating]);

  return null; // This component doesn't render anything visible
};

export default LanguageDetector;