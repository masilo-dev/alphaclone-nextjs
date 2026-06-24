import React, { createContext, useContext, useState, useEffect } from 'react';

type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextType {
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
  resetToDefault: () => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [backgroundColor, setBackgroundColor] = useState('#0f172a'); // slate-950 default
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [isDark, setIsDark] = useState(true);

  // Initialize from localStorage
  useEffect(() => {
    const savedColor = localStorage.getItem('dashboard-bg-color');
    const savedThemeMode = localStorage.getItem('theme-mode') as ThemeMode;
    
    if (savedColor) {
      setBackgroundColor(savedColor);
      document.documentElement.style.setProperty('--dashboard-bg', savedColor);
    }
    
    if (savedThemeMode && ['dark', 'light', 'system'].includes(savedThemeMode)) {
      setThemeModeState(savedThemeMode);
    }
  }, []);

  // Apply theme mode changes
  useEffect(() => {
    const applyTheme = () => {
      let shouldBeDark: boolean;
      
      if (themeMode === 'system') {
        shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      } else {
        shouldBeDark = themeMode === 'dark';
      }
      
      setIsDark(shouldBeDark);
      
      if (shouldBeDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      }
    };
    
    applyTheme();
    
    // Listen for system theme changes if in system mode
    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme();
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [themeMode]);

  const handleSetBackgroundColor = (color: string) => {
    setBackgroundColor(color);
    localStorage.setItem('dashboard-bg-color', color);
    document.documentElement.style.setProperty('--dashboard-bg', color);
  };

  const handleSetThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('theme-mode', mode);
  };

  const resetToDefault = () => {
    handleSetBackgroundColor('#0f172a');
    handleSetThemeMode('dark');
  };

  return (
    <ThemeContext.Provider value={{
      backgroundColor,
      setBackgroundColor: handleSetBackgroundColor,
      resetToDefault,
      themeMode,
      setThemeMode: handleSetThemeMode,
      isDark,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};