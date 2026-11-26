import React, { useState } from 'react';

export const MESS_LOGO_PATH = '/src/assets/images/mess_meal_icon.jpg';

interface MessLogoProps {
  className?: string;
  alt?: string;
}

export function MessLogo({ className = 'w-8 h-8 rounded-lg', alt = 'Mess Meal logo' }: MessLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        aria-label={alt}
        className={`${className} bg-[#D97706] flex items-center justify-center shrink-0 overflow-hidden`}
      >
        <svg viewBox="0 0 64 64" className="w-3/4 h-3/4 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 14v14a4 4 0 0 0 8 0V14" />
          <path d="M18 14v36" />
          <path d="M24 34c0 8 5 14 12 14s12-6 12-14H24Z" />
          <path d="M50 14c-3 0-4 4-4 8s1 7 4 7 4-3 4-7-1-8-4-8Zm0 15v21" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={MESS_LOGO_PATH}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} object-cover shrink-0`}
    />
  );
}
