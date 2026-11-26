import React from 'react';
import {
  Copy,
  Receipt,
  Scale,
  ShoppingBag,
  Utensils,
  Wallet,
} from 'lucide-react';
import { useMess } from '../../context/MessContext';
import { defaultBookingEntry, getMemberDue, getSharedBillStats } from '../../types/mess';
import {
  formatCurrency,
  formatReadableDate,
  isFriday as checkIsFriday,
} from '../../utils/dhakaTime';
import { computeKitchenOrderSummary, resolveEffectiveBooking } from '../../utils/messCalculations';

function formatUnits(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function DashboardView() {
  const {
    authUser,
    currentMess,
    members,
    dailyMeals,
    bazaarExpenses,
    deposits,
    sharedBills,
    summary,
    todayDhakaDate,
    currentMember,
    setActiveNav,
    setSelectedDate,
    showUiMessage,
  } = useMess();

  const myMemberId = currentMember?.id || authUser?.uid || '';
  const displayName = currentMember?.displayName || authUser?.displayName || 'Member';
  const mySettlement = summary.memberSettlements.find((s) => s.memberId === myMemberId);

  const myMealUnits = mySettlement?.totalUnits ?? 0;
  const myMemberUnits = mySettlement?.memberUnits ?? 0;
  const myGuestUnits = mySettlement?.guestUnits ?? 0;
  const myMealCost = mySettlement?.mealCost ?? 0;
  const myTotalDeposit = mySettlement?.totalDeposit ?? 0;
  const mySharedBillsPaid = mySettlement?.sharedBillsPaid ?? 0;
  const mySharedBillsUnpaid = mySettlement?.sharedBillsUnpaid ?? 0;
  const mySharedBillsShare = mySharedBillsPaid + mySharedBillsUnpaid;
  const myTotalCost = mySettlement?.totalCost ?? 0;
  const myNetBalance = mySettlement?.netBalance ?? 0;

  const myBazaarList = bazaarExpenses.filter((e) => e.buyerMemberId === myMemberId);
  const myBazaarTotal = myBazaarList.reduce((sum, e) => sum + e.amount, 0);
  const myBazaarCount = myBazaarList.length;
  const myDepositsCount = deposits.filter((d) => d.memberId === myMemberId).length;

  const myAssignedBills = sharedBills.filter(
    (b) => b.assignedMemberIds.length === 0 || b.assignedMemberIds.includes(myMemberId)
  );
  const myPendingBills = myAssignedBills.filter((b) => getMemberDue(b, myMemberId) > 0);
  const myBillsDueCount = myPendingBills.length;
  const nextDueBill = [...myPendingBills].sort((a, b) =>
    (a.deadline || '9999-99-99').localeCompare(b.deadline || '9999-99-99')
  )[0];

  const todayRecord = dailyMeals.find(
    (r) => r.id === todayDhakaDate || r.date === todayDhakaDate
  );
  const isFriday = todayRecord?.isFriday ?? checkIsFriday(todayDhakaDate);

  const myBooking = currentMember
    ? resolveEffectiveBooking({
        member: currentMember,
        explicitBooking: todayRecord?.bookings?.[myMemberId],
        date: todayDhakaDate,
        isFriday,
      })
    : todayRecord?.bookings?.[myMemberId] ?? defaultBookingEntry();

  const todayKitchen = computeKitchenOrderSummary({
    selectedDate: todayDhakaDate,
    todayDhakaDate,
    dailyMeals,
    members,
    lunchDeadline: currentMess?.lunchBookingDeadline || '09:00',
    nightDeadline: currentMess?.nightBookingDeadline || '17:00',
  });

  const isZeroBoth = Math.abs(myNetBalance) < 0.01 && myTotalCost === 0 && myTotalDeposit === 0;
  const isSettled = Math.abs(myNetBalance) < 0.01;
  const isRefund = myNetBalance >= 0;

  const balanceText = isSettled
    ? '৳0'
    : isRefund
      ? `+${formatCurrency(myNetBalance)}`
      : `-${formatCurrency(Math.abs(myNetBalance))}`;

  const balanceLabel = isZeroBoth
    ? 'No charges yet'
    : isSettled
      ? 'Settled'
      : isRefund
        ? 'Refundable credit'
        : 'Payable due';

  const lunchStatus = myBooking?.statusLunch || 'NO_RESPONSE';
  const nightStatus = isFriday ? 'DISABLED' : myBooking?.statusNight || 'NO_RESPONSE';
  const totalGuests = (myBooking?.guestLunch || 0) + (myBooking?.guestNight || 0);
  const isAutoEntry = myBooking?.autoBooked === true;

  function friendlyBookingLabel(status: string): string {
    if (status === 'BOOKED') return isAutoEntry ? 'Booked (Auto)' : 'Booked';
    if (status === 'CANCELLED') return 'Cancelled';
    if (status === 'DISABLED') return 'Friday Off';
    return 'Not Booked';
  }

  const totalBillAmount = sharedBills.reduce((s, b) => s + b.totalAmount, 0);
  const totalCollected = sharedBills.reduce((s, b) => s + getSharedBillStats(b).totalCollected, 0);

  const handleCopyCode = async () => {
    if (!currentMess?.id) return;
    try {
      await navigator.clipboard.writeText(currentMess.id);
      showUiMessage(`Mess Code '${currentMess.id}' copied to clipboard!`);
    } catch {
      showUiMessage(`Mess ID: ${currentMess.id}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Personalized Greeting Header Row (matches DashboardScreen.kt) */}
      <section className="flex items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-full bg-[#C05621] text-white flex items-center justify-center font-display font-extrabold text-base shrink-0">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-[#201A17] truncate">
              Hi, {displayName}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#52443E] mt-0.5">
              <span className="truncate">
                {currentMess?.name || 'Mess Meal'}
                {currentMember?.room?.trim() ? ` · Rm ${currentMember.room.trim()}` : ''}
              </span>
              {currentMess?.id && (
                <button
                  type="button"
                  onClick={handleCopyCode}
                  aria-label="Copy Mess Code"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F4DFD7] hover:bg-[#FFDBCF] text-[#52443E] font-mono font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  <span>{currentMess.id}</span>
                  <Copy className="w-3 h-3 text-[#C05621]" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Hero Personal Balance Card (matches DashboardScreen.kt AmberPrimaryContainerLight card) */}
      <section className="bg-[#FFDBCF] border border-[#F2C3B2] text-[#381400] rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#52443E]">
          <span>Your Net Balance</span>
          <span className="font-mono tabular-nums font-semibold">
            Month: {currentMess?.activeMonth}
          </span>
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <div
              className={`font-display text-3xl sm:text-4xl font-extrabold font-mono tabular-nums tracking-tight ${
                isRefund ? 'text-[#381400]' : 'text-[#BA1A1A]'
              }`}
            >
              {balanceText}
            </div>
            <span
              className={`text-xs font-bold ${
                isRefund ? 'text-[#C05621]' : 'text-[#BA1A1A]'
              }`}
            >
              {balanceLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setActiveNav('settlement')}
            className="px-3.5 py-1.5 text-xs font-semibold text-[#381400] bg-[#FCFAF7]/80 hover:bg-[#FCFAF7] border border-[#E8D9D3] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Settlement Details &rarr;
          </button>
        </div>

        <div className="bg-[#FCFAF7]/75 rounded-xl px-4 py-3 grid grid-cols-3 gap-3 border border-[#F2C3B2]/60">
          <div>
            <div className="text-[11px] text-[#52443E]">My Meals</div>
            <div className="mt-0.5 text-sm font-bold font-mono tabular-nums text-[#201A17]">
              {formatUnits(myMealUnits)} u
            </div>
          </div>
          <div className="text-center">
            <div className="text-[11px] text-[#52443E]">My Cost</div>
            <div className="mt-0.5 text-sm font-bold font-mono tabular-nums text-[#201A17]">
              {formatCurrency(myTotalCost)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-[#52443E]">My Deposit</div>
            <div className="mt-0.5 text-sm font-bold font-mono tabular-nums text-[#C05621]">
              {formatCurrency(myTotalDeposit)}
            </div>
          </div>
        </div>
      </section>

      {/* 3. 4-Grid Personalized Member Metrics (exact match to DashboardScreen.kt MetricCards) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setActiveNav('meals')}
          className="text-left bg-white border border-[#E8D9D3] hover:border-[#C05621]/50 rounded-2xl p-4 flex flex-col justify-between transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#52443E]">My Meal Units</span>
            <Utensils className="w-4 h-4 text-[#C05621] shrink-0" aria-hidden="true" />
          </div>
          <div className="mt-2.5 font-display text-lg sm:text-xl font-bold font-mono tabular-nums text-[#201A17]">
            {formatUnits(myMealUnits)} units
          </div>
          <div className="mt-1 text-xs text-[#85736D] truncate">
            {myGuestUnits > 0
              ? `You ${formatUnits(myMemberUnits)} + Guest ${formatUnits(myGuestUnits)}`
              : `Meal cost ${formatCurrency(myMealCost)}`}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav('deposits')}
          className="text-left bg-white border border-[#E8D9D3] hover:border-[#2C5E8A]/50 rounded-2xl p-4 flex flex-col justify-between transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#52443E]">My Deposits</span>
            <Wallet className="w-4 h-4 text-[#2C5E8A] shrink-0" aria-hidden="true" />
          </div>
          <div className="mt-2.5 font-display text-lg sm:text-xl font-bold font-mono tabular-nums text-[#201A17]">
            {formatCurrency(myTotalDeposit)}
          </div>
          <div className="mt-1 text-xs text-[#85736D] truncate">
            {myDepositsCount} deposit{myDepositsCount === 1 ? '' : 's'} logged
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav('bills')}
          className="text-left bg-white border border-[#E8D9D3] hover:border-[#0D7351]/50 rounded-2xl p-4 flex flex-col justify-between transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#52443E]">My Bills Due</span>
            <Receipt
              className={`w-4 h-4 shrink-0 ${
                mySharedBillsUnpaid <= 0 ? 'text-[#0D7351]' : 'text-[#BA1A1A]'
              }`}
              aria-hidden="true"
            />
          </div>
          <div
            className={`mt-2.5 font-display text-lg sm:text-xl font-bold font-mono tabular-nums ${
              mySharedBillsUnpaid <= 0 ? 'text-[#0D7351]' : 'text-[#BA1A1A]'
            }`}
          >
            {mySharedBillsUnpaid <= 0 ? 'All Paid' : formatCurrency(mySharedBillsUnpaid)}
          </div>
          <div className="mt-1 text-xs text-[#85736D] truncate">
            {myBillsDueCount > 0
              ? `${myBillsDueCount} unpaid bill${myBillsDueCount === 1 ? '' : 's'}`
              : `Share ${formatCurrency(mySharedBillsShare)}`}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav('bazaar')}
          className="text-left bg-white border border-[#E8D9D3] hover:border-[#E65100]/50 rounded-2xl p-4 flex flex-col justify-between transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#52443E]">My Bazaar</span>
            <ShoppingBag className="w-4 h-4 text-[#E65100] shrink-0" aria-hidden="true" />
          </div>
          <div className="mt-2.5 font-display text-lg sm:text-xl font-bold font-mono tabular-nums text-[#201A17]">
            {formatCurrency(myBazaarTotal)}
          </div>
          <div className="mt-1 text-xs text-[#85736D] truncate">
            {myBazaarCount} purchase{myBazaarCount === 1 ? '' : 's'}
          </div>
        </button>
      </section>

      {/* 4. Today's Meals & Kitchen Summary + Your Shared Bills */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Today's Booking & Kitchen Orders Overview Card */}
        <div className="lg:col-span-7 bg-white border border-[#E8D9D3] rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-bold text-[#201A17]">
                Today&apos;s Meals ({formatReadableDate(todayDhakaDate)})
              </h3>
              <p className="text-xs text-[#85736D]">
                Asia/Dhaka Timezone · Strict Cutoffs
              </p>
            </div>
            <div className="text-xs font-semibold text-[#52443E]">
              <span className={currentMember?.autoBookEnabled ? 'text-[#C05621]' : 'text-[#52443E]'}>
                {currentMember?.autoBookEnabled ? 'Auto-Book ON' : 'Manual'}
              </span>
              {isFriday && <span className="text-[#0D7351]"> · Friday</span>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 sm:p-3 rounded-xl bg-[#F4DFD7]/55">
              <div className="text-[11px] text-[#85736D]">My Lunch</div>
              <div
                className={`mt-0.5 text-xs sm:text-sm font-bold leading-snug ${
                  lunchStatus === 'BOOKED' ? 'text-[#C05621]' : 'text-[#52443E]'
                }`}
              >
                {friendlyBookingLabel(lunchStatus)}
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-[#F4DFD7]/55">
              <div className="text-[11px] text-[#85736D]">My Night</div>
              <div
                className={`mt-0.5 text-xs sm:text-sm font-bold leading-snug ${
                  isFriday
                    ? 'text-[#85736D]'
                    : nightStatus === 'BOOKED'
                      ? 'text-[#C05621]'
                      : 'text-[#52443E]'
                }`}
              >
                {friendlyBookingLabel(nightStatus)}
              </div>
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl bg-[#F4DFD7]/55">
              <div className="text-[11px] text-[#85736D]">Guests</div>
              <div className="mt-0.5 text-xs sm:text-sm font-bold font-mono tabular-nums text-[#201A17] leading-snug">
                {totalGuests > 0 ? `+${totalGuests}` : 'None'}
              </div>
            </div>
          </div>

          <div className="bg-[#A5F2D2]/50 text-[#002115] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
            <span className="font-bold">Kitchen Summary:</span>
            <span className="font-extrabold font-mono tabular-nums">
              Lunch: {todayKitchen.lunchMemberCount} | Night: {todayKitchen.nightMemberCount}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedDate(todayDhakaDate);
              setActiveNav('meals');
            }}
            className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] rounded-xl inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Utensils className="w-4 h-4" aria-hidden="true" />
            <span>Manage Bookings</span>
          </button>
        </div>

        {/* Your Shared Bills Card */}
        <div className="lg:col-span-5 bg-white border border-[#E8D9D3] rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-[#201A17]">Your Shared Bills</h3>
            <button
              type="button"
              onClick={() => setActiveNav('bills')}
              className="text-xs font-semibold text-[#C05621] hover:text-[#A3471B] cursor-pointer"
            >
              View All Bills
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveNav('bills')}
            className="w-full text-left p-4 rounded-xl border border-[#E8D9D3] hover:bg-[#F4DFD7]/30 transition-colors space-y-3 cursor-pointer"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-[#0D7351]/12 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4 text-[#0D7351]" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#201A17]">
                    Shared Bills ({myAssignedBills.length})
                  </div>
                  <div className="text-xs text-[#85736D] truncate">
                    {nextDueBill
                      ? `Next due: ${nextDueBill.title}${
                          nextDueBill.deadline ? ` (${formatReadableDate(nextDueBill.deadline)})` : ''
                        }`
                      : 'Chef, gas, wifi & utilities'}
                  </div>
                </div>
              </div>
              <span
                className={`text-xs font-bold whitespace-nowrap shrink-0 ${
                  mySharedBillsUnpaid <= 0 ? 'text-[#0D7351]' : 'text-[#BA1A1A]'
                }`}
              >
                {mySharedBillsUnpaid <= 0
                  ? 'ALL PAID'
                  : `MY DUE: ${formatCurrency(mySharedBillsUnpaid)}`}
              </span>
            </div>

            <div className="pt-2 border-t border-[#E8D9D3]/70 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
              <span className="text-[#52443E] font-mono tabular-nums">
                Your Share: {formatCurrency(mySharedBillsShare)} · Paid:{' '}
                {formatCurrency(mySharedBillsPaid)}
              </span>
              <span className="font-semibold text-[#C05621] font-mono tabular-nums whitespace-nowrap shrink-0">
                Mess: {formatCurrency(totalCollected)} / {formatCurrency(totalBillAmount)}
              </span>
            </div>
          </button>

          {/* 5-Tile Quick Actions Strip (matches DashboardQuickAction row in DashboardScreen.kt) */}
          <div className="grid grid-cols-5 gap-1.5">
            {[
              { id: 'meals' as const, label: 'Meals', icon: Utensils, color: 'text-[#C05621]' },
              { id: 'bazaar' as const, label: 'Bazaar', icon: ShoppingBag, color: 'text-[#E65100]' },
              { id: 'bills' as const, label: 'Bills', icon: Receipt, color: 'text-[#0D7351]' },
              { id: 'deposits' as const, label: 'Deposit', icon: Wallet, color: 'text-[#2C5E8A]' },
              { id: 'settlement' as const, label: 'Balance', icon: Scale, color: 'text-[#C05621]' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className="py-2.5 px-1 rounded-xl bg-[#F4DFD7]/45 hover:bg-[#FFDBCF]/70 border border-[#E8D9D3] flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Icon className={`w-4 h-4 ${item.color}`} aria-hidden="true" />
                  <span className="text-[11px] font-semibold text-[#201A17]">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Compact Mess-Wide Overview Card (matches DashboardScreen.kt Mess Overview) */}
      <section className="bg-[#F4DFD7]/35 border border-[#E8D9D3] rounded-2xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-sm font-bold text-[#201A17]">Mess Overview</h3>
          <div className="text-xs font-bold font-mono tabular-nums text-[#C05621]">
            Rate: {formatCurrency(summary.mealRate)} / meal
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/80 border border-[#E8D9D3] rounded-xl p-3">
            <div className="text-[11px] text-[#85736D]">Total Units</div>
            <div className="mt-0.5 text-sm font-bold font-mono tabular-nums text-[#201A17]">
              {formatUnits(summary.totalUnits)}u
            </div>
          </div>
          <div className="bg-white/80 border border-[#E8D9D3] rounded-xl p-3">
            <div className="text-[11px] text-[#85736D]">Bazaar</div>
            <div className="mt-0.5 text-sm font-bold font-mono tabular-nums text-[#201A17]">
              {formatCurrency(summary.totalBazaarCost)}
            </div>
          </div>
          <div className="bg-white/80 border border-[#E8D9D3] rounded-xl p-3">
            <div className="text-[11px] text-[#85736D]">Deposits</div>
            <div className="mt-0.5 text-sm font-bold font-mono tabular-nums text-[#201A17]">
              {formatCurrency(summary.totalDeposits)}
            </div>
          </div>
          <div className="bg-white/80 border border-[#E8D9D3] rounded-xl p-3">
            <div className="text-[11px] text-[#85736D]">Reserve</div>
            <div
              className={`mt-0.5 text-sm font-bold font-mono tabular-nums ${
                summary.remainingFund >= 0 ? 'text-[#0D7351]' : 'text-[#BA1A1A]'
              }`}
            >
              {formatCurrency(summary.remainingFund)}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
