import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Maximize2,
  Minus,
  RotateCcw,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { useMess } from '../context/MessContext';
import {
  WalkthroughAudience,
  clampWalkthroughIndex,
  getFilteredWalkthroughSteps,
  getWalkthroughProgressPercent,
} from '../utils/demoWalkthroughSteps';

export function DemoWalkthrough() {
  const {
    isDemoMode,
    isWalkthroughOpen,
    walkthroughRunId,
    closeWalkthrough,
    setActiveNav,
  } = useMess();

  const [audience, setAudience] = useState<WalkthroughAudience>('all');
  const [stepIndex, setStepIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  const steps = useMemo(() => getFilteredWalkthroughSteps(audience), [audience]);
  const safeIndex = clampWalkthroughIndex(stepIndex, steps.length);
  const currentStep = steps[safeIndex] ?? steps[0];
  const progressPercent = getWalkthroughProgressPercent(safeIndex, steps.length);

  // Reset to Step 1 whenever the tour is explicitly opened or restarted
  useEffect(() => {
    if (!isWalkthroughOpen) return;
    setAudience('all');
    setStepIndex(0);
    setIsMinimized(false);
  }, [isWalkthroughOpen, walkthroughRunId]);

  // Navigate to the screen that corresponds to the current walkthrough step
  useEffect(() => {
    if (!isDemoMode || !isWalkthroughOpen || !currentStep) return;
    setActiveNav(currentStep.tab);
  }, [currentStep, isDemoMode, isWalkthroughOpen, setActiveNav]);

  if (!isDemoMode || !isWalkthroughOpen || !currentStep) {
    return null;
  }

  const handleAudienceChange = (nextAudience: WalkthroughAudience) => {
    setAudience(nextAudience);
    setStepIndex(0);
  };

  const handlePrev = () => {
    setStepIndex((prev) => clampWalkthroughIndex(prev - 1, steps.length));
  };

  const handleNext = () => {
    if (safeIndex >= steps.length - 1) {
      closeWalkthrough();
      return;
    }
    setStepIndex((prev) => clampWalkthroughIndex(prev + 1, steps.length));
  };

  if (isMinimized) {
    return (
      <div
        role="region"
        aria-label="Demo Walkthrough Minimized"
        className="fixed z-40 bottom-16 right-3 lg:bottom-5 lg:right-5 bg-white dark:bg-[#221B18] border border-[#F2C3B2] dark:border-[#842B00] rounded-2xl shadow-lg px-3.5 py-2.5 flex items-center gap-2.5 max-w-[calc(100vw-1.5rem)]"
      >
        <Compass className="w-4 h-4 text-[#C05621] dark:text-[#FFB59A] shrink-0" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="text-xs font-semibold text-[#201A17] dark:text-[#EDE0DB] hover:text-[#C05621] dark:hover:text-[#FFB59A] truncate cursor-pointer"
        >
          Demo Guide · Step {safeIndex + 1}/{steps.length}
        </button>
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          aria-label="Expand demo walkthrough"
          className="p-1 text-[#52443E] dark:text-[#D7C3BC] hover:text-[#201A17] dark:hover:text-[#EDE0DB] rounded cursor-pointer shrink-0"
        >
          <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={closeWalkthrough}
          aria-label="Close demo walkthrough"
          className="p-1 text-[#52443E] dark:text-[#D7C3BC] hover:text-[#BA1A1A] dark:hover:text-[#FFB4AB] rounded cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  const audienceTextColor =
    currentStep.audience === 'manager'
      ? 'text-[#C05621] dark:text-[#FFB59A]'
      : currentStep.audience === 'member'
        ? 'text-[#0D7351] dark:text-[#89D6B7]'
        : 'text-[#2C5E8A] dark:text-[#98CBFA]';

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="demo-walkthrough-title"
      className="fixed z-40 bottom-16 left-3 right-3 sm:left-auto sm:right-5 lg:bottom-5 sm:w-[390px] max-h-[60vh] sm:max-h-[82vh] flex flex-col bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#52443E] rounded-2xl shadow-xl overflow-hidden"
    >
      {/* Progress Bar */}
      <div className="h-1 w-full bg-[#F4DFD7] dark:bg-[#352A25] shrink-0">
        <div
          className="h-full bg-[#C05621] dark:bg-[#FFB59A] transition-all duration-200"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Header */}
      <div className="px-4 py-3 border-b border-[#E8D9D3] dark:border-[#3E322D] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-[#FFDBCF] dark:bg-[#842B00] flex items-center justify-center shrink-0">
            <Compass className="w-3.5 h-3.5 text-[#C05621] dark:text-[#FFB59A]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#201A17] dark:text-[#EDE0DB] truncate">
              Demo Mess Walkthrough
            </div>
            <div className="text-[11px] font-mono tabular-nums text-[#85736D] dark:text-[#A08C86]">
              Step {safeIndex + 1} of {steps.length} · {currentStep.tabLabel}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            aria-label="Minimize demo walkthrough"
            className="p-1.5 text-[#52443E] dark:text-[#D7C3BC] hover:bg-[#F4DFD7]/50 dark:hover:bg-[#352A25] rounded-lg transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={closeWalkthrough}
            aria-label="Close demo walkthrough"
            className="p-1.5 text-[#52443E] dark:text-[#D7C3BC] hover:text-[#BA1A1A] dark:hover:text-[#FFB4AB] hover:bg-[#FFDAD6]/40 dark:hover:bg-[#93000A]/30 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Role Track Filter */}
      <div className="px-4 pt-2.5 pb-1 shrink-0">
        <div
          role="tablist"
          aria-label="Walkthrough role track"
          className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#F4DFD7]/55 dark:bg-[#171210]"
        >
          {(
            [
              { id: 'all', label: 'All Steps' },
              { id: 'member', label: 'Member' },
              { id: 'manager', label: 'Admin/Mgr' },
            ] as const
          ).map((item) => {
            const active = audience === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleAudienceChange(item.id)}
                className={`py-1 px-2 text-[11px] font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-[#352A25] text-[#201A17] dark:text-[#EDE0DB] shadow-xs'
                    : 'text-[#52443E] dark:text-[#D7C3BC] hover:text-[#201A17] dark:hover:text-[#EDE0DB]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3 overflow-y-auto">
        <div className="space-y-1">
          <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${audienceTextColor}`}>
            {currentStep.audience === 'manager' ? (
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <User className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{currentStep.audienceLabel}</span>
          </div>

          <h3
            id="demo-walkthrough-title"
            className="font-display text-base font-bold text-[#201A17] dark:text-[#EDE0DB]"
          >
            {currentStep.title}
          </h3>

          <p className="text-xs leading-relaxed text-[#52443E] dark:text-[#D7C3BC]">
            {currentStep.summary}
          </p>
        </div>

        <ul className="bg-[#F4DFD7]/40 dark:bg-[#352A25]/60 border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl p-3 space-y-1.5 text-xs text-[#201A17] dark:text-[#EDE0DB]">
          {currentStep.tips.map((tip) => (
            <li key={tip} className="flex items-start gap-2 leading-snug">
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#C05621] dark:bg-[#FFB59A] mt-1.5 shrink-0"
                aria-hidden="true"
              />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer Navigation */}
      <div className="px-4 py-3 border-t border-[#E8D9D3] dark:border-[#3E322D] bg-[#FCFAF7] dark:bg-[#171210]/60 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setStepIndex(0)}
          disabled={safeIndex === 0}
          aria-label="Restart walkthrough from step 1"
          className="inline-flex items-center gap-1 text-xs font-medium text-[#85736D] hover:text-[#201A17] dark:text-[#A08C86] dark:hover:text-[#EDE0DB] disabled:opacity-40 cursor-pointer disabled:cursor-default whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3 h-3" aria-hidden="true" />
          <span>Restart</span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePrev}
            disabled={safeIndex === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#52443E] dark:text-[#D7C3BC] bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] hover:bg-[#F4DFD7]/50 dark:hover:bg-[#352A25] disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-default"
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:text-[#5F1B00] dark:hover:bg-[#ffc7b2] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{safeIndex >= steps.length - 1 ? 'Finish' : 'Next'}</span>
            {safeIndex < steps.length - 1 && (
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
