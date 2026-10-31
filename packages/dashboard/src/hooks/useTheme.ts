import { useEffect, useState } from 'react';
import type { Theme } from '../types/domain';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem('sensorguard-theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('sensorguard-theme', theme);
    } catch {
      /* The interface remains usable when storage is unavailable. */
    }
  }, [theme]);
  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  return { theme, toggleTheme };
}
