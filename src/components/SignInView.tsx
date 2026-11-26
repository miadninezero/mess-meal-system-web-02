import React from 'react';
import { Calculator, PlayCircle, ShoppingBag, Users } from 'lucide-react';
import { useMess } from '../context/MessContext';
import { MessLogo } from './MessLogo';

export function SignInView() {
  const { signInWithGoogle, enterDemoMode, isSubmitting, uiMessage } = useMess();

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-[#201A17] flex flex-col justify-center px-6 py-10">
      <main className="max-w-md w-full mx-auto flex flex-col items-center text-center">
        {/* App Icon Graphic (matches SignInScreen.kt 96dp rounded-24dp container) */}
        <div className="w-24 h-24 rounded-3xl bg-[#FFDBCF] p-1.5 shadow-sm border border-[#F2C3B2] flex items-center justify-center">
          <MessLogo className="w-full h-full rounded-[18px]" alt="Mess Meal app logo" />
        </div>

        <h1
          className="mt-5 font-display text-3xl font-bold tracking-tight text-[#201A17]"
          style={{ textWrap: 'balance' }}
        >
          Mess Meal System
        </h1>

        <p className="mt-2 text-sm sm:text-base text-[#52443E] leading-relaxed px-2">
          The complete digital management suite for bachelor messes, hostels &amp; shared
          apartments.
        </p>

        {uiMessage && (
          <div
            role="alert"
            className={`mt-5 w-full p-3.5 rounded-xl border text-sm text-left ${
              uiMessage.tone === 'error'
                ? 'bg-[#FFDAD6] border-[#F2B8B5] text-[#410002]'
                : 'bg-[#A5F2D2]/60 border-[#7CD4B2] text-[#002115]'
            }`}
          >
            {uiMessage.text}
          </div>
        )}

        {/* Feature Highlights (exact 3 FeatureRow cards from SignInScreen.kt) */}
        <div className="mt-8 w-full space-y-3 text-left">
          <div className="flex items-center gap-3.5 p-3.5 rounded-[14px] bg-[#F4DFD7]/55 border border-[#E8D9D3]">
            <div className="w-10 h-10 rounded-full bg-[#FFDBCF] flex items-center justify-center shrink-0">
              <Calculator className="w-5 h-5 text-[#C05621]" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#201A17]">Automatic Meal Rate</div>
              <p className="text-xs text-[#52443E] leading-snug mt-0.5">
                Dynamic calculation based on live market grocery expenses and meal counts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-[14px] bg-[#F4DFD7]/55 border border-[#E8D9D3]">
            <div className="w-10 h-10 rounded-full bg-[#FFDBCF] flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5 text-[#C05621]" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#201A17]">Bazaar &amp; Deposit Ledger</div>
              <p className="text-xs text-[#52443E] leading-snug mt-0.5">
                Track daily market purchases and pooled deposit contributions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-[14px] bg-[#F4DFD7]/55 border border-[#E8D9D3]">
            <div className="w-10 h-10 rounded-full bg-[#FFDBCF] flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-[#C05621]" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[#201A17]">Multi-Member Sync</div>
              <p className="text-xs text-[#52443E] leading-snug mt-0.5">
                Roommates toggle meals on/off and audit end-of-month refund or dues
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Google Sign-In Button + Demo Workspace */}
        <div className="mt-9 w-full space-y-3">
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={isSubmitting}
            className="w-full h-14 inline-flex items-center justify-center gap-2.5 px-6 text-base font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] disabled:opacity-60 rounded-2xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{isSubmitting ? 'Signing in...' : 'Sign in with Google'}</span>
          </button>

          <button
            type="button"
            onClick={enterDemoMode}
            className="w-full h-12 inline-flex items-center justify-center gap-2 px-5 text-sm font-semibold text-[#52443E] bg-white border border-[#E8D9D3] hover:bg-[#F4DFD7]/50 rounded-2xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PlayCircle className="w-4 h-4 text-[#C05621]" aria-hidden="true" />
            <span>Open Demo Mess</span>
          </button>
        </div>

        <p className="mt-4 text-xs text-[#85736D]">
          Secured with Google Credential Manager &amp; Cloud Firestore
        </p>
      </main>
    </div>
  );
}
