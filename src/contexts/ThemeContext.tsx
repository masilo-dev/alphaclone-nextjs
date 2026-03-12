import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
  resetToDefault: () => void;
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

  useEffect(() => {
    const savedColor = localStorage.getItem('dashboard-bg-color');
    if (savedColor) {
      setBackgroundColor(savedColor);
      document.documentElement.style.setProperty('--dashboard-bg', savedColor);
    }
  }, []);

  const handleSetBackgroundColor = (color: string) => {
    setBackgroundColor(color);
    localStorage.setItem('dashboard-bg-color', color);
    document.documentElement.style.setProperty('--dashboard-bg', color);
  };

  const resetToDefault = () => {
    handleSetBackgroundColor('#0f172a');
  };

  return (
    <ThemeContext.Provider value={{
      backgroundColor,
      setBackgroundColor: handleSetBackgroundColor,
      resetToDefault
    }}>
      {children}
    </ThemeContext.Provider>
  );
};