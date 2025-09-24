'use client';

import { useTheme } from '@/contexts/ThemeContext';

export function DarkModeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex items-center gap-2">
      {/* Emoji indicator */}
      <span className="text-lg transition-opacity duration-300">
        {theme === 'light' ? '☀️' : '🌙'}
      </span>
      
      <button
        onClick={toggleTheme}
        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800"
        style={{
          backgroundColor: theme === 'dark' ? '#3B82F6' : '#E5E7EB'
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