import React, { useEffect, useState } from 'react';

interface TranslationSafeComponentProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const TranslationSafeComponent: React.FC<TranslationSafeComponentProps> = ({ 
  children, 
  fallback = null 
}) => {
  const [isSafe, setIsSafe] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    const checkTranslationSafety = () => {
      // Check for various translation tools
      const hasGoogleTranslate = !!document.querySelector('.goog-te-banner-frame, .goog-te-menu-frame, [id*="goog"]');
      const hasMicrosoftTranslate = !!document.querySelector('[id*="microsoft"], [class*="microsoft"]');
      const hasDeepLTranslate = !!document.querySelector('[id*="deepl"], [class*="deepl"]');
      const hasYandexTranslate = !!document.querySelector('[id*="yandex"], [class*="yandex"]');
      
      const isCurrentlyTranslating = hasGoogleTranslate || hasMicrosoftTranslate || hasDeepLTranslate || hasYandexTranslate;
      
      setIsSafe(!isCurrentlyTranslating);
      
      if (isCurrentlyTranslating) {
        // Apply protective styles
        document.body.style.overflowX = 'hidden';
        document.body.style.wordBreak = 'break-word';
        document.body.style.wordWrap = 'break-word';
        
        // Add protective class
        document.documentElement.classList.add('translation-active');
      } else {
        // Remove protective styles
        document.body.style.overflowX = '';
        document.body.style.wordBreak = '';
        document.body.style.wordWrap = '';
        document.documentElement.classList.remove('translation-active');
      }
    };

    // Initial check
    checkTranslationSafety();
    
    // Monitor for changes
    const observer = new MutationObserver(checkTranslationSafety);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'id', 'lang', 'style']
    });

    // Periodic checks for dynamic content
    const interval = setInterval(checkTranslationSafety, 1000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
      document.body.style.overflowX = '';
      document.body.style.wordBreak = '';
      document.body.style.wordWrap = '';
      document.documentElement.classList.remove('translation-active');
    };
  }, []);

  // Don't render on server to prevent hydration mismatch
  if (!isClient) {
    return null;
  }

  // If translation is detected and we have a fallback, use it
  if (!isSafe && fallback) {
    return <>{fallback}</>;
  }

  // Otherwise render normally
  return <>{children}</>;
};

export const TranslationSafeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div 
      className="translation-safe-wrapper"
      style={{ 
        contain: 'layout style paint',
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
        maxWidth: '100%'
      }}
      suppressHydrationWarning
    >
      {children}
    </div>
  );
};

// CSS to add to your global styles
export const translationSafeStyles = `
  .translation-active {
    overflow-x: hidden !important;
  }
  
  .translation-active body {
    overflow-x: hidden !important;
    word-break: break-word !important;
    word-wrap: break-word !important;
  }
  
  .translation-safe-wrapper {
    max-width: 100% !important;
    overflow-wrap: break-word !important;
    word-break: break-word !important;
    word-wrap: break-word !important;
  }
  
  /* Hide translation toolbars */
  .goog-te-banner-frame,
  .goog-te-menu-frame,
  [id*="goog"] {
    display: none !important;
  }
  
  /* Prevent layout breaks */
  .translation-active * {
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
`;