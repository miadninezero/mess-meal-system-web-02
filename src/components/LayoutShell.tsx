import React, { useState } from 'react';
import {
  LayoutDashboard,
  Utensils,
  ShoppingBag,
  ReceiptText,
  Wallet,
  Scale,
  Bell,
  Users,
  Copy,
  Check,
  LogOut,
  ArrowLeftRight,
  RotateCcw,
  X,
  ShieldCheck,
} from 'lucide-react';
import { NavTab, useMess } from '../context/MessContext';
import { Member } from '../types/mess';
import { formatCurrency, formatTimestampDhaka } from '../utils/dhakaTime';
import { MessLogo } from './MessLogo';

const NAV_ITEMS: {
  id: NavTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard },
  { id: 'meals', label: 'Meal Operations', shortLabel: 'Meals', icon: Utensils },
  { id: 'bazaar', label: 'Bazaar Log', shortLabel: 'Bazaar', icon: ShoppingBag },
  { id: 'bills', label: 'Shared Bills', shortLabel: 'Bills', icon: ReceiptText },
  { id: 'deposits', label: 'Deposits', shortLabel: 'Deposit', icon: Wallet },
  { id: 'settlement', label: 'Balance & Settlement', shortLabel: 'Balance', icon: Scale },
];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const {
    authUser,
    isDemoMode,
    currentMess,
    members,
    activeNav,
    setActiveNav,
    isManager,
    unreadNotificationsCount,
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    promoteMemberToManager,
    demoteManagerToMember,
    resignAsManager,
    resetDemoWorkspace,
    signOut,
    uiMessage,
    clearUiMessage,
    showUiMessage,
  } = useMess();

  const [copiedId, setCopiedId] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [confirmPromote, setConfirmPromote] = useState<Member | null>(null);
  const [confirmDemote, setConfirmDemote] = useState<Member | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [resignSuccessorId, setResignSuccessorId] = useState<string>('');

  const activeNavMeta = NAV_ITEMS.find((n) => n.id === activeNav) ?? NAV_ITEMS[0];

  const handleCopyMessId = async () => {
    if (!currentMess?.id) return;
    try {
      await navigator.clipboard.writeText(currentMess.id);
      setCopiedId(true);
      showUiMessage(`Mess Code '${currentMess.id}' copied to clipboard.`);
      window.setTimeout(() => setCopiedId(false), 2000);
    } catch {
      showUiMessage(`Mess ID: ${currentMess.id}`);
    }
  };

  const otherMembers = members.filter((m) => m.userId !== authUser?.uid);

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-[#201A17] flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-[#E8D9D3] z-20">
        <div className="h-16 px-5 flex items-center gap-2.5 border-b border-[#E8D9D3] shrink-0">
          <MessLogo className="w-8 h-8 rounded-lg" />
          <span className="font-display text-lg font-bold tracking-tight text-[#201A17] whitespace-nowrap">
            Mess Meal
          </span>
        </div>

        <div className="p-4 border-b border-[#E8D9D3] space-y-2">
          <div className="text-xs font-medium text-[#85736D]">
            {isDemoMode ? 'Demo Workspace' : 'Active Mess'}
          </div>
          <div className="font-display font-semibold text-sm text-[#201A17] truncate">
            {currentMess?.name || 'Loading Mess...'}
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-[#52443E] font-mono tabular-nums">
            <span className="truncate">{currentMess?.id}</span>
            <button
              type="button"
              onClick={handleCopyMessId}
              aria-label="Copy Mess ID"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-sans font-medium text-[#381400] bg-[#F4DFD7]/70 hover:bg-[#FFDBCF] rounded-lg transition-colors shrink-0 cursor-pointer"
            >
              {copiedId ? (
                <Check className="w-3 h-3 text-[#0D7351]" />
              ) : (
                <Copy className="w-3 h-3 text-[#C05621]" />
              )}
              <span>{copiedId ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        <nav aria-label="Primary Navigation" className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#FFDBCF] text-[#381400] font-semibold'
                    : 'text-[#52443E] hover:bg-[#F4DFD7]/50 hover:text-[#201A17]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? 'text-[#C05621]' : 'text-[#85736D]'}`}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#E8D9D3] space-y-3">
          <div className="space-y-0.5">
            <div className="text-sm font-semibold text-[#201A17] truncate">
              {authUser?.displayName}
            </div>
            <div className="text-xs text-[#52443E]">
              {isManager ? 'Mess Manager' : 'Mess Member'} · {currentMess?.activeMonth}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setActiveNav('mess_select')}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#52443E] bg-[#F4DFD7]/50 hover:bg-[#F4DFD7] rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-[#C05621]" aria-hidden="true" />
              <span>Switch / Join Mess</span>
            </button>
            {isDemoMode && (
              <button
                type="button"
                onClick={resetDemoWorkspace}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#52443E] bg-[#F4DFD7]/50 hover:bg-[#F4DFD7] rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#C05621]" aria-hidden="true" />
                <span>Reset Demo Data</span>
              </button>
            )}
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#52443E] hover:bg-[#FFDAD6] hover:text-[#410002] rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header Bar (h-12 on mobile <= 15% sticky budget, h-16 on desktop) */}
        <header className="sticky top-0 z-10 bg-[#FCFAF7]/95 backdrop-blur-sm border-b border-[#E8D9D3] h-12 lg:h-16 px-4 lg:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <MessLogo className="lg:hidden w-6 h-6 rounded-md" />
            <h1 className="font-display text-sm lg:text-base font-semibold text-[#201A17] truncate">
              {activeNavMeta.label}
            </h1>
            <span className="hidden sm:inline text-xs text-[#52443E] whitespace-nowrap">
              · {currentMess?.name}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowRolesModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#52443E] bg-white border border-[#E8D9D3] hover:bg-[#F4DFD7]/40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-[#C05621]" aria-hidden="true" />
              <span className="hidden sm:inline">Members &amp; Roles</span>
              <span className="sm:hidden">Members</span>
            </button>

            <button
              type="button"
              onClick={() => setShowNotifications(true)}
              aria-label={`Notifications (${unreadNotificationsCount} unread)`}
              className="relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#52443E] bg-white border border-[#E8D9D3] hover:bg-[#F4DFD7]/40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-[#C05621]" aria-hidden="true" />
              <span className="hidden sm:inline">Alerts</span>
              {unreadNotificationsCount > 0 && (
                <span className="font-mono tabular-nums text-xs font-semibold text-[#BA1A1A]">
                  ({unreadNotificationsCount})
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveNav('meals')}
              className="hidden md:inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Manage Meals
            </button>
          </div>
        </header>

        {/* Feedback Toast */}
        {uiMessage && (
          <div className="px-4 lg:px-8 pt-4 max-w-5xl w-full mx-auto">
            <div
              role="status"
              className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-sm ${
                uiMessage.tone === 'error'
                  ? 'bg-[#FFDAD6] border-[#F2B8B5] text-[#410002]'
                  : 'bg-[#FFDBCF]/80 border-[#F2C3B2] text-[#381400]'
              }`}
            >
              <span>{uiMessage.text}</span>
              <button
                type="button"
                onClick={clearUiMessage}
                aria-label="Dismiss notification"
                className="p-1 rounded hover:bg-black/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Viewport Content */}
        <main className="flex-1 px-4 lg:px-8 py-5 pb-20 lg:pb-10 max-w-5xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (matches Android NavigationBar: Home, Meals, Bazaar, Bills, Deposit, Balance) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 h-14 bg-[#FCFAF7] border-t border-[#E8D9D3] z-20 grid grid-cols-6"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveNav(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                active ? 'text-[#C05621] font-semibold' : 'text-[#52443E] hover:text-[#201A17]'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span className="truncate max-w-full px-1">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Notifications Modal */}
      {showNotifications && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="notifications-modal-title"
          className="fixed inset-0 z-50 bg-[#201A17]/40 flex items-center justify-center p-4"
        >
          <div className="bg-[#FCFAF7] border border-[#E8D9D3] rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b border-[#E8D9D3] flex items-center justify-between">
              <div>
                <h2 id="notifications-modal-title" className="font-display font-bold text-[#201A17]">
                  In-App Notifications
                </h2>
                <p className="text-xs text-[#52443E]">{unreadNotificationsCount} unread alert(s)</p>
              </div>
              <div className="flex items-center gap-2">
                {unreadNotificationsCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsAsRead}
                    className="text-xs font-semibold text-[#C05621] hover:text-[#A3471B] cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  aria-label="Close notifications modal"
                  className="p-1.5 text-[#52443E] hover:text-[#201A17] rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-2.5">
              {notifications.length === 0 ? (
                <p className="text-sm text-[#52443E] py-6 text-center">
                  No notifications yet. Shared bill alerts will appear here.
                </p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3.5 rounded-xl border space-y-1 ${
                      n.isRead
                        ? 'bg-white border-[#E8D9D3]'
                        : 'bg-[#FFDBCF]/50 border-[#F2C3B2]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold text-[#201A17]">{n.title}</div>
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={() => markNotificationAsRead(n.id)}
                          className="text-xs font-semibold text-[#C05621] hover:underline shrink-0 cursor-pointer"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-[#52443E]">{n.message}</p>
                    <div className="text-xs text-[#85736D] font-mono tabular-nums">
                      {formatCurrency(n.amount)} · {formatTimestampDhaka(n.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mess Members & Roles Modal */}
      {showRolesModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="roles-modal-title"
          className="fixed inset-0 z-50 bg-[#201A17]/40 flex items-center justify-center p-4"
        >
          <div className="bg-[#FCFAF7] border border-[#E8D9D3] rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b border-[#E8D9D3] flex items-center justify-between">
              <div>
                <h2 id="roles-modal-title" className="font-display font-bold text-[#201A17]">
                  Mess Members &amp; Roles
                </h2>
                <p className="text-xs text-[#52443E]">
                  {members.length} registered member(s) · Mess ID:{' '}
                  <span className="font-mono">{currentMess?.id}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRolesModal(false)}
                aria-label="Close members modal"
                className="p-1.5 text-[#52443E] hover:text-[#201A17] rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              {members.map((member) => {
                const isThisManager =
                  member.role === 'MANAGER' ||
                  currentMess?.managerUid === member.userId ||
                  (currentMess?.adminUids ?? []).includes(member.userId);
                const isSelf = member.userId === authUser?.uid;

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-[#E8D9D3] bg-white"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#201A17]">
                        <span className="truncate">{member.displayName}</span>
                        {isSelf && <span className="text-xs font-normal text-[#85736D]">(You)</span>}
                      </div>
                      <div className="text-xs text-[#52443E]">
                        {member.room ? `Room ${member.room} · ` : ''}
                        <span className={isThisManager ? 'text-[#C05621] font-semibold' : ''}>
                          {isThisManager ? 'Manager' : 'Member'}
                        </span>
                        {' · '}
                        {member.isActive ? 'Active' : 'Inactive'}
                      </div>
                    </div>

                    {isManager && !isSelf && (
                      <div className="shrink-0">
                        {isThisManager ? (
                          <button
                            type="button"
                            onClick={() => setConfirmDemote(member)}
                            className="px-3 py-1.5 text-xs font-medium text-[#BA1A1A] border border-[#F2B8B5] hover:bg-[#FFDAD6] rounded-lg transition-colors cursor-pointer"
                          >
                            Demote
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmPromote(member)}
                            className="px-3 py-1.5 text-xs font-medium text-[#C05621] border border-[#F2C3B2] hover:bg-[#FFDBCF] rounded-lg transition-colors cursor-pointer"
                          >
                            Make Manager
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {isManager && (
                <div className="pt-3 border-t border-[#E8D9D3] flex items-center justify-between gap-3">
                  <div className="text-xs text-[#52443E] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#C05621] shrink-0" />
                    <span>Hand over leadership or step down from Manager role.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmResign(true)}
                    className="px-3.5 py-2 text-xs font-semibold text-[#BA1A1A] bg-[#FFDAD6] hover:bg-[#f7c5bf] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Resign as Manager
                  </button>
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 lg:hidden">
                <button
                  type="button"
                  onClick={() => {
                    setShowRolesModal(false);
                    setActiveNav('mess_select');
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-[#52443E] border border-[#E8D9D3] bg-white rounded-lg"
                >
                  Switch / Join Mess
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  className="px-3 py-1.5 text-xs font-medium text-[#BA1A1A] border border-[#F2B8B5] bg-white rounded-lg"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Promote Confirmation */}
      {confirmPromote && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] bg-[#201A17]/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8D9D3] rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display font-bold text-[#201A17]">Promote to Manager?</h3>
            <p className="text-sm text-[#52443E]">
              Promote <strong>{confirmPromote.displayName}</strong> to Manager? They will gain full
              permission to configure deadlines, manage deposits, publish shared bills, and override
              locked bookings.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmPromote(null)}
                className="px-4 py-2 text-sm font-medium text-[#52443E] border border-[#E8D9D3] rounded-lg hover:bg-[#F4DFD7]/40 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = confirmPromote;
                  setConfirmPromote(null);
                  await promoteMemberToManager(target);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] rounded-lg cursor-pointer"
              >
                Promote to Manager
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Demote Confirmation */}
      {confirmDemote && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] bg-[#201A17]/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8D9D3] rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display font-bold text-[#201A17]">Remove Manager Role?</h3>
            <p className="text-sm text-[#52443E]">
              Change <strong>{confirmDemote.displayName}</strong> from Manager back to regular
              Member?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDemote(null)}
                className="px-4 py-2 text-sm font-medium text-[#52443E] border border-[#E8D9D3] rounded-lg hover:bg-[#F4DFD7]/40 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = confirmDemote;
                  setConfirmDemote(null);
                  await demoteManagerToMember(target);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#BA1A1A] hover:bg-[#93000A] rounded-lg cursor-pointer"
              >
                Remove Manager
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resign Manager Confirmation */}
      {confirmResign && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] bg-[#201A17]/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8D9D3] rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display font-bold text-[#201A17]">Resign as Manager?</h3>
            <p className="text-sm text-[#52443E]">
              Optionally select a successor to transfer leadership, or step down if another manager
              is already assigned.
            </p>
            {otherMembers.length > 0 && (
              <div>
                <label htmlFor="successor-select" className="block text-xs font-medium text-[#52443E] mb-1">
                  Handover Successor (Optional)
                </label>
                <select
                  id="successor-select"
                  value={resignSuccessorId}
                  onChange={(e) => setResignSuccessorId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E8D9D3] rounded-lg"
                >
                  <option value="">No specific handover (keep existing managers)</option>
                  {otherMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName} ({m.room || 'Member'})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmResign(false);
                  setResignSuccessorId('');
                }}
                className="px-4 py-2 text-sm font-medium text-[#52443E] border border-[#E8D9D3] rounded-lg hover:bg-[#F4DFD7]/40 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const successor = members.find((m) => m.id === resignSuccessorId) || null;
                  setConfirmResign(false);
                  setResignSuccessorId('');
                  await resignAsManager(successor);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#BA1A1A] hover:bg-[#93000A] rounded-lg cursor-pointer"
              >
                Confirm Resignation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
