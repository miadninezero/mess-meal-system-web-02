export type WalkthroughTab =
  | 'dashboard'
  | 'meals'
  | 'bazaar'
  | 'bills'
  | 'deposits'
  | 'settlement';

export type WalkthroughAudience = 'all' | 'member' | 'manager';

export interface DemoWalkthroughStep {
  id: string;
  tab: WalkthroughTab;
  tabLabel: string;
  audience: 'member' | 'manager' | 'both';
  audienceLabel: string;
  title: string;
  summary: string;
  tips: string[];
}

export const DEMO_WALKTHROUGH_STEPS: DemoWalkthroughStep[] = [
  {
    id: 'welcome',
    tab: 'dashboard',
    tabLabel: 'Dashboard',
    audience: 'both',
    audienceLabel: 'Getting Started',
    title: 'Welcome to Demo Mess',
    summary:
      'Explore Green View Bachelor Mess safely with sample data. You are signed in as Tanvir Hasan (Mess Manager), so you can try both daily member actions and admin controls.',
    tips: [
      'Move through screens anytime using the left menu (or bottom bar on mobile).',
      'Click "Reset Demo Data" in the sidebar whenever you want a fresh starting state.',
    ],
  },
  {
    id: 'dashboard-summary',
    tab: 'dashboard',
    tabLabel: 'Dashboard',
    audience: 'both',
    audienceLabel: 'How It Works',
    title: 'Live Meal Rate & Member Summary',
    summary:
      'Your net balance updates automatically whenever meals, bazaar runs, or deposits change. Scroll down for the 6-month finance chart and Member Summary table.',
    tips: [
      'Meal Rate = Total Bazaar Cost ÷ Total Confirmed Meal Units.',
      'Refundable (+৳) means your deposit exceeds your share; Payable (-৳) shows dues.',
    ],
  },
  {
    id: 'member-meals',
    tab: 'meals',
    tabLabel: 'Meal Operations',
    audience: 'member',
    audienceLabel: 'Member Flow',
    title: 'Daily Meal Booking & Weighting',
    summary:
      'Members book or cancel Lunch (1.5u), Night (1.0u), or Both (2.0u) before Asia/Dhaka cutoffs. Turn on Auto-Book to reserve meals automatically each day.',
    tips: [
      'Use Guest Lunch / Guest Night counters to add visitor portions to your count.',
      'Fridays serve Lunch only (1.0u); Night service closes automatically.',
    ],
  },
  {
    id: 'manager-meals',
    tab: 'meals',
    tabLabel: 'Meal Operations',
    audience: 'manager',
    audienceLabel: 'Admin & Manager',
    title: 'Manager Meal & Kitchen Controls',
    summary:
      'Managers oversee daily kitchen operations from here: set booking cutoffs, cancel services on holidays, and lock final kitchen headcounts for the cook.',
    tips: [
      'Use "Deadlines" and "Service Status" at the top right to manage daily schedules.',
      'Open Kitchen Roster or Attendance tabs to override locked bookings (with an audit reason) or confirm plates served.',
    ],
  },
  {
    id: 'bazaar-log',
    tab: 'bazaar',
    tabLabel: 'Bazaar Log',
    audience: 'both',
    audienceLabel: 'How It Works',
    title: 'Tracking Daily Bazaar Expenses',
    summary:
      'Log daily grocery and market purchases with buyer, category, and date. Every bazaar entry immediately updates the live meal rate across all members.',
    tips: [
      'Click "+ Log Bazaar Expense" to test adding a new market purchase.',
      'Filter by Groceries, Meat & Fish, Vegetables, or Spices to review spending.',
    ],
  },
  {
    id: 'shared-bills',
    tab: 'bills',
    tabLabel: 'Shared Bills',
    audience: 'manager',
    audienceLabel: 'Admin & Manager',
    title: 'Publishing Shared Bills & Payments',
    summary:
      'Managers create shared apartment bills (Wi-Fi, electricity, maid) split Equally, Fixed per Head, or Custom per Member—sending instant alerts to assigned roommates.',
    tips: [
      'Click "+ Create Shared Bill" to publish a new bill and trigger member alerts.',
      'Expand any bill card and click "Record Payment" to mark full or partial payments.',
    ],
  },
  {
    id: 'deposits',
    tab: 'deposits',
    tabLabel: 'Deposits',
    audience: 'manager',
    audienceLabel: 'Admin & Manager',
    title: 'Recording Member Deposits',
    summary:
      'Managers log advance deposits (Cash, bKash/Nagad, Bank) into the central mess fund so buyers have cash ready for daily bazaar trips.',
    tips: [
      'Click "Record Member Deposit" to credit any member balance immediately.',
      'Only Managers can add, edit, or delete deposits; every change is recorded in the audit trail.',
    ],
  },
  {
    id: 'settlement-roles',
    tab: 'settlement',
    tabLabel: 'Balance & Settlement',
    audience: 'manager',
    audienceLabel: 'Admin & Manager',
    title: 'Month-End Settlement & Member Roles',
    summary:
      'At month-end, Managers add fixed Utility Bills, review final Refund or Payable balances, inspect the immutable Audit Trail, and export the CSV report.',
    tips: [
      'Click "Members & Roles" in the top bar to promote a co-manager, demote, or resign & hand over leadership.',
      'Toggle members Active/Inactive in the settlement table to control equal utility splits.',
    ],
  },
];

export function getFilteredWalkthroughSteps(
  audience: WalkthroughAudience
): DemoWalkthroughStep[] {
  if (audience === 'all') return DEMO_WALKTHROUGH_STEPS;
  return DEMO_WALKTHROUGH_STEPS.filter(
    (step) => step.audience === audience || step.audience === 'both'
  );
}

export function clampWalkthroughIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, Math.floor(index)));
}

export function getWalkthroughProgressPercent(index: number, total: number): number {
  if (total <= 0) return 0;
  const clamped = clampWalkthroughIndex(index, total);
  return Math.round(((clamped + 1) / total) * 100);
}
