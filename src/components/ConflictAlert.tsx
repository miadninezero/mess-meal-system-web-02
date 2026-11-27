import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useMess } from '../context/MessContext';

export function ConflictAlert({
  compact = false,
  onReloaded,
}: {
  compact?: boolean;
  onReloaded?: () => void;
}) {
  const { conflictState, clearConflict, reloadLatestData } = useMess();
  const [isReloading, setIsReloading] = useState(false);

  if (!conflictState) return null;

  const handleReload = async () => {
    if (isReloading) return;
    setIsReloading(true);
    try {
      await reloadLatestData();
      onReloaded?.();
    } finally {
      setIsReloading(false);
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`rounded-xl border border-amber-300 bg-amber-50 text-amber-950 dark:border-[#A63D0A] dark:bg-[#3A1E12] dark:text-[#FFDBCF] ${
        compact ? 'p-3 text-xs space-y-2' : 'p-4 text-sm space-y-3'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <AlertTriangle
            className={`${compact ? 'w-4 h-4 mt-0.5' : 'w-5 h-5 mt-0.5'} text-[#C05621] dark:text-[#FFB59A] shrink-0`}
            aria-hidden="true"
          />
          <div className="space-y-1 min-w-0">
            <div className="font-display font-bold text-[#381400] dark:text-[#FFDBCF]">
              Record Updated by Another User
            </div>
            <p className="text-amber-900 dark:text-[#EDE0DB] leading-relaxed">
              {conflictState.message}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={clearConflict}
          aria-label="Dismiss conflict notice"
          className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#52443E] dark:text-[#D7C3BC] shrink-0 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-6 sm:pl-7">
        <button
          type="button"
          disabled={isReloading}
          onClick={handleReload}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{isReloading ? 'Reloading...' : 'Reload Latest Data'}</span>
        </button>
      </div>
    </div>
  );
}
