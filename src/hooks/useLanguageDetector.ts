import { useEffect, useState } from 'react';

export const useLanguageDetector = () => {
  const [language, setLanguage] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    // Detect browser language
    const detectLanguage = () => {
      const browserLang = navigator.language || 'en';
      const primaryLang = browserLang.split('-')[0];
      
      // Supported languages to prevent crashes
      const supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi'];
      
      const detectedLang = supportedLanguages.includes(primaryLang) ? primaryLang : 'en';
      setLanguage(detectedLang);
      
      // Check for translation tools
      checkForTranslation();
    };

    const checkForTranslation = () => {
      // Check for Google Translate
      const hasGoogleTranslate = !!document.querySelector('.goog-te-banner-frame, .goog-te-menu-frame, [id*="goog"]');
      
      // Check for other translation tools
      const hasMicrosoftTranslate = !!document.querySelector('[id*="microsoft"], [class*="microsoft"]');
      const hasDeepLTranslate = !!document.querySelector('[id*="deepl"], [class*="deepl"]');
      
      const isTranslatingNow = hasGoogleTranslate || hasMicrosoftTranslate || hasDeepLTranslate || 
                               document.documentElement.lang !== language;
      
      setIsTranslating(isTranslatingNow);
      
      if (isTranslatingNow) {
        // Apply protective styles to prevent layout breaks
        document.body.style.overflowX = 'hidden';
        document.body.style.wordBreak = 'break-word';
        document.body.style.wordWrap = 'break-word';
        
        // Add translation-safe class
        document.documentElement.classList.add('translation-active');
      } else {
        document.body.style.overflowX = '';
        document.body.style.wordBreak = '';
        document.body.style.wordWrap = '';
        document.documentElement.classList.remove('translation-active');
      }
    };

    // Initial detection
    detectLanguage();
    
    // Monitor for translation changes
    const observer = new MutationObserver(() => {
      checkForTranslation();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'id', 'lang', 'style']
    });

    // Also check periodically for dynamic changes
    const interval = setInterval(checkForTranslation, 2000);

    // Listen for language changes
    const handleLanguageChange = () => {
      detectLanguage();
    };
    
    window.addEventListener('languagechange', handleLanguageChange);

    return () => {
      observer.disconnect();
      clearInterval(interval);
      window.removeEventListener('languagechange', handleLanguageChange);
      document.body.style.overflowX = '';
      document.body.style.wordBreak = '';
      document.body.style.wordWrap = '';
      document.documentElement.classList.remove('translation-active');
    };
  }, [language]);

  return { language, isTranslating, isClient };
};

export const getSafeLanguage = (lang: string): string => {
  const supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi'];
  const primaryLang = lang.split('-')[0];
  return supportedLanguages.includes(primaryLang) ? primaryLang : 'en';
};

export const isTranslationSafe = (): boolean => {
  if (typeof window === 'undefined') return true;
  
  const hasGoogleTranslate = !!document.querySelector('.goog-te-banner-frame, .goog-te-menu-frame, [id*="goog"]');
  const hasMicrosoftTranslate = !!document.querySelector('[id*="microsoft"], [class*="microsoft"]');
  const hasDeepLTranslate = !!document.querySelector('[id*="deepl"], [class*="deepl"]');
  
  return !hasGoogleTranslate && !hasMicrosoftTranslate && !hasDeepLTranslate;
};