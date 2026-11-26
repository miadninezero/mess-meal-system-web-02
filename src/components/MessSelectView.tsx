import React, { useState } from 'react';
import { ArrowLeft, Building2, LogOut, UserPlus } from 'lucide-react';
import { useMess } from '../context/MessContext';
import { MessLogo } from './MessLogo';
import { ThemeToggle } from './ThemeToggle';

export function MessSelectView() {
  const {
    authUser,
    userMesses,
    selectedMessId,
    isSubmitting,
    createMess,
    joinMess,
    selectMess,
    signOut,
    setActiveNav,
  } = useMess();

  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [messName, setMessName] = useState('');
  const [managerName, setManagerName] = useState(authUser?.displayName || '');
  const [joinMessId, setJoinMessId] = useState('');
  const [memberName, setMemberName] = useState(authUser?.displayName || '');
  const [roomNumber, setRoomNumber] = useState('');
  const [formError, setFormError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!messName.trim() || !managerName.trim()) {
      setFormError('Please enter both a Mess Name and your Display Name.');
      return;
    }
    await createMess(messName.trim(), managerName.trim());
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!joinMessId.trim() || !memberName.trim()) {
      setFormError('Please provide the Mess ID / Code and your Full Name.');
      return;
    }
    await joinMess(joinMessId.trim(), memberName.trim(), roomNumber.trim());
  };

  return (
    <div className="min-h-screen bg-[#FCFAF7] dark:bg-[#171210] text-[#201A17] dark:text-[#EDE0DB] flex flex-col">
      <header className="bg-[#FCFAF7] dark:bg-[#171210] border-b border-[#E8D9D3] dark:border-[#3E322D]">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {selectedMessId ? (
              <button
                type="button"
                onClick={() => setActiveNav('dashboard')}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#52443E] dark:text-[#D7C3BC] hover:text-[#201A17] dark:hover:text-[#EDE0DB] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Dashboard</span>
              </button>
            ) : (
              <div className="flex items-center gap-2.5">
                <MessLogo className="w-8 h-8 rounded-lg" />
                <span className="font-display text-lg font-bold text-[#201A17] dark:text-[#EDE0DB]">
                  Mess Setup
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#52443E] dark:text-[#D7C3BC] bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-lg hover:bg-[#F4DFD7]/50 dark:hover:bg-[#352A25] transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-10 space-y-7">
        <div className="text-center space-y-1.5">
          <h1 className="font-display text-2xl font-bold text-[#201A17] dark:text-[#EDE0DB]">
            Welcome to Mess Meal
          </h1>
          <p className="text-sm text-[#52443E] dark:text-[#D7C3BC]">
            Create a mess as manager or join an existing flatmate mess group.
          </p>
        </div>

        {userMesses.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-[#201A17] dark:text-[#EDE0DB]">Your Messes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {userMesses.map((mess) => (
                <button
                  key={mess.id}
                  type="button"
                  onClick={() => selectMess(mess.id)}
                  className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                    mess.id === selectedMessId
                      ? 'bg-[#FFDBCF] dark:bg-[#842B00] border-[#C05621] dark:border-[#FFB59A] text-[#381400] dark:text-[#FFDBCF]'
                      : 'bg-white dark:bg-[#221B18] border-[#E8D9D3] dark:border-[#3E322D] hover:bg-[#F4DFD7]/40 dark:hover:bg-[#352A25]'
                  }`}
                >
                  <div className="font-display font-semibold">{mess.name}</div>
                  <div className="mt-1 text-xs opacity-80 font-mono tabular-nums">
                    ID: {mess.id} · {mess.memberUids.length} members · {mess.activeMonth}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-2xl p-6 space-y-6">
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#F4DFD7]/60 dark:bg-[#171210] rounded-xl">
            <button
              type="button"
              onClick={() => {
                setTab('create');
                setFormError('');
              }}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'create'
                  ? 'bg-white dark:bg-[#352A25] text-[#201A17] dark:text-[#EDE0DB] shadow-sm'
                  : 'text-[#52443E] dark:text-[#D7C3BC] hover:text-[#201A17] dark:hover:text-[#EDE0DB]'
              }`}
            >
              <Building2 className="w-4 h-4 text-[#C05621] dark:text-[#FFB59A]" />
              <span>Create New Mess</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('join');
                setFormError('');
              }}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'join'
                  ? 'bg-white dark:bg-[#352A25] text-[#201A17] dark:text-[#EDE0DB] shadow-sm'
                  : 'text-[#52443E] dark:text-[#D7C3BC] hover:text-[#201A17] dark:hover:text-[#EDE0DB]'
              }`}
            >
              <UserPlus className="w-4 h-4 text-[#C05621] dark:text-[#FFB59A]" />
              <span>Join Existing</span>
            </button>
          </div>

          {formError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-[#FFDAD6] border border-[#F2B8B5] text-sm text-[#410002] dark:bg-[#93000A] dark:border-[#FFB4AB]/40 dark:text-[#FFDAD6]"
            >
              {formError}
            </div>
          )}

          {tab === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="text-base font-semibold text-[#C05621] dark:text-[#FFB59A]">
                New Mess Details
              </div>
              <div>
                <label htmlFor="mess-name" className="block text-sm font-medium text-[#52443E] mb-1">
                  Mess / Flat Name
                </label>
                <input
                  id="mess-name"
                  type="text"
                  value={messName}
                  onChange={(e) => setMessName(e.target.value)}
                  placeholder="e.g. Green View Bachelor Mess"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#85736D]/50 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#C05621]"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="manager-name"
                  className="block text-sm font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1"
                >
                  Your Display Name (Manager)
                </label>
                <input
                  id="manager-name"
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="e.g. Tanvir Hasan"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#85736D]/50 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#C05621]"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 text-sm font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] disabled:opacity-60 rounded-xl transition-colors cursor-pointer"
              >
                {isSubmitting ? 'Creating Mess...' : 'Create & Start Mess'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="text-base font-semibold text-[#C05621] dark:text-[#FFB59A]">
                Join Member Mess
              </div>
              <div>
                <label
                  htmlFor="join-mess-id"
                  className="block text-sm font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1"
                >
                  Mess ID / Code
                </label>
                <input
                  id="join-mess-id"
                  type="text"
                  value={joinMessId}
                  onChange={(e) => setJoinMessId(e.target.value)}
                  placeholder="Paste Mess ID from your Manager"
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#85736D]/50 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#C05621]"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="join-member-name"
                  className="block text-sm font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1"
                >
                  Your Full Name
                </label>
                <input
                  id="join-member-name"
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="e.g. Rahim Ahmed"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#85736D]/50 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#C05621]"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="join-room"
                  className="block text-sm font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1"
                >
                  Room / Bed Number (Optional)
                </label>
                <input
                  id="join-room"
                  type="text"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="e.g. Room 4B"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#85736D]/50 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#C05621]"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 text-sm font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] disabled:opacity-60 rounded-xl transition-colors cursor-pointer"
              >
                {isSubmitting ? 'Joining Mess...' : 'Join Mess'}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
