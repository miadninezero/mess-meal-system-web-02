import {
  BazaarExpense,
  DailyMealRecord,
  Deposit,
  FinalOrderSummary,
  KitchenOrderSummary,
  MealAttendanceEntry,
  MealBookingEntry,
  Member,
  MemberSettlement,
  MessSummary,
  SharedBill,
  UtilityBill,
  defaultBookingEntry,
  getMemberPaid,
  getMemberShare,
  getSharedBillStats,
} from '../types/mess';
import { formatReadableDate, isDeadlinePassed, isFriday as checkIsFriday } from './dhakaTime';

export function roundTwoDecimals(value: number): number {
  return Math.round((value + (value >= 0 ? 1e-9 : -1e-9)) * 100) / 100;
}

/**
 * Calculates confirmed booking units for a member and their guests on a given date:
 * - Once the booking deadline passes (or FinalOrder is locked), BOOKED meals count toward monthly meal units.
 * - CANCELLED and NO_RESPONSE meals count as 0.
 * - Weighting rules:
 *   - Normal day (both meals active): Both = 2.0 units, Lunch only = 1.5 units, Night only = 1.0 unit.
 *   - Friday or any single-service day: Confirmed meal = 1.0 unit.
 * - Guest bookings follow the exact same weighting rules under the host member's account.
 */
export function calculateBookingUnits(params: {
  date: string;
  isFriday: boolean;
  lunchServiceStatus: string;
  nightServiceStatus: string;
  lunchDeadline: string;
  nightDeadline: string;
  booking: MealBookingEntry;
  lunchFinalOrder?: FinalOrderSummary | null;
  nightFinalOrder?: FinalOrderSummary | null;
  now?: Date;
}): [number, number] {
  const {
    date,
    isFriday,
    lunchServiceStatus,
    nightServiceStatus,
    lunchDeadline,
    nightDeadline,
    booking,
    lunchFinalOrder,
    nightFinalOrder,
    now,
  } = params;

  const lunchActive = lunchServiceStatus !== 'CANCELLED';
  const nightActive = isFriday ? false : nightServiceStatus !== 'CANCELLED';
  const totalServedMeals = (lunchActive ? 1 : 0) + (nightActive ? 1 : 0);

  if (totalServedMeals === 0) return [0, 0];

  const isLunchLocked =
    isDeadlinePassed(date, lunchDeadline, now) || lunchFinalOrder?.isLocked === true;
  const isNightLocked = isFriday
    ? true
    : isDeadlinePassed(date, nightDeadline, now) || nightFinalOrder?.isLocked === true;

  const confirmedLunch = lunchActive && isLunchLocked && booking.statusLunch === 'BOOKED';
  const confirmedNight = nightActive && isNightLocked && booking.statusNight === 'BOOKED';

  const computePersonUnits = (hasL: boolean, hasN: boolean): number => {
    if (totalServedMeals === 2) {
      if (hasL && hasN) return 2.0;
      if (hasL && !hasN) return 1.5;
      if (!hasL && hasN) return 1.0;
      return 0.0;
    }
    if (totalServedMeals === 1) {
      const hasServed = (lunchActive && hasL) || (nightActive && hasN);
      return hasServed ? 1.0 : 0.0;
    }
    return 0.0;
  };

  const memberUnits = computePersonUnits(confirmedLunch, confirmedNight);

  const confirmedGuestLunch =
    lunchActive && isLunchLocked ? Math.max(0, booking.guestLunch || 0) : 0;
  const confirmedGuestNight =
    nightActive && isNightLocked ? Math.max(0, booking.guestNight || 0) : 0;

  const guestsBoth = Math.min(confirmedGuestLunch, confirmedGuestNight);
  const guestsOnlyLunch = confirmedGuestLunch - guestsBoth;
  const guestsOnlyNight = confirmedGuestNight - guestsBoth;

  const guestUnits =
    guestsBoth * computePersonUnits(true, true) +
    guestsOnlyLunch * computePersonUnits(true, false) +
    guestsOnlyNight * computePersonUnits(false, true);

  return [roundTwoDecimals(memberUnits), roundTwoDecimals(guestUnits)];
}

/**
 * Preserved calculation for historical attendance records.
 * Returns [memberUnits, guestUnits] with exact weighting rules.
 */
export function calculateAttendanceUnitsDetailed(params: {
  isFriday: boolean;
  lunchServiceStatus: string;
  nightServiceStatus: string;
  attendance: MealAttendanceEntry;
}): [number, number] {
  const { isFriday, lunchServiceStatus, nightServiceStatus, attendance } = params;
  const lunchActive = lunchServiceStatus === 'ACTIVE';
  const nightActive = isFriday ? false : nightServiceStatus === 'ACTIVE';
  const totalServedMeals = (lunchActive ? 1 : 0) + (nightActive ? 1 : 0);

  const computePersonUnits = (ateLunch: boolean, ateNight: boolean): number => {
    if (totalServedMeals === 2) {
      if (ateLunch && ateNight) return 2.0;
      if (ateLunch && !ateNight) return 1.5;
      if (!ateLunch && ateNight) return 1.0;
      return 0.0;
    }
    if (totalServedMeals === 1) {
      const ateServed = (lunchActive && ateLunch) || (nightActive && ateNight);
      return ateServed ? 1.0 : 0.0;
    }
    return 0.0;
  };

  const memberUnits = computePersonUnits(attendance.attendedLunch, attendance.attendedNight);
  const gL = Math.max(0, attendance.guestLunchAttended || 0);
  const gN = Math.max(0, attendance.guestNightAttended || 0);
  const guestsBoth = Math.min(gL, gN);
  const guestsOnlyLunch = gL - guestsBoth;
  const guestsOnlyNight = gN - guestsBoth;

  const guestUnits =
    guestsBoth * computePersonUnits(true, true) +
    guestsOnlyLunch * computePersonUnits(true, false) +
    guestsOnlyNight * computePersonUnits(false, true);

  return [roundTwoDecimals(memberUnits), roundTwoDecimals(guestUnits)];
}

export function calculateAttendanceUnits(params: {
  isFriday: boolean;
  lunchServiceStatus: string;
  nightServiceStatus: string;
  attendance: MealAttendanceEntry;
}): number {
  const [mUnits, gUnits] = calculateAttendanceUnitsDetailed(params);
  return roundTwoDecimals(mUnits + gUnits);
}

export function resolveEffectiveBooking(params: {
  member: Member;
  explicitBooking?: MealBookingEntry | null;
  date: string;
  isFriday: boolean;
}): MealBookingEntry {
  const { member, explicitBooking, date, isFriday } = params;
  const base = explicitBooking ? { ...explicitBooking } : defaultBookingEntry();

  if (!member.autoBookEnabled || !member.isActive) return base;
  if (member.autoBookUpdatedAt && date < member.autoBookUpdatedAt) return base;

  const lunchNeedsAuto = base.statusLunch === 'NO_RESPONSE';
  const nightNeedsAuto = !isFriday && base.statusNight === 'NO_RESPONSE';
  if (!lunchNeedsAuto && !nightNeedsAuto) return base;

  const effectiveLunch = lunchNeedsAuto
    ? member.autoBookLunch
      ? 'BOOKED'
      : 'CANCELLED'
    : base.statusLunch;

  const effectiveNight = isFriday
    ? 'CANCELLED'
    : nightNeedsAuto
      ? member.autoBookNight
        ? 'BOOKED'
        : 'CANCELLED'
      : base.statusNight;

  return {
    ...base,
    statusLunch: effectiveLunch,
    statusNight: effectiveNight,
    autoBooked: base.autoBooked || lunchNeedsAuto || nightNeedsAuto,
  };
}

export function calculateDayTotalUnits(params: {
  record: DailyMealRecord;
  members: Member[];
  lunchDeadline?: string;
  nightDeadline?: string;
  now?: Date;
}): number {
  const {
    record,
    members,
    lunchDeadline = '09:00',
    nightDeadline = '17:00',
    now,
  } = params;
  const isFri = record.isFriday || checkIsFriday(record.date);

  const attendanceValues = Object.values(record.attendances || {});
  if (attendanceValues.length > 0) {
    const sum = attendanceValues.reduce(
      (acc, attendance) =>
        acc +
        calculateAttendanceUnits({
          isFriday: isFri,
          lunchServiceStatus: record.lunchServiceStatus,
          nightServiceStatus: record.nightServiceStatus,
          attendance,
        }),
      0
    );
    return roundTwoDecimals(sum);
  }

  let total = 0;
  for (const member of members) {
    const booking = resolveEffectiveBooking({
      member,
      explicitBooking: record.bookings?.[member.id],
      date: record.date,
      isFriday: isFri,
    });
    const [mUnits, gUnits] = calculateBookingUnits({
      date: record.date,
      isFriday: isFri,
      lunchServiceStatus: record.lunchServiceStatus,
      nightServiceStatus: record.nightServiceStatus,
      lunchDeadline,
      nightDeadline,
      booking,
      lunchFinalOrder: record.lunchFinalOrder,
      nightFinalOrder: record.nightFinalOrder,
      now,
    });
    total += mUnits + gUnits;
  }

  const accountedIds = new Set(members.map((m) => m.id));
  for (const [id, b] of Object.entries(record.bookings || {})) {
    if (!accountedIds.has(id)) {
      const [mUnits, gUnits] = calculateBookingUnits({
        date: record.date,
        isFriday: isFri,
        lunchServiceStatus: record.lunchServiceStatus,
        nightServiceStatus: record.nightServiceStatus,
        lunchDeadline,
        nightDeadline,
        booking: b,
        lunchFinalOrder: record.lunchFinalOrder,
        nightFinalOrder: record.nightFinalOrder,
        now,
      });
      total += mUnits + gUnits;
    }
  }

  return roundTwoDecimals(total);
}

export function calculateSummary(params: {
  members: Member[];
  dailyMeals: DailyMealRecord[];
  bazaarExpenses: BazaarExpense[];
  deposits: Deposit[];
  utilityBills: UtilityBill[];
  sharedBills?: SharedBill[];
  lunchDeadline?: string;
  nightDeadline?: string;
  now?: Date;
}): MessSummary {
  const {
    members,
    dailyMeals,
    bazaarExpenses,
    deposits,
    utilityBills,
    sharedBills = [],
    lunchDeadline = '09:00',
    nightDeadline = '17:00',
    now,
  } = params;

  const activeMembers = members.filter((m) => m.isActive);
  const memberCount = activeMembers.length;

  const totalBazaarCost = bazaarExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const memberUnitsMap: Record<string, number> = {};
  const memberOnlyUnitsMap: Record<string, number> = {};
  const guestOnlyUnitsMap: Record<string, number> = {};
  let totalMessUnits = 0;

  for (const record of dailyMeals) {
    const isFri = record.isFriday || checkIsFriday(record.date);
    const hasAttendance = Object.keys(record.attendances || {}).length > 0;

    if (hasAttendance) {
      for (const [memberId, attendance] of Object.entries(record.attendances)) {
        const [mUnits, gUnits] = calculateAttendanceUnitsDetailed({
          isFriday: isFri,
          lunchServiceStatus: record.lunchServiceStatus,
          nightServiceStatus: record.nightServiceStatus,
          attendance,
        });
        const dayTotal = mUnits + gUnits;
        memberUnitsMap[memberId] = (memberUnitsMap[memberId] ?? 0) + dayTotal;
        memberOnlyUnitsMap[memberId] = (memberOnlyUnitsMap[memberId] ?? 0) + mUnits;
        guestOnlyUnitsMap[memberId] = (guestOnlyUnitsMap[memberId] ?? 0) + gUnits;
        totalMessUnits += dayTotal;
      }
    } else {
      const accountedIds = new Set<string>();
      for (const [memberId, booking] of Object.entries(record.bookings || {})) {
        accountedIds.add(memberId);
        const memberObj = members.find((m) => m.id === memberId);
        const effectiveBooking = memberObj
          ? resolveEffectiveBooking({
              member: memberObj,
              explicitBooking: booking,
              date: record.date,
              isFriday: isFri,
            })
          : booking;

        const [mUnits, gUnits] = calculateBookingUnits({
          date: record.date,
          isFriday: isFri,
          lunchServiceStatus: record.lunchServiceStatus,
          nightServiceStatus: record.nightServiceStatus,
          lunchDeadline,
          nightDeadline,
          booking: effectiveBooking,
          lunchFinalOrder: record.lunchFinalOrder,
          nightFinalOrder: record.nightFinalOrder,
          now,
        });
        const memberDayTotal = mUnits + gUnits;
        memberUnitsMap[memberId] = (memberUnitsMap[memberId] ?? 0) + memberDayTotal;
        memberOnlyUnitsMap[memberId] = (memberOnlyUnitsMap[memberId] ?? 0) + mUnits;
        guestOnlyUnitsMap[memberId] = (guestOnlyUnitsMap[memberId] ?? 0) + gUnits;
        totalMessUnits += memberDayTotal;
      }

      for (const member of members) {
        if (!accountedIds.has(member.id) && member.autoBookEnabled && member.isActive) {
          const effectiveBooking = resolveEffectiveBooking({
            member,
            explicitBooking: null,
            date: record.date,
            isFriday: isFri,
          });
          const [mUnits, gUnits] = calculateBookingUnits({
            date: record.date,
            isFriday: isFri,
            lunchServiceStatus: record.lunchServiceStatus,
            nightServiceStatus: record.nightServiceStatus,
            lunchDeadline,
            nightDeadline,
            booking: effectiveBooking,
            lunchFinalOrder: record.lunchFinalOrder,
            nightFinalOrder: record.nightFinalOrder,
            now,
          });
          const memberDayTotal = mUnits + gUnits;
          memberUnitsMap[member.id] = (memberUnitsMap[member.id] ?? 0) + memberDayTotal;
          memberOnlyUnitsMap[member.id] = (memberOnlyUnitsMap[member.id] ?? 0) + mUnits;
          guestOnlyUnitsMap[member.id] = (guestOnlyUnitsMap[member.id] ?? 0) + gUnits;
          totalMessUnits += memberDayTotal;
        }
      }
    }
  }

  // Meal Rate = Total Bazaar Cost / Total Mess Units (Shared bills do NOT affect meal rate)
  const mealRate = totalMessUnits > 0 ? totalBazaarCost / totalMessUnits : 0;

  // Utility bills split equally among active members
  const totalUtilities = utilityBills.reduce((sum, u) => sum + (u.amount || 0), 0);
  const perHeadUtility = memberCount > 0 ? totalUtilities / memberCount : 0;

  // Shared Bills totals
  const totalSharedBills = sharedBills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  let totalSharedBillsCollected = 0;
  let totalSharedBillsUnpaid = 0;
  for (const bill of sharedBills) {
    const stats = getSharedBillStats(bill);
    totalSharedBillsCollected += stats.totalCollected;
    totalSharedBillsUnpaid += stats.outstandingBalance;
  }

  // Deposits per member
  const memberDepositsMap: Record<string, number> = {};
  let totalDeposits = 0;
  for (const deposit of deposits) {
    memberDepositsMap[deposit.memberId] =
      (memberDepositsMap[deposit.memberId] ?? 0) + (deposit.amount || 0);
    totalDeposits += deposit.amount || 0;
  }

  // Member settlements (include unpaid shared bills without double-counting already paid shares)
  const settlements: MemberSettlement[] = members.map((member) => {
    const totalUnits = memberUnitsMap[member.id] ?? 0;
    const mUnits = memberOnlyUnitsMap[member.id] ?? totalUnits;
    const gUnits = guestOnlyUnitsMap[member.id] ?? 0;
    const mealCost = totalUnits * mealRate;
    const utilityShare = member.isActive ? perHeadUtility : 0;

    let memberSharedBillsShare = 0;
    let memberSharedBillsPaid = 0;
    for (const bill of sharedBills) {
      memberSharedBillsShare += getMemberShare(bill, member.id);
      memberSharedBillsPaid += getMemberPaid(bill, member.id);
    }
    const memberSharedBillsUnpaid = Math.max(0, memberSharedBillsShare - memberSharedBillsPaid);

    const totalCost = mealCost + utilityShare + memberSharedBillsUnpaid;
    const deposit = memberDepositsMap[member.id] ?? 0;
    const netBalance = deposit - totalCost;

    return {
      memberId: member.id,
      memberName: member.displayName.trim() || 'Member',
      totalUnits: roundTwoDecimals(totalUnits),
      memberUnits: roundTwoDecimals(mUnits),
      guestUnits: roundTwoDecimals(gUnits),
      mealCost: roundTwoDecimals(mealCost),
      utilityCost: roundTwoDecimals(utilityShare),
      sharedBillsUnpaid: roundTwoDecimals(memberSharedBillsUnpaid),
      sharedBillsPaid: roundTwoDecimals(memberSharedBillsPaid),
      totalCost: roundTwoDecimals(totalCost),
      totalDeposit: roundTwoDecimals(deposit),
      netBalance: roundTwoDecimals(netBalance),
    };
  });

  const remainingFund = totalDeposits - totalBazaarCost - totalUtilities;

  return {
    totalUnits: roundTwoDecimals(totalMessUnits),
    totalBazaarCost: roundTwoDecimals(totalBazaarCost),
    mealRate: roundTwoDecimals(mealRate),
    totalDeposits: roundTwoDecimals(totalDeposits),
    totalUtilities: roundTwoDecimals(totalUtilities),
    totalSharedBills: roundTwoDecimals(totalSharedBills),
    totalSharedBillsCollected: roundTwoDecimals(totalSharedBillsCollected),
    totalSharedBillsUnpaid: roundTwoDecimals(totalSharedBillsUnpaid),
    remainingFund: roundTwoDecimals(remainingFund),
    memberSettlements: settlements,
  };
}

export function computeKitchenOrderSummary(params: {
  selectedDate: string;
  todayDhakaDate: string;
  dailyMeals: DailyMealRecord[];
  members: Member[];
  lunchDeadline: string;
  nightDeadline: string;
  now?: Date;
}): KitchenOrderSummary {
  const {
    selectedDate,
    todayDhakaDate,
    dailyMeals,
    members,
    lunchDeadline,
    nightDeadline,
    now,
  } = params;

  const record = dailyMeals.find((r) => r.id === selectedDate || r.date === selectedDate);
  const isFri = record?.isFriday ?? checkIsFriday(selectedDate);
  const lunchActive = record?.lunchServiceStatus !== 'CANCELLED';
  const nightActive = isFri ? false : record?.nightServiceStatus !== 'CANCELLED';
  const isLunchLocked =
    isDeadlinePassed(selectedDate, lunchDeadline, now) ||
    record?.lunchFinalOrder?.isLocked === true;
  const isNightLocked = isFri
    ? true
    : isDeadlinePassed(selectedDate, nightDeadline, now) ||
      record?.nightFinalOrder?.isLocked === true;

  let lunchMembers = 0;
  let lunchGuests = 0;
  let nightMembers = 0;
  let nightGuests = 0;
  const accountedIds = new Set<string>();

  for (const member of members) {
    accountedIds.add(member.id);
    const explicit = record?.bookings?.[member.id];
    const effective =
      selectedDate >= todayDhakaDate || record != null
        ? resolveEffectiveBooking({
            member,
            explicitBooking: explicit,
            date: selectedDate,
            isFriday: isFri,
          })
        : explicit ?? defaultBookingEntry();

    if (lunchActive && effective.statusLunch === 'BOOKED') {
      lunchMembers += 1;
      lunchGuests += Math.max(0, effective.guestLunch || 0);
    }
    if (nightActive && effective.statusNight === 'BOOKED') {
      nightMembers += 1;
      nightGuests += Math.max(0, effective.guestNight || 0);
    }
  }

  for (const [id, b] of Object.entries(record?.bookings || {})) {
    if (!accountedIds.has(id)) {
      if (lunchActive && b.statusLunch === 'BOOKED') {
        lunchMembers += 1;
        lunchGuests += Math.max(0, b.guestLunch || 0);
      }
      if (nightActive && b.statusNight === 'BOOKED') {
        nightMembers += 1;
        nightGuests += Math.max(0, b.guestNight || 0);
      }
    }
  }

  let attendedLunchCount = 0;
  let attendedNightCount = 0;
  for (const a of Object.values(record?.attendances || {})) {
    if (lunchActive && a.attendedLunch) {
      attendedLunchCount += 1 + Math.max(0, a.guestLunchAttended || 0);
    }
    if (nightActive && a.attendedNight) {
      attendedNightCount += 1 + Math.max(0, a.guestNightAttended || 0);
    }
  }

  return {
    lunchTotalPortions: lunchMembers + lunchGuests,
    lunchMemberCount: lunchMembers,
    lunchGuestCount: lunchGuests,
    nightTotalPortions: nightMembers + nightGuests,
    nightMemberCount: nightMembers,
    nightGuestCount: nightGuests,
    attendedLunchCount,
    attendedNightCount,
    lunchActive,
    nightActive,
    isFriday: isFri,
    cancellationReason: record?.cancellationReason ?? '',
    isLunchLocked,
    isNightLocked,
    lunchFinalOrder: record?.lunchFinalOrder ?? null,
    nightFinalOrder: record?.nightFinalOrder ?? null,
  };
}

export function generateSettlementReportText(params: {
  messName: string;
  activeMonth: string;
  summary: MessSummary;
  todayDhakaDate: string;
}): string {
  const { messName, activeMonth, summary, todayDhakaDate } = params;
  const lines = [
    `${messName} — Monthly Settlement Report`,
    `Month: ${activeMonth} | Generated: ${formatReadableDate(todayDhakaDate)}`,
    '----------------------------------------',
    `Final Meal Rate: ৳${summary.mealRate.toFixed(2)} / unit`,
    `Total Confirmed Units: ${summary.totalUnits}`,
    `Total Bazaar Cost: ৳${summary.totalBazaarCost.toFixed(2)}`,
    `Total Fixed Utilities: ৳${summary.totalUtilities.toFixed(2)}`,
    `Total Deposits: ৳${summary.totalDeposits.toFixed(2)}`,
    `Central Fund Remaining: ৳${summary.remainingFund.toFixed(2)}`,
    '----------------------------------------',
    'Member Settlements:',
  ];

  for (const s of summary.memberSettlements) {
    const statusLabel = s.netBalance >= 0 ? `Refund +৳${s.netBalance.toFixed(2)}` : `Payable -৳${Math.abs(s.netBalance).toFixed(2)}`;
    lines.push(
      `• ${s.memberName}: ${s.totalUnits} units (Meal ৳${s.mealCost.toFixed(2)} + Util ৳${s.utilityCost.toFixed(2)} + Unpaid Bills ৳${s.sharedBillsUnpaid.toFixed(2)}) | Deposit ৳${s.totalDeposit.toFixed(2)} => ${statusLabel}`
    );
  }

  return lines.join('\n');
}

const CHART_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export interface MonthlyFinanceComparison {
  monthKey: string;
  label: string;
  fullLabel: string;
  bazaarExpenses: number;
  memberDeposits: number;
  netBalance: number;
}

/**
 * Aggregates monthly total bazaar expenses vs total member deposits
 * across the last `monthCount` (default 6) calendar months ending on `referenceDate`.
 */
export function computeMonthlyBazaarVsDeposits(params: {
  bazaarExpenses: BazaarExpense[];
  deposits: Deposit[];
  referenceDate: string;
  monthCount?: number;
}): MonthlyFinanceComparison[] {
  const { bazaarExpenses, deposits, referenceDate, monthCount = 6 } = params;
  const count = Math.max(1, Math.min(24, Math.floor(monthCount)));

  const match = /^(\d{4})-(\d{2})/.exec((referenceDate || '').trim());
  const now = new Date();
  const endYear = match ? Number.parseInt(match[1], 10) : now.getUTCFullYear();
  const endMonth = match ? Number.parseInt(match[2], 10) : now.getUTCMonth() + 1;

  const bazaarByMonth: Record<string, number> = {};
  for (const exp of bazaarExpenses) {
    const key = (exp.date || '').trim().slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(key)) {
      bazaarByMonth[key] = (bazaarByMonth[key] ?? 0) + (Number(exp.amount) || 0);
    }
  }

  const depositsByMonth: Record<string, number> = {};
  for (const dep of deposits) {
    const key = (dep.date || '').trim().slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(key)) {
      depositsByMonth[key] = (depositsByMonth[key] ?? 0) + (Number(dep.amount) || 0);
    }
  }

  const months: { year: number; month: number; monthKey: string }[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const absoluteMonth = endYear * 12 + (endMonth - 1) - offset;
    const year = Math.floor(absoluteMonth / 12);
    const month = ((absoluteMonth % 12) + 12) % 12 + 1;
    const monthKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
    months.push({ year, month, monthKey });
  }

  const distinctYears = new Set(months.map((m) => m.year));
  const spansMultipleYears = distinctYears.size > 1;

  return months.map(({ year, month, monthKey }) => {
    const shortName = CHART_MONTH_NAMES[month - 1] ?? monthKey;
    const bazaarTotal = roundTwoDecimals(bazaarByMonth[monthKey] ?? 0);
    const depositTotal = roundTwoDecimals(depositsByMonth[monthKey] ?? 0);
    return {
      monthKey,
      label: spansMultipleYears ? `${shortName} '${String(year).slice(-2)}` : shortName,
      fullLabel: `${shortName} ${year}`,
      bazaarExpenses: bazaarTotal,
      memberDeposits: depositTotal,
      netBalance: roundTwoDecimals(depositTotal - bazaarTotal),
    };
  });
}
