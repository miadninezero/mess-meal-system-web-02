import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

export function ThemeToggle({ compact = false, className = '' }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer bg-white text-[#52443E] border-[#E8D9D3] hover:bg-[#F4DFD7]/40 dark:bg-[#221B18] dark:text-[#D7C3BC] dark:border-[#3E322D] dark:hover:bg-[#352A25] ${className}`}
    >
      {isDark ? (
        <Sun className="w-3.5 h-3.5 text-[#FFB59A]" aria-hidden="true" />
      ) : (
        <Moon className="w-3.5 h-3.5 text-[#C05621]" aria-hidden="true" />
      )}
      {!compact && <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>}
    </button>
  );
}
