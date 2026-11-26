import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  Minus,
  Plus,
  Settings2,
  ShieldAlert,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useMess } from '../../context/MessContext';
import {
  MealAttendanceEntry,
  MealServiceStatus,
  Member,
  defaultBookingEntry,
} from '../../types/mess';
import {
  format12Hour,
  formatReadableDate,
  getWeekdayName,
  isDeadlinePassed,
  isFriday as checkIsFriday,
  shiftDate,
} from '../../utils/dhakaTime';
import {
  calculateAttendanceUnits,
  calculateBookingUnits,
  resolveEffectiveBooking,
} from '../../utils/messCalculations';

type MealsSubTab = 'my_booking' | 'kitchen' | 'attendance';
type RosterFilter = 'all' | 'lunch' | 'night' | 'not_eating';

export function DailyMealsView() {
  const {
    authUser,
    currentMess,
    members,
    dailyMeals,
    selectedDate,
    todayDhakaDate,
    isManager,
    currentMember,
    kitchenSummary,
    setSelectedDate,
    configureDeadlines,
    updateMealServiceStatus,
    saveMyBooking,
    setAutoBooking,
    managerOverrideBooking,
    saveFinalOrderSummary,
    saveConfirmedAttendance,
  } = useMess();

  const [subTab, setSubTab] = useState<MealsSubTab>('my_booking');
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('all');

  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<Member | null>(null);

  const currentRecord = dailyMeals.find((r) => r.id === selectedDate || r.date === selectedDate);
  const isFri = currentRecord?.isFriday ?? checkIsFriday(selectedDate);
  const lunchDeadline = currentMess?.lunchBookingDeadline || '09:00';
  const nightDeadline = currentMess?.nightBookingDeadline || '17:00';
  const isLunchPassed = isDeadlinePassed(selectedDate, lunchDeadline);
  const isNightPassed = isFri ? true : isDeadlinePassed(selectedDate, nightDeadline);

  const myMemberId = currentMember?.id || authUser?.uid || '';
  const rawBooking = currentRecord?.bookings?.[myMemberId];
  const myBooking =
    currentMember && (selectedDate >= todayDhakaDate || currentRecord != null)
      ? resolveEffectiveBooking({
          member: currentMember,
          explicitBooking: rawBooking,
          date: selectedDate,
          isFriday: isFri,
        })
      : rawBooking ?? defaultBookingEntry();

  // My Booking form state
  const [statusLunch, setStatusLunch] = useState<'BOOKED' | 'CANCELLED'>(
    myBooking.statusLunch === 'BOOKED' ? 'BOOKED' : 'CANCELLED'
  );
  const [statusNight, setStatusNight] = useState<'BOOKED' | 'CANCELLED'>(
    myBooking.statusNight === 'BOOKED' ? 'BOOKED' : 'CANCELLED'
  );
  const [guestLunch, setGuestLunch] = useState<number>(myBooking.guestLunch);
  const [guestNight, setGuestNight] = useState<number>(myBooking.guestNight);

  useEffect(() => {
    setStatusLunch(myBooking.statusLunch === 'BOOKED' ? 'BOOKED' : 'CANCELLED');
    setStatusNight(myBooking.statusNight === 'BOOKED' ? 'BOOKED' : 'CANCELLED');
    setGuestLunch(myBooking.guestLunch);
    setGuestNight(myBooking.guestNight);
  }, [
    selectedDate,
    myBooking.statusLunch,
    myBooking.statusNight,
    myBooking.guestLunch,
    myBooking.guestNight,
  ]);

  // Deadline dialog state
  const [editLunchDeadline, setEditLunchDeadline] = useState(lunchDeadline);
  const [editNightDeadline, setEditNightDeadline] = useState(nightDeadline);

  // Service status dialog state
  const [editLunchService, setEditLunchService] = useState<MealServiceStatus>(
    currentRecord?.lunchServiceStatus ?? 'ACTIVE'
  );
  const [editNightService, setEditNightService] = useState<MealServiceStatus>(
    currentRecord?.nightServiceStatus ?? 'ACTIVE'
  );
  const [editCancelReason, setEditCancelReason] = useState(
    currentRecord?.cancellationReason ?? ''
  );

  // Override dialog state
  const [ovrLunch, setOvrLunch] = useState<'BOOKED' | 'CANCELLED'>('BOOKED');
  const [ovrNight, setOvrNight] = useState<'BOOKED' | 'CANCELLED'>('BOOKED');
  const [ovrGuestLunch, setOvrGuestLunch] = useState(0);
  const [ovrGuestNight, setOvrGuestNight] = useState(0);
  const [ovrReason, setOvrReason] = useState('');

  const openOverrideFor = (member: Member) => {
    const explicit = currentRecord?.bookings?.[member.id];
    const effective = resolveEffectiveBooking({
      member,
      explicitBooking: explicit,
      date: selectedDate,
      isFriday: isFri,
    });
    setOvrLunch(effective.statusLunch === 'BOOKED' ? 'BOOKED' : 'CANCELLED');
    setOvrNight(effective.statusNight === 'BOOKED' ? 'BOOKED' : 'CANCELLED');
    setOvrGuestLunch(effective.guestLunch);
    setOvrGuestNight(effective.guestNight);
    setOvrReason(effective.managerOverrideReason || '');
    setOverrideTarget(member);
  };

  // Roster members filtered
  const rosterEntries = members.map((member) => {
    const explicit = currentRecord?.bookings?.[member.id];
    const effective =
      selectedDate >= todayDhakaDate || currentRecord != null
        ? resolveEffectiveBooking({
            member,
            explicitBooking: explicit,
            date: selectedDate,
            isFriday: isFri,
          })
        : explicit ?? defaultBookingEntry();
    const [mUnits, gUnits] = calculateBookingUnits({
      date: selectedDate,
      isFriday: isFri,
      lunchServiceStatus: currentRecord?.lunchServiceStatus ?? 'ACTIVE',
      nightServiceStatus: currentRecord?.nightServiceStatus ?? 'ACTIVE',
      lunchDeadline,
      nightDeadline,
      booking: effective,
      lunchFinalOrder: currentRecord?.lunchFinalOrder,
      nightFinalOrder: currentRecord?.nightFinalOrder,
    });
    return { member, effective, mUnits, gUnits };
  });

  const filteredRoster = rosterEntries.filter(({ effective }) => {
    if (rosterFilter === 'lunch') return kitchenSummary.lunchActive && effective.statusLunch === 'BOOKED';
    if (rosterFilter === 'night') return kitchenSummary.nightActive && effective.statusNight === 'BOOKED';
    if (rosterFilter === 'not_eating') {
      return effective.statusLunch !== 'BOOKED' && (isFri || effective.statusNight !== 'BOOKED');
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Date Switcher & Manager Toolbar */}
      <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            aria-label="Previous day"
            className="p-2 border border-[#85736D]/50 dark:border-[#52443E] rounded-lg hover:bg-[#F4DFD7]/35 dark:hover:bg-[#352A25] text-[#201A17] dark:text-[#EDE0DB] cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="Select meal date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              className="px-3 py-1.5 text-sm font-mono tabular-nums border border-[#85736D]/50 dark:border-[#52443E] rounded-lg bg-white dark:bg-[#1A1412] text-[#201A17] dark:text-[#EDE0DB]"
            />
            <div className="hidden sm:block text-sm text-[#52443E] dark:text-[#D7C3BC]">
              {getWeekdayName(selectedDate)}
              {isFri && ' · Friday Rule (Lunch Only)'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            aria-label="Next day"
            className="p-2 border border-[#85736D]/50 dark:border-[#52443E] rounded-lg hover:bg-[#F4DFD7]/35 dark:hover:bg-[#352A25] text-[#201A17] dark:text-[#EDE0DB] cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {selectedDate !== todayDhakaDate && (
            <button
              type="button"
              onClick={() => setSelectedDate(todayDhakaDate)}
              className="px-3 py-1.5 text-xs font-semibold text-[#C05621] dark:text-[#FFDBCF] bg-[#FFDBCF] dark:bg-[#842B00] hover:bg-[#FFDBCF]/80 dark:hover:bg-[#A3471B] rounded-lg cursor-pointer"
            >
              Today
            </button>
          )}
        </div>

        {isManager && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditLunchDeadline(lunchDeadline);
                setEditNightDeadline(nightDeadline);
                setShowDeadlineModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] border border-[#85736D]/50 dark:border-[#52443E] hover:bg-[#F4DFD7]/35 dark:hover:bg-[#352A25] rounded-lg whitespace-nowrap cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Deadlines</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditLunchService(currentRecord?.lunchServiceStatus ?? 'ACTIVE');
                setEditNightService(currentRecord?.nightServiceStatus ?? 'ACTIVE');
                setEditCancelReason(currentRecord?.cancellationReason ?? '');
                setShowServiceModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] border border-[#85736D]/50 dark:border-[#52443E] hover:bg-[#F4DFD7]/35 dark:hover:bg-[#352A25] rounded-lg whitespace-nowrap cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Service Status</span>
            </button>
          </div>
        )}
      </div>

      {/* Service / Friday Notice Banner */}
      {(isFri || !kitchenSummary.lunchActive || !kitchenSummary.nightActive) && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-[#352A25] border border-amber-200 dark:border-[#842B00] text-sm text-amber-900 dark:text-[#FFDBCF] space-y-1">
          <div className="font-semibold">
            {isFri
              ? 'Friday Single-Service Rule Active'
              : 'Meal Service Adjustment for ' + formatReadableDate(selectedDate)}
          </div>
          <p className="text-xs text-amber-800 dark:text-[#D7C3BC]">
            {isFri && 'Night meals are closed on Fridays. Lunch counts as 1.0 full unit. '}
            {!kitchenSummary.lunchActive && 'Lunch service is CANCELLED. '}
            {!isFri && !kitchenSummary.nightActive && 'Night service is CANCELLED. '}
            {kitchenSummary.cancellationReason && `Reason: ${kitchenSummary.cancellationReason}`}
          </p>
        </div>
      )}

      {/* Segmented Sub-Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[#F4DFD7]/60 dark:bg-[#352A25] rounded-lg w-fit max-w-full overflow-x-auto">
        <button
          type="button"
          onClick={() => setSubTab('my_booking')}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            subTab === 'my_booking'
              ? 'bg-white dark:bg-[#221B18] text-[#201A17] dark:text-[#EDE0DB] shadow-sm'
              : 'text-[#52443E] dark:text-[#D7C3BC] hover:text-[#201A17] dark:hover:text-[#EDE0DB]'
          }`}
        >
          My Booking
        </button>
        <button
          type="button"
          onClick={() => setSubTab('kitchen')}
          className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            subTab === 'kitchen'
              ? 'bg-white dark:bg-[#221B18] text-[#201A17] dark:text-[#EDE0DB] shadow-sm'
              : 'text-[#52443E] dark:text-[#D7C3BC] hover:text-[#201A17] dark:hover:text-[#EDE0DB]'
          }`}
        >
          Kitchen &amp; Bookings
        </button>
        {isManager && (
          <button
            type="button"
            onClick={() => setSubTab('attendance')}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              subTab === 'attendance'
                ? 'bg-white dark:bg-[#221B18] text-[#201A17] dark:text-[#EDE0DB] shadow-sm'
                : 'text-[#52443E] dark:text-[#D7C3BC] hover:text-[#201A17] dark:hover:text-[#EDE0DB]'
            }`}
          >
            Historical Attendance
          </button>
        )}
      </div>

      {/* TAB 1: MY BOOKING */}
      {subTab === 'my_booking' && (
        <div className="space-y-6">
          {/* Auto-Booking Preferences */}
          {currentMember && (
            <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="font-display font-semibold text-sm text-[#201A17] dark:text-[#EDE0DB]">
                  Automatic Daily Meal Booking
                </div>
                <p className="text-xs text-[#52443E] dark:text-[#D7C3BC]">
                  Automatically book your upcoming meals before the Dhaka cutoff unless you
                  manually cancel.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {currentMember.autoBookEnabled && (
                  <div className="flex items-center gap-1 p-1 bg-[#F4DFD7]/60 dark:bg-[#352A25] rounded-lg">
                    <button
                      type="button"
                      onClick={() =>
                        setAutoBooking(
                          true,
                          !currentMember.autoBookLunch,
                          currentMember.autoBookNight
                        )
                      }
                      className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                        currentMember.autoBookLunch
                          ? 'bg-white dark:bg-[#221B18] text-[#0D7351] dark:text-[#89D6B7] shadow-sm'
                          : 'text-[#52443E] dark:text-[#D7C3BC]'
                      }`}
                    >
                      Lunch {currentMember.autoBookLunch ? 'On' : 'Off'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAutoBooking(
                          true,
                          currentMember.autoBookLunch,
                          !currentMember.autoBookNight
                        )
                      }
                      className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                        currentMember.autoBookNight
                          ? 'bg-white dark:bg-[#221B18] text-[#0D7351] dark:text-[#89D6B7] shadow-sm'
                          : 'text-[#52443E] dark:text-[#D7C3BC]'
                      }`}
                    >
                      Night {currentMember.autoBookNight ? 'On' : 'Off'}
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  role="switch"
                  aria-checked={currentMember.autoBookEnabled}
                  onClick={() =>
                    setAutoBooking(
                      !currentMember.autoBookEnabled,
                      currentMember.autoBookLunch,
                      currentMember.autoBookNight
                    )
                  }
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    currentMember.autoBookEnabled
                      ? 'bg-[#C05621] text-white hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:text-[#5F1B00] dark:hover:bg-[#F2A386]'
                      : 'bg-[#F4DFD7] dark:bg-[#352A25] text-[#52443E] dark:text-[#D7C3BC] hover:bg-[#E8D9D3] dark:hover:bg-[#463832]'
                  }`}
                >
                  {currentMember.autoBookEnabled ? 'Auto-Book: ON' : 'Auto-Book: OFF'}
                </button>
              </div>
            </div>
          )}

          {/* Lunch & Night Booking Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Lunch Card */}
            <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl p-6 space-y-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-[#201A17] dark:text-[#EDE0DB]">Lunch Meal</h3>
                  <p className="text-xs text-[#85736D] dark:text-[#A08C86] font-mono tabular-nums">
                    Cutoff: {format12Hour(lunchDeadline)} (Asia/Dhaka) · Weight:{' '}
                    {kitchenSummary.nightActive ? '1.5 units solo / 2.0 both' : '1.0 unit'}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold ${
                    !kitchenSummary.lunchActive
                      ? 'text-rose-700 dark:text-[#FFB4AB]'
                      : isLunchPassed
                        ? 'text-amber-700 dark:text-[#FFB59A]'
                        : 'text-[#0D7351] dark:text-[#89D6B7]'
                  }`}
                >
                  {!kitchenSummary.lunchActive
                    ? 'Cancelled'
                    : isLunchPassed
                      ? 'Locked'
                      : 'Open'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={!kitchenSummary.lunchActive || isLunchPassed}
                  onClick={() => setStatusLunch('BOOKED')}
                  className={`py-2.5 text-sm font-semibold rounded-lg border transition-colors cursor-pointer disabled:opacity-50 ${
                    statusLunch === 'BOOKED'
                      ? 'bg-[#0D7351] text-white border-[#0D7351] dark:bg-[#89D6B7] dark:text-[#003825] dark:border-[#89D6B7]'
                      : 'bg-white dark:bg-[#1A1412] text-[#52443E] dark:text-[#D7C3BC] border-[#85736D]/50 dark:border-[#52443E] hover:bg-[#F4DFD7]/35 dark:hover:bg-[#352A25]'
                  }`}
                >
                  Book Lunch
                </button>
                <button
                  type="button"
                  disabled={!kitchenSummary.lunchActive || isLunchPassed}
                  onClick={() => setStatusLunch('CANCELLED')}
                  className={`py-2.5 text-sm font-semibold rounded-lg border transition-colors cursor-pointer disabled:opacity-50 ${
                    statusLunch === 'CANCELLED'
                      ? 'bg-rose-700 text-white border-rose-700'
                      : 'bg-white dark:bg-[#1A1412] text-[#52443E] dark:text-[#D7C3BC] border-[#85736D]/50 dark:border-[#52443E] hover:bg-[#F4DFD7]/35 dark:hover:bg-[#352A25]'
                  }`}
                >
                  Cancel Lunch
                </button>
              </div>

              <div className="pt-3 border-t border-[#E8D9D3] dark:border-[#3E322D] flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-[#201A17] dark:text-[#EDE0DB]">Guest Lunch Meals</div>
                  <div className="text-xs text-[#85736D] dark:text-[#A08C86]">Billed under your account</div>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    aria-label="Decrease lunch guests"
                    disabled={!kitchenSummary.lunchActive || isLunchPassed || guestLunch <= 0}
                    onClick={() => setGuestLunch((v) => Math.max(0, v - 1))}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-[#85736D]/50 dark:border-[#52443E] hover:bg-[#F4DFD7]/35 dark:hover:bg-[#352A25] text-[#201A17] dark:text-[#EDE0DB] disabled:opacity-40 cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-mono tabular-nums font-bold text-base w-6 text-center text-[#201A17] dark:text-[#EDE0DB]">
                    {guestLunch}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase lunch guests"
                    disabled={!kitchenSummary.lunchActive || isLunchPassed}
                    onClick={() => setGuestLunch((v) => v + 1)}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-[#85736D]/50 dark:border-[#52443E] hover:bg-[#F4DFD7]/35 dark:hover:bg-[#352A25] text-[#201A17] dark:text-[#EDE0DB] disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Night Card */}
            <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl p-6 space-y-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold text-[#201A17] dark:text-[#EDE0DB]">Night Meal</h3>
                  <p className="text-xs text-[#85736D] dark:text-[#A08C86] font-mono tabular-nums">
                    {isFri
                      ? 'Friday Closed · No Night Meal'
                      : `Cutoff: ${format12Hour(nightDeadline)} (Asia/Dhaka) · Weight: ${
                          kitchenSummary.lunchActive ? '1.0 unit' : '1.0 unit'
                        }`}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold ${
                    isFri || !kitchenSummary.nightActive
                      ? 'text-rose-700 dark:text-[#FFB4AB]'
                      : isNightPassed
                        ? 'text-amber-700 dark:text-[#FFB59A]'
                        : 'text-[#0D7351] dark:text-[#89D6B7]'
                  }`}
                >
                  {isFri
                    ? 'Friday Closed'
                    : !kitchenSummary.nightActive
                      ? 'Cancelled'
                      : isNightPassed
                        ? 'Locked'
                        : 'Open'}
                </span>
              </div>

              {isFri ? (
                <div className="p-4 rounded-lg bg-[#FCFAF7] dark:bg-[#171210] border border-[#E8D9D3] dark:border-[#3E322D] text-sm text-[#52443E] dark:text-[#D7C3BC]">
                  Night meal booking is disabled on Fridays per mess rules (Lunch only).
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={!kitchenSummary.nightActive || isNightPassed}
                      onClick={() => setStatusNight('BOOKED')}
                      className={`py-2.5 text-sm font-semibold rounded-lg border transition-colors cursor-pointer disabled:opacity-50 ${
                        statusNight === 'BOOKED'
                          ? 'bg-[#0D7351] text-white border-[#0D7351] dark:bg-[#89D6B7] dark:text-[#003825] dark:border-[#89D6B7]'
                          : 'bg-white dark:bg-[#1A1412] text-[#52443E] dark:text-[#D7C3BC] border-[#85736D]/50 dark:border-[#52443E] hover:bg-[#F4DFD7]/35 dark:hover:bg-[#352A25]'
                      }`}
                    >
                      Book Night
                    </button>
                    <button
                      type="button"
                      disabled={!kitchenSummary.nightActive || isNightPassed}
                      onClick={() => setStatusNight('CANCELLED')}
                      className={`py-2.5 text-sm font-semibold rounded-lg border transition-colors cursor-pointer disabled:opacity-50 ${
                        statusNight === 'CANCELLED'
                          ? 'bg-rose-700 text-white border-rose-700'
                          : 'bg-white dark:bg-[#1A1412] text-[#52443E] dark:text-[#D7C3BC] border-[#85736D]/50 dark:border-[#52443E] hover:bg-[#F4DFD7]/35 dark:hover:bg-[#352A25]'
                      }`}
                    >
                      Cancel Night
                    </button>
                  </div>

                  <div className="pt-3 border-t border-[#E8D9D3] dark:border-[#3E322D] flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-[#201A17] dark:text-[#EDE0DB]">Guest Night Meals</div>
                      <div className="text-xs text-[#85736D] dark:text-[#A08C86]">Billed under your account</div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        aria-label="Decrease night guests"
                        disabled={!kitchenSummary.nightActive || isNightPassed || guestNight <= 0}
                        onClick={() => setGuestNight((v) => Math.max(0, v - 1))}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-[#85736D]/50 dark:border-[#52443E] hover:bg-[#F4DFD7]/35 dark:hover:bg-[#352A25] text-[#201A17] dark:text-[#EDE0DB] disabled:opacity-40 cursor-pointer"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-mono tabular-nums font-bold text-base w-6 text-center text-[#201A17] dark:text-[#EDE0DB]">
                        {guestNight}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase night guests"
                        disabled={!kitchenSummary.nightActive || isNightPassed}
                        onClick={() => setGuestNight((v) => v + 1)}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-[#85736D]/50 dark:border-[#52443E] hover:bg-[#F4DFD7]/35 dark:hover:bg-[#352A25] text-[#201A17] dark:text-[#EDE0DB] disabled:opacity-40 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl p-4">
            <div className="text-xs text-[#52443E] dark:text-[#D7C3BC]">
              {myBooking.managerOverrideReason
                ? `Manager Override Note: ${myBooking.managerOverrideReason}`
                : myBooking.autoBooked
                  ? 'Currently filled via Auto-Booking preference.'
                  : 'Confirmed bookings lock at cutoff and count toward monthly meal units.'}
            </div>
            <button
              type="button"
              disabled={isLunchPassed && isNightPassed}
              onClick={() =>
                saveMyBooking(selectedDate, statusLunch, statusNight, guestLunch, guestNight)
              }
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] disabled:bg-[#E8D9D3] dark:disabled:bg-[#352A25] disabled:text-[#52443E] dark:disabled:text-[#A08C86] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isLunchPassed && isNightPassed ? 'Bookings Locked' : 'Save My Booking'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: KITCHEN & BOOKINGS */}
      {subTab === 'kitchen' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Lunch Kitchen Summary */}
            <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-[#85736D] dark:text-[#A08C86]">
                    Lunch Kitchen Order · {formatReadableDate(selectedDate)}
                  </div>
                  <div className="mt-1 font-display text-3xl font-bold font-mono tabular-nums text-[#201A17] dark:text-[#EDE0DB]">
                    {kitchenSummary.lunchTotalPortions} portions
                  </div>
                </div>
                <span className="text-xs font-semibold text-[#52443E] dark:text-[#D7C3BC]">
                  {kitchenSummary.lunchFinalOrder
                    ? `Locked (${kitchenSummary.lunchFinalOrder.lockedAtDhakaTime})`
                    : kitchenSummary.isLunchLocked
                      ? 'Deadline Passed'
                      : 'Live Count'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E8D9D3] dark:border-[#3E322D] text-sm">
                <div>
                  <div className="text-xs text-[#85736D] dark:text-[#A08C86]">Members</div>
                  <div className="font-mono tabular-nums font-bold text-[#201A17] dark:text-[#EDE0DB]">
                    {kitchenSummary.lunchMemberCount}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#85736D] dark:text-[#A08C86]">Guests</div>
                  <div className="font-mono tabular-nums font-bold text-[#201A17] dark:text-[#EDE0DB]">
                    {kitchenSummary.lunchGuestCount}
                  </div>
                </div>
              </div>
              {isManager && kitchenSummary.lunchActive && (
                <button
                  type="button"
                  onClick={() => saveFinalOrderSummary(selectedDate, 'LUNCH')}
                  className="w-full py-2 px-3 text-xs font-semibold text-[#201A17] dark:text-[#EDE0DB] bg-[#F4DFD7]/60 dark:bg-[#352A25] hover:bg-[#F4DFD7] dark:hover:bg-[#463832] rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>
                    {kitchenSummary.lunchFinalOrder
                      ? 'Re-Lock Final Lunch Summary'
                      : 'Archive / Lock Final Lunch Summary'}
                  </span>
                </button>
              )}
            </div>

            {/* Night Kitchen Summary */}
            <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl p-6 space-y-4">
              {isFri ? (
                <div className="h-full flex flex-col justify-center space-y-1">
                  <div className="font-display font-bold text-[#201A17] dark:text-[#EDE0DB]">
                    Night Order: Friday Closed
                  </div>
                  <p className="text-sm text-[#52443E] dark:text-[#D7C3BC]">
                    No night meal preparation on Fridays per mess rules.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-[#85736D] dark:text-[#A08C86]">
                        Night Kitchen Order · {formatReadableDate(selectedDate)}
                      </div>
                      <div className="mt-1 font-display text-3xl font-bold font-mono tabular-nums text-[#201A17] dark:text-[#EDE0DB]">
                        {kitchenSummary.nightTotalPortions} portions
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#52443E] dark:text-[#D7C3BC]">
                      {kitchenSummary.nightFinalOrder
                        ? `Locked (${kitchenSummary.nightFinalOrder.lockedAtDhakaTime})`
                        : kitchenSummary.isNightLocked
                          ? 'Deadline Passed'
                          : 'Live Count'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E8D9D3] dark:border-[#3E322D] text-sm">
                    <div>
                      <div className="text-xs text-[#85736D] dark:text-[#A08C86]">Members</div>
                      <div className="font-mono tabular-nums font-bold text-[#201A17] dark:text-[#EDE0DB]">
                        {kitchenSummary.nightMemberCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[#85736D] dark:text-[#A08C86]">Guests</div>
                      <div className="font-mono tabular-nums font-bold text-[#201A17] dark:text-[#EDE0DB]">
                        {kitchenSummary.nightGuestCount}
                      </div>
                    </div>
                  </div>
                  {isManager && kitchenSummary.nightActive && (
                    <button
                      type="button"
                      onClick={() => saveFinalOrderSummary(selectedDate, 'NIGHT')}
                      className="w-full py-2 px-3 text-xs font-semibold text-[#201A17] dark:text-[#EDE0DB] bg-[#F4DFD7]/60 dark:bg-[#352A25] hover:bg-[#F4DFD7] dark:hover:bg-[#463832] rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>
                        {kitchenSummary.nightFinalOrder
                          ? 'Re-Lock Final Night Summary'
                          : 'Archive / Lock Final Night Summary'}
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Member Booking Roster */}
          <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-[#201A17] dark:text-[#EDE0DB]">
                  Member Booking Roster
                </h3>
                <p className="text-xs text-[#85736D] dark:text-[#A08C86]">
                  Real-time meal counts and confirmed unit weights for {formatReadableDate(selectedDate)}
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-[#F4DFD7]/60 dark:bg-[#352A25] rounded-lg max-w-full overflow-x-auto">
                {(
                  [
                    { id: 'all', label: `All (${members.length})` },
                    { id: 'lunch', label: `Lunch (${kitchenSummary.lunchMemberCount})` },
                    ...(!isFri
                      ? [{ id: 'night' as const, label: `Night (${kitchenSummary.nightMemberCount})` }]
                      : []),
                    { id: 'not_eating', label: 'Not Eating' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setRosterFilter(tab.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      rosterFilter === tab.id
                        ? 'bg-white dark:bg-[#221B18] text-[#201A17] dark:text-[#EDE0DB] shadow-sm'
                        : 'text-[#52443E] dark:text-[#D7C3BC] hover:text-[#201A17] dark:hover:text-[#EDE0DB]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E8D9D3] dark:border-[#3E322D] text-xs font-medium text-[#85736D] dark:text-[#A08C86]">
                    <th className="py-2.5 pr-4">Member</th>
                    <th className="py-2.5 pr-4">Lunch</th>
                    <th className="py-2.5 pr-4">Night</th>
                    <th className="py-2.5 pr-4 text-right">Confirmed Units</th>
                    {isManager && <th className="py-2.5 text-right">Manager Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8D9D3] dark:divide-[#3E322D]">
                  {filteredRoster.map(({ member, effective, mUnits, gUnits }) => (
                    <tr key={member.id} className="hover:bg-[#F4DFD7]/35 dark:hover:bg-[#352A25]/50">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-[#201A17] dark:text-[#EDE0DB]">{member.displayName}</div>
                        <div className="text-xs text-[#85736D] dark:text-[#A08C86]">
                          {member.room || 'Member'}
                          {effective.autoBooked && ' · Auto-booked'}
                          {effective.managerOverrideReason &&
                            ` · Override: ${effective.managerOverrideReason}`}
                        </div>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold ${
                            effective.statusLunch === 'BOOKED'
                              ? 'text-[#0D7351] dark:text-[#89D6B7]'
                              : effective.statusLunch === 'CANCELLED'
                                ? 'text-rose-700 dark:text-[#FFB4AB]'
                                : 'text-[#85736D] dark:text-[#A08C86]'
                          }`}
                        >
                          {effective.statusLunch}
                        </span>
                        {effective.guestLunch > 0 && (
                          <span className="ml-1.5 text-xs font-mono text-[#52443E] dark:text-[#D7C3BC]">
                            +{effective.guestLunch}G
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {isFri ? (
                          <span className="text-xs text-[#85736D] dark:text-[#A08C86]">Friday Off</span>
                        ) : (
                          <>
                            <span
                              className={`text-xs font-semibold ${
                                effective.statusNight === 'BOOKED'
                                  ? 'text-[#0D7351] dark:text-[#89D6B7]'
                                  : effective.statusNight === 'CANCELLED'
                                    ? 'text-rose-700 dark:text-[#FFB4AB]'
                                    : 'text-[#85736D] dark:text-[#A08C86]'
                              }`}
                            >
                              {effective.statusNight}
                            </span>
                            {effective.guestNight > 0 && (
                              <span className="ml-1.5 text-xs font-mono text-[#52443E] dark:text-[#D7C3BC]">
                                +{effective.guestNight}G
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums font-semibold text-[#201A17] dark:text-[#EDE0DB]">
                        {(mUnits + gUnits).toFixed(2).replace(/\.00$/, '')}
                        {gUnits > 0 && (
                          <span className="block text-[11px] font-normal text-[#85736D] dark:text-[#A08C86]">
                            {mUnits}M + {gUnits}G
                          </span>
                        )}
                      </td>
                      {isManager && (
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openOverrideFor(member)}
                            className="px-3 py-1.5 text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] border border-[#85736D]/50 dark:border-[#52443E] hover:bg-[#F4DFD7]/50 dark:hover:bg-[#352A25] rounded-lg whitespace-nowrap cursor-pointer"
                          >
                            Override
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HISTORICAL ATTENDANCE (Manager Only) */}
      {subTab === 'attendance' && isManager && (
        <HistoricalAttendancePanel
          date={selectedDate}
          isFri={isFri}
          members={members}
          lunchStatus={currentRecord?.lunchServiceStatus ?? 'ACTIVE'}
          nightStatus={currentRecord?.nightServiceStatus ?? 'ACTIVE'}
          attendances={currentRecord?.attendances ?? {}}
          onSaveAttendance={saveConfirmedAttendance}
        />
      )}

      {/* Configure Deadlines Modal */}
      {showDeadlineModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-[#201A17]/40 dark:bg-black/65 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-[#201A17] dark:text-[#EDE0DB]">
                Configure Cutoffs (Asia/Dhaka)
              </h3>
              <button
                type="button"
                onClick={() => setShowDeadlineModal(false)}
                aria-label="Close deadlines modal"
                className="p-1 text-[#85736D] dark:text-[#A08C86] hover:text-[#201A17] dark:hover:text-[#EDE0DB] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="lunch-cutoff" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Lunch Deadline (HH:mm 24-hour)
                </label>
                <input
                  id="lunch-cutoff"
                  type="time"
                  value={editLunchDeadline}
                  onChange={(e) => setEditLunchDeadline(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="night-cutoff" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Night Deadline (HH:mm 24-hour)
                </label>
                <input
                  id="night-cutoff"
                  type="time"
                  value={editNightDeadline}
                  onChange={(e) => setEditNightDeadline(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeadlineModal(false)}
                className="px-4 py-2 text-sm font-medium text-[#52443E] dark:text-[#D7C3BC] border border-[#85736D]/50 dark:border-[#52443E] rounded-lg hover:bg-[#F4DFD7]/40 dark:hover:bg-[#352A25] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await configureDeadlines(editLunchDeadline, editNightDeadline);
                  setShowDeadlineModal(false);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] rounded-lg cursor-pointer"
              >
                Save Deadlines
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meal Service Status Modal */}
      {showServiceModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-[#201A17]/40 dark:bg-black/65 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-[#201A17] dark:text-[#EDE0DB]">
                Service Status ({formatReadableDate(selectedDate)})
              </h3>
              <button
                type="button"
                onClick={() => setShowServiceModal(false)}
                aria-label="Close service status modal"
                className="p-1 text-[#85736D] dark:text-[#A08C86] hover:text-[#201A17] dark:hover:text-[#EDE0DB] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="lunch-service-select" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Lunch Service
                </label>
                <select
                  id="lunch-service-select"
                  value={editLunchService}
                  onChange={(e) => setEditLunchService(e.target.value as MealServiceStatus)}
                  className="w-full px-3 py-2 text-sm border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                >
                  <option value="ACTIVE">Active (Serving)</option>
                  <option value="CANCELLED">Cancelled (No Cooking)</option>
                </select>
              </div>
              {!isFri && (
                <div>
                  <label htmlFor="night-service-select" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                    Night Service
                  </label>
                  <select
                    id="night-service-select"
                    value={editNightService}
                    onChange={(e) => setEditNightService(e.target.value as MealServiceStatus)}
                    className="w-full px-3 py-2 text-sm border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                  >
                    <option value="ACTIVE">Active (Serving)</option>
                    <option value="CANCELLED">Cancelled (No Cooking)</option>
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="service-cancel-reason" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Notice / Cancellation Reason (Optional)
                </label>
                <input
                  id="service-cancel-reason"
                  type="text"
                  value={editCancelReason}
                  onChange={(e) => setEditCancelReason(e.target.value)}
                  placeholder="e.g. Gas maintenance / Eid holiday"
                  className="w-full px-3 py-2 text-sm border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowServiceModal(false)}
                className="px-4 py-2 text-sm font-medium text-[#52443E] dark:text-[#D7C3BC] border border-[#85736D]/50 dark:border-[#52443E] rounded-lg hover:bg-[#F4DFD7]/40 dark:hover:bg-[#352A25] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await updateMealServiceStatus(
                    selectedDate,
                    editLunchService,
                    isFri ? 'CANCELLED' : editNightService,
                    editCancelReason
                  );
                  setShowServiceModal(false);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] rounded-lg cursor-pointer"
              >
                Update Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manager Override Modal */}
      {overrideTarget && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-[#201A17]/40 dark:bg-black/65 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-[#FFB59A]" />
                <h3 className="font-display font-bold text-[#201A17] dark:text-[#EDE0DB]">
                  Override: {overrideTarget.displayName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOverrideTarget(null)}
                aria-label="Close override modal"
                className="p-1 text-[#85736D] dark:text-[#A08C86] hover:text-[#201A17] dark:hover:text-[#EDE0DB] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ovr-lunch" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                    Lunch Status
                  </label>
                  <select
                    id="ovr-lunch"
                    value={ovrLunch}
                    onChange={(e) => setOvrLunch(e.target.value as 'BOOKED' | 'CANCELLED')}
                    className="w-full px-3 py-2 border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                  >
                    <option value="BOOKED">BOOKED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="ovr-gl" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                    Lunch Guests
                  </label>
                  <input
                    id="ovr-gl"
                    type="number"
                    min={0}
                    value={ovrGuestLunch}
                    onChange={(e) => setOvrGuestLunch(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-3 py-2 font-mono border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                  />
                </div>
              </div>

              {!isFri && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ovr-night" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                      Night Status
                    </label>
                    <select
                      id="ovr-night"
                      value={ovrNight}
                      onChange={(e) => setOvrNight(e.target.value as 'BOOKED' | 'CANCELLED')}
                      className="w-full px-3 py-2 border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                    >
                      <option value="BOOKED">BOOKED</option>
                      <option value="CANCELLED">CANCELLED</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="ovr-gn" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                      Night Guests
                    </label>
                    <input
                      id="ovr-gn"
                      type="number"
                      min={0}
                      value={ovrGuestNight}
                      onChange={(e) => setOvrGuestNight(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-3 py-2 font-mono border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="ovr-reason" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Override Reason (Required for Audit Log)
                </label>
                <input
                  id="ovr-reason"
                  type="text"
                  value={ovrReason}
                  onChange={(e) => setOvrReason(e.target.value)}
                  placeholder="e.g. Member called manager before prep"
                  className="w-full px-3 py-2 border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOverrideTarget(null)}
                className="px-4 py-2 text-sm font-medium text-[#52443E] dark:text-[#D7C3BC] border border-[#85736D]/50 dark:border-[#52443E] rounded-lg hover:bg-[#F4DFD7]/40 dark:hover:bg-[#352A25] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!ovrReason.trim()}
                onClick={async () => {
                  const target = overrideTarget;
                  await managerOverrideBooking({
                    date: selectedDate,
                    memberId: target.id,
                    memberName: target.displayName,
                    statusLunch: ovrLunch,
                    statusNight: isFri ? 'CANCELLED' : ovrNight,
                    guestLunch: ovrGuestLunch,
                    guestNight: isFri ? 0 : ovrGuestNight,
                    reason: ovrReason,
                  });
                  setOverrideTarget(null);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] disabled:opacity-50 rounded-lg cursor-pointer"
              >
                Apply Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoricalAttendancePanel({
  date,
  isFri,
  members,
  lunchStatus,
  nightStatus,
  attendances,
  onSaveAttendance,
}: {
  date: string;
  isFri: boolean;
  members: Member[];
  lunchStatus: MealServiceStatus;
  nightStatus: MealServiceStatus;
  attendances: Record<string, MealAttendanceEntry>;
  onSaveAttendance: (params: {
    date: string;
    memberId: string;
    memberName: string;
    attendedLunch: boolean;
    attendedNight: boolean;
    guestLunchAttended: number;
    guestNightAttended: number;
  }) => Promise<void>;
}) {
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [attLunch, setAttLunch] = useState(false);
  const [attNight, setAttNight] = useState(false);
  const [attGL, setAttGL] = useState(0);
  const [attGN, setAttGN] = useState(0);

  const openEditor = (m: Member) => {
    const existing = attendances[m.id];
    setAttLunch(existing?.attendedLunch ?? false);
    setAttNight(existing?.attendedNight ?? false);
    setAttGL(existing?.guestLunchAttended ?? 0);
    setAttGN(existing?.guestNightAttended ?? 0);
    setEditingMember(m);
  };

  return (
    <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <UtensilsCrossed className="w-4 h-4 text-[#0D7351] dark:text-[#89D6B7]" />
        <div>
          <h3 className="font-display text-base font-bold text-[#201A17] dark:text-[#EDE0DB]">
            Historical Attendance Records ({formatReadableDate(date)})
          </h3>
          <p className="text-xs text-[#85736D] dark:text-[#A08C86]">
            Optional manager override for legacy attendance-based days. Adding attendance switches
            this date&apos;s billing to confirmed attendance entries.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#E8D9D3] dark:border-[#3E322D] text-xs font-medium text-[#85736D] dark:text-[#A08C86]">
              <th className="py-2.5 pr-4">Member</th>
              <th className="py-2.5 pr-4">Attended Lunch</th>
              <th className="py-2.5 pr-4">Attended Night</th>
              <th className="py-2.5 pr-4 text-right">Units</th>
              <th className="py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8D9D3] dark:divide-[#3E322D]">
            {members.map((m) => {
              const entry = attendances[m.id];
              const units = entry
                ? calculateAttendanceUnits({
                    isFriday: isFri,
                    lunchServiceStatus: lunchStatus,
                    nightServiceStatus: nightStatus,
                    attendance: entry,
                  })
                : 0;
              return (
                <tr key={m.id}>
                  <td className="py-3 pr-4 font-medium text-[#201A17] dark:text-[#EDE0DB]">{m.displayName}</td>
                  <td className="py-3 pr-4 text-[#52443E] dark:text-[#D7C3BC]">
                    {entry ? (entry.attendedLunch ? `Yes (+${entry.guestLunchAttended}G)` : 'No') : '—'}
                  </td>
                  <td className="py-3 pr-4 text-[#52443E] dark:text-[#D7C3BC]">
                    {isFri
                      ? 'Friday Off'
                      : entry
                        ? entry.attendedNight
                          ? `Yes (+${entry.guestNightAttended}G)`
                          : 'No'
                        : '—'}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums font-semibold text-[#201A17] dark:text-[#EDE0DB]">
                    {entry ? units : '—'}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEditor(m)}
                      className="px-3 py-1.5 text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] border border-[#85736D]/50 dark:border-[#52443E] rounded-lg hover:bg-[#F4DFD7]/35 dark:hover:bg-[#352A25] cursor-pointer"
                    >
                      Record
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingMember && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-[#201A17]/40 dark:bg-black/65 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl max-w-md w-full p-6 space-y-4">
            <h4 className="font-display font-bold text-[#201A17] dark:text-[#EDE0DB]">
              Confirm Attendance: {editingMember.displayName}
            </h4>
            <div className="space-y-3 text-sm text-[#201A17] dark:text-[#EDE0DB]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attLunch}
                  onChange={(e) => setAttLunch(e.target.checked)}
                />
                <span>Attended Lunch</span>
              </label>
              <div>
                <label htmlFor="att-gl" className="block text-xs text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Lunch Guests Attended
                </label>
                <input
                  id="att-gl"
                  type="number"
                  min={0}
                  value={attGL}
                  onChange={(e) => setAttGL(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 font-mono border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                />
              </div>

              {!isFri && (
                <>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attNight}
                      onChange={(e) => setAttNight(e.target.checked)}
                    />
                    <span>Attended Night</span>
                  </label>
                  <div>
                    <label htmlFor="att-gn" className="block text-xs text-[#52443E] dark:text-[#D7C3BC] mb-1">
                      Night Guests Attended
                    </label>
                    <input
                      id="att-gn"
                      type="number"
                      min={0}
                      value={attGN}
                      onChange={(e) => setAttGN(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-3 py-2 font-mono border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="px-4 py-2 text-sm font-medium text-[#52443E] dark:text-[#D7C3BC] border border-[#85736D]/50 dark:border-[#52443E] rounded-lg hover:bg-[#F4DFD7]/40 dark:hover:bg-[#352A25] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const m = editingMember;
                  await onSaveAttendance({
                    date,
                    memberId: m.id,
                    memberName: m.displayName,
                    attendedLunch: attLunch,
                    attendedNight: attNight,
                    guestLunchAttended: attGL,
                    guestNightAttended: attGN,
                  });
                  setEditingMember(null);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] rounded-lg cursor-pointer"
              >
                Save Attendance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
