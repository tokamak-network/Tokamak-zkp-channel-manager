'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export function DarkModeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex items-center gap-2">
      {/* Icon indicator */}
      <span className="transition-opacity duration-300">
        {theme === 'light' ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-blue-300" />}
      </span>
      
      <button
        onClick={toggleTheme}
        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-[#4fc3f7] focus:ring-offset-2 focus:ring-offset-[#0a1930]"
        style={{
          backgroundColor: theme === 'dark' ? '#4fc3f7' : '#E5E7EB'
        }}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
      {/* Toggle circle */}
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-300 ease-in-out ${
          theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
      </button>
    </div>
  );
}