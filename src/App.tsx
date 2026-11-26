import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LayoutShell } from './components/LayoutShell';
import { MessSelectView } from './components/MessSelectView';
import { SignInView } from './components/SignInView';
import { BazaarLogView } from './components/screens/BazaarLogView';
import { DailyMealsView } from './components/screens/DailyMealsView';
import { DashboardView } from './components/screens/DashboardView';
import { DepositsView } from './components/screens/DepositsView';
import { SettlementView } from './components/screens/SettlementView';
import { SharedBillsView } from './components/screens/SharedBillsView';
import { MessProvider, useMess } from './context/MessContext';

function MessWorkspaceRouter() {
  const { authMode, selectedMessId, activeNav } = useMess();

  if (authMode === 'loading') {
    return (
      <div className="min-h-screen bg-[#FCFAF7] flex items-center justify-center">
        <div className="text-sm font-medium text-[#52443E]">Loading Mess Meal...</div>
      </div>
    );
  }

  if (authMode === 'unauthenticated') {
    return <SignInView />;
  }

  if (!selectedMessId || activeNav === 'mess_select') {
    return <MessSelectView />;
  }

  return (
    <LayoutShell>
      {activeNav === 'dashboard' && <DashboardView />}
      {activeNav === 'meals' && <DailyMealsView />}
      {activeNav === 'bazaar' && <BazaarLogView />}
      {activeNav === 'bills' && <SharedBillsView />}
      {activeNav === 'deposits' && <DepositsView />}
      {activeNav === 'settlement' && <SettlementView />}
    </LayoutShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MessProvider>
        <MessWorkspaceRouter />
      </MessProvider>
    </ErrorBoundary>
  );
}
