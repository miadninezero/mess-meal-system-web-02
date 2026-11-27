import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateEqualShares,
  buildMemberSummaryRows,
  calculateAttendanceUnits,
  calculateBookingUnits,
  calculateDayTotalUnits,
  calculateSummary,
  computeKitchenOrderSummary,
  computeMonthlyBazaarVsDeposits,
  getMemberBalanceStatus,
  planInactiveMemberBookingCancellations,
  resolveEffectiveBooking,
  roundTwoDecimals,
} from './messCalculations';
import {
  format12Hour,
  formatReadableDate,
  getTodayDhakaDate,
  isDeadlinePassed,
  isFriday,
  shiftDate,
} from './dhakaTime';
import {
  BillAllocationType,
  BillPaymentStatus,
  DailyMealRecord,
  Member,
  SharedBill,
  defaultBookingEntry,
  getMemberDue,
  getMemberPaymentStatus,
  getMemberShare,
  getSharedBillStats,
} from '../types/mess';
import { DEMO_USER_ID, demoMessService } from '../services/demoMessService';

function makeMember(id: string, name: string, isActive = true): Member {
  return {
    id,
    userId: id,
    displayName: name,
    room: '101',
    role: 'MEMBER',
    isActive,
    autoBookEnabled: false,
    autoBookLunch: true,
    autoBookNight: true,
    autoBookUpdatedAt: '',
  };
}

test('DhakaTimeHelper date and deadline checks', () => {
  assert.equal(format12Hour('09:00'), '09:00 AM');
  assert.equal(format12Hour('17:00'), '05:00 PM');
  assert.equal(format12Hour('12:00'), '12:00 PM');
  assert.equal(format12Hour('00:00'), '12:00 AM');
  assert.equal(formatReadableDate('2026-11-20'), '20 Nov 2026');
  assert.equal(shiftDate('2026-11-20', 1), '2026-11-21');
  assert.equal(shiftDate('2026-11-20', -1), '2026-11-19');
  assert.equal(isFriday('2026-11-20'), true);
  assert.equal(isFriday('2026-11-19'), false);

  const pastRef = new Date('2026-11-20T04:00:00Z'); // 10:00 AM Dhaka on 2026-11-20
  assert.equal(isDeadlinePassed('2026-11-20', '09:00', pastRef), true);
  assert.equal(isDeadlinePassed('2026-11-20', '17:00', pastRef), false);
});

test('Normal day booking weighting: both=2, lunch=1.5, night=1, guests match host weighting', () => {
  const pastRef = new Date('2026-11-20T18:00:00Z'); // well after both deadlines on 2026-11-19
  const both = calculateBookingUnits({
    date: '2026-11-19',
    isFriday: false,
    lunchServiceStatus: 'ACTIVE',
    nightServiceStatus: 'ACTIVE',
    lunchDeadline: '09:00',
    nightDeadline: '17:00',
    booking: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED', guestLunch: 1, guestNight: 1 },
    now: pastRef,
  });
  assert.deepEqual(both, [2.0, 2.0]);

  const lunchOnly = calculateBookingUnits({
    date: '2026-11-19',
    isFriday: false,
    lunchServiceStatus: 'ACTIVE',
    nightServiceStatus: 'ACTIVE',
    lunchDeadline: '09:00',
    nightDeadline: '17:00',
    booking: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'CANCELLED', guestLunch: 2, guestNight: 0 },
    now: pastRef,
  });
  assert.deepEqual(lunchOnly, [1.5, 3.0]);

  const nightOnly = calculateBookingUnits({
    date: '2026-11-19',
    isFriday: false,
    lunchServiceStatus: 'ACTIVE',
    nightServiceStatus: 'ACTIVE',
    lunchDeadline: '09:00',
    nightDeadline: '17:00',
    booking: { ...defaultBookingEntry(), statusLunch: 'NO_RESPONSE', statusNight: 'BOOKED', guestLunch: 0, guestNight: 2 },
    now: pastRef,
  });
  assert.deepEqual(nightOnly, [1.0, 2.0]);
});

test('Friday and single-service cancellation weighting rules', () => {
  const pastRef = new Date('2026-11-21T00:00:00Z');
  const fridayUnits = calculateBookingUnits({
    date: '2026-11-20',
    isFriday: true,
    lunchServiceStatus: 'ACTIVE',
    nightServiceStatus: 'CANCELLED',
    lunchDeadline: '09:00',
    nightDeadline: '17:00',
    booking: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED', guestLunch: 1, guestNight: 1 },
    now: pastRef,
  });
  assert.deepEqual(fridayUnits, [1.0, 1.0]);

  const lunchCancelledUnits = calculateAttendanceUnits({
    isFriday: false,
    lunchServiceStatus: 'CANCELLED',
    nightServiceStatus: 'ACTIVE',
    attendance: { attendedLunch: true, attendedNight: true, guestLunchAttended: 0, guestNightAttended: 0, calculatedUnits: 0 },
  });
  assert.equal(lunchCancelledUnits, 1.0);
});

test('Auto-booking resolution respects toggle, manual cancel preservation, and Friday rules', () => {
  const autoMember: Member = {
    ...makeMember('m1', 'Tanvir'),
    autoBookEnabled: true,
    autoBookLunch: true,
    autoBookNight: true,
    autoBookUpdatedAt: '2026-11-19',
  };

  const resolvedAuto = resolveEffectiveBooking({
    member: autoMember,
    explicitBooking: null,
    date: '2026-11-19',
    isFriday: false,
  });
  assert.equal(resolvedAuto.statusLunch, 'BOOKED');
  assert.equal(resolvedAuto.statusNight, 'BOOKED');
  assert.equal(resolvedAuto.autoBooked, true);

  const manualCancel = { ...defaultBookingEntry(), statusLunch: 'CANCELLED' as const, statusNight: 'NO_RESPONSE' as const };
  const resolvedWithCancel = resolveEffectiveBooking({
    member: autoMember,
    explicitBooking: manualCancel,
    date: '2026-11-19',
    isFriday: false,
  });
  assert.equal(resolvedWithCancel.statusLunch, 'CANCELLED');
  assert.equal(resolvedWithCancel.statusNight, 'BOOKED');

  const resolvedFriday = resolveEffectiveBooking({
    member: autoMember,
    explicitBooking: null,
    date: '2026-11-20',
    isFriday: true,
  });
  assert.equal(resolvedFriday.statusLunch, 'BOOKED');
  assert.equal(resolvedFriday.statusNight, 'CANCELLED');
});

test('Summary & settlement with custom shared bills avoids double-counting paid shares', () => {
  const members = [makeMember('m1', 'Rahim'), makeMember('m2', 'Karim'), makeMember('m3', 'Jamal')];
  const customBill: SharedBill = {
    id: 'sb_custom',
    title: 'Room Electricity & Maintenance',
    allocationType: BillAllocationType.CUSTOM_PER_MEMBER,
    totalAmount: 1700,
    perMemberAmount: roundTwoDecimals(1700 / 3),
    month: '2026-11',
    deadline: '2026-11-25',
    notes: '',
    assignedMemberIds: ['m1', 'm2', 'm3'],
    memberShares: { m1: 800, m2: 500, m3: 400 },
    memberNames: { m1: 'Rahim', m2: 'Karim', m3: 'Jamal' },
    payments: {
      m1: {
        memberId: 'm1',
        memberName: 'Rahim',
        amountPaid: 800,
        status: BillPaymentStatus.PAID,
        paymentDate: '2026-11-20',
        paymentMethod: 'Cash',
        notes: '',
        recordedByUid: 'm1',
        recordedByName: 'Tanvir',
      },
      m2: {
        memberId: 'm2',
        memberName: 'Karim',
        amountPaid: 250,
        status: BillPaymentStatus.PARTIALLY_PAID,
        paymentDate: '2026-11-20',
        paymentMethod: 'bKash/Nagad',
        notes: '',
        recordedByUid: 'm1',
        recordedByName: 'Tanvir',
      },
    },
    createdByUid: 'm1',
    createdByName: 'Tanvir',
  };

  assert.equal(getMemberShare(customBill, 'm1'), 800);
  assert.equal(getMemberPaymentStatus(customBill, 'm1'), BillPaymentStatus.PAID);
  assert.equal(getMemberPaymentStatus(customBill, 'm2'), BillPaymentStatus.PARTIALLY_PAID);
  assert.equal(getMemberPaymentStatus(customBill, 'm3'), BillPaymentStatus.UNPAID);
  assert.equal(getMemberDue(customBill, 'm1'), 0);
  assert.equal(getMemberDue(customBill, 'm2'), 250);
  assert.equal(getMemberDue(customBill, 'm3'), 400);

  const meals: DailyMealRecord[] = [
    {
      id: '2026-11-18',
      date: '2026-11-18',
      isFriday: false,
      lunchServiceStatus: 'ACTIVE',
      nightServiceStatus: 'ACTIVE',
      cancellationReason: '',
      bookings: {
        m1: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED' },
        m2: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'CANCELLED' },
        m3: { ...defaultBookingEntry(), statusLunch: 'CANCELLED', statusNight: 'BOOKED' },
      },
      attendances: {},
      totalDayUnits: 4.5,
      totalDayMeals: 4.5,
      updatedBy: 'm1',
    },
  ];

  const summary = calculateSummary({
    members,
    dailyMeals: meals,
    bazaarExpenses: [{ id: 'b1', buyerMemberId: 'm1', buyerName: 'Rahim', amount: 450, itemsDescription: 'Rice & Veg', category: 'Groceries', date: '2026-11-18' }],
    deposits: [{ id: 'd1', memberId: 'm2', memberName: 'Karim', amount: 1000, date: '2026-11-18', paymentMethod: 'Cash', notes: '', recordedBy: 'm1' }],
    utilityBills: [{ id: 'u1', title: 'Cook Salary', amount: 300, month: '2026-11' }],
    sharedBills: [customBill],
    now: new Date('2026-11-26T00:00:00Z'),
  });

  // Total units = 2 + 1.5 + 1 = 4.5. Bazaar = 450 -> Meal rate = 100.
  assert.equal(summary.totalUnits, 4.5);
  assert.equal(summary.mealRate, 100);
  const karim = summary.memberSettlements.find((s) => s.memberId === 'm2')!;
  // Karim: 1.5 * 100 = 150 meal + 100 utility + 250 unpaid shared bill = 500 cost. Deposit 1000 => +500 balance.
  assert.equal(karim.mealCost, 150);
  assert.equal(karim.utilityCost, 100);
  assert.equal(karim.sharedBillsUnpaid, 250);
  assert.equal(karim.totalCost, 500);
  assert.equal(karim.netBalance, 500);
});

test('Kitchen summary aggregates member and guest portions cleanly', () => {
  const members = [makeMember('m1', 'A'), makeMember('m2', 'B')];
  const dailyMeals: DailyMealRecord[] = [
    {
      id: '2026-11-26',
      date: '2026-11-26',
      isFriday: false,
      lunchServiceStatus: 'ACTIVE',
      nightServiceStatus: 'ACTIVE',
      cancellationReason: '',
      bookings: {
        m1: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED', guestLunch: 2, guestNight: 1 },
        m2: { ...defaultBookingEntry(), statusLunch: 'CANCELLED', statusNight: 'BOOKED', guestLunch: 0, guestNight: 0 },
      },
      attendances: {},
      totalDayUnits: 0,
      totalDayMeals: 0,
      updatedBy: 'm1',
    },
  ];
  const ks = computeKitchenOrderSummary({
    selectedDate: '2026-11-26',
    todayDhakaDate: '2026-11-26',
    dailyMeals,
    members,
    lunchDeadline: '09:00',
    nightDeadline: '17:00',
    now: new Date('2026-11-26T02:00:00Z'),
  });
  assert.equal(ks.lunchMemberCount, 1);
  assert.equal(ks.lunchGuestCount, 2);
  assert.equal(ks.lunchTotalPortions, 3);
  assert.equal(ks.nightMemberCount, 2);
  assert.equal(ks.nightGuestCount, 1);
  assert.equal(ks.nightTotalPortions, 3);
});

test('Monthly bazaar vs deposits comparison aggregates last 6 months cleanly', () => {
  const series = computeMonthlyBazaarVsDeposits({
    referenceDate: '2026-11-26',
    bazaarExpenses: [
      { id: 'b0', buyerMemberId: 'm1', buyerName: 'A', amount: 999, itemsDescription: 'Too old', category: 'Misc', date: '2026-05-31' },
      { id: 'b1', buyerMemberId: 'm1', buyerName: 'A', amount: 4200, itemsDescription: 'Rice', category: 'Groceries', date: '2026-06-12' },
      { id: 'b2', buyerMemberId: 'm1', buyerName: 'A', amount: 3000.5, itemsDescription: 'Fish', category: 'Meat & Fish', date: '2026-06-25' },
      { id: 'b3', buyerMemberId: 'm1', buyerName: 'A', amount: 8500, itemsDescription: 'Monthly', category: 'Groceries', date: '2026-10-08' },
      { id: 'b4', buyerMemberId: 'm1', buyerName: 'A', amount: 4010, itemsDescription: 'Current', category: 'Groceries', date: '2026-11-25' },
    ],
    deposits: [
      { id: 'd1', memberId: 'm1', memberName: 'A', amount: 8500, date: '2026-06-02', paymentMethod: 'Cash', notes: '', recordedBy: 'm1' },
      { id: 'd2', memberId: 'm2', memberName: 'B', amount: 2500, date: '2026-09-05', paymentMethod: 'Bank', notes: '', recordedBy: 'm1' },
      { id: 'd3', memberId: 'm1', memberName: 'A', amount: 13200, date: '2026-11-01', paymentMethod: 'Cash', notes: '', recordedBy: 'm1' },
    ],
  });

  assert.equal(series.length, 6);
  assert.deepEqual(
    series.map((s) => s.monthKey),
    ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']
  );
  assert.deepEqual(
    series.map((s) => s.label),
    ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']
  );
  assert.equal(series[0].bazaarExpenses, 7200.5);
  assert.equal(series[0].memberDeposits, 8500);
  assert.equal(series[0].netBalance, 1299.5);
  assert.equal(series[1].bazaarExpenses, 0);
  assert.equal(series[1].memberDeposits, 0);
  assert.equal(series[3].memberDeposits, 2500);
  assert.equal(series[4].bazaarExpenses, 8500);
  assert.equal(series[5].bazaarExpenses, 4010);
  assert.equal(series[5].memberDeposits, 13200);
});

test('Monthly finance comparison handles cross-year 6-month windows', () => {
  const crossYear = computeMonthlyBazaarVsDeposits({
    referenceDate: '2026-02-15',
    bazaarExpenses: [
      { id: 'b1', buyerMemberId: 'm1', buyerName: 'A', amount: 1200, itemsDescription: 'Dec', category: 'Misc', date: '2025-12-10' },
    ],
    deposits: [
      { id: 'd1', memberId: 'm1', memberName: 'A', amount: 3000, date: '2026-01-03', paymentMethod: 'Cash', notes: '', recordedBy: 'm1' },
    ],
  });

  assert.deepEqual(
    crossYear.map((s) => s.monthKey),
    ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']
  );
  assert.deepEqual(
    crossYear.map((s) => s.label),
    ["Sep '25", "Oct '25", "Nov '25", "Dec '25", "Jan '26", "Feb '26"]
  );
  assert.equal(crossYear[3].bazaarExpenses, 1200);
  assert.equal(crossYear[4].memberDeposits, 3000);
});

test('Member summary rows calculate deposits, meals eaten, and balance status accurately', () => {
  assert.equal(getMemberBalanceStatus(120.5), 'REFUNDABLE');
  assert.equal(getMemberBalanceStatus(-45.2), 'PAYABLE');
  assert.equal(getMemberBalanceStatus(0.004), 'SETTLED');
  assert.equal(getMemberBalanceStatus(-0.004), 'SETTLED');

  const members: Member[] = [
    { ...makeMember('m1', 'Zahir'), room: '201', isActive: true },
    { ...makeMember('m2', 'Amina'), room: '102', isActive: true },
    { ...makeMember('m3', 'Bashir'), room: '305', isActive: false },
  ];

  const rows = buildMemberSummaryRows({
    members,
    currentMemberId: 'm1',
    settlements: [
      {
        memberId: 'm1',
        memberName: 'Zahir',
        totalUnits: 42,
        memberUnits: 40,
        guestUnits: 2,
        mealCost: 4200,
        utilityCost: 500,
        sharedBillsUnpaid: 0,
        sharedBillsPaid: 500,
        totalCost: 4700,
        totalDeposit: 5000,
        netBalance: 300,
      },
      {
        memberId: 'm2',
        memberName: 'Amina',
        totalUnits: 30,
        memberUnits: 30,
        guestUnits: 0,
        mealCost: 3000,
        utilityCost: 500,
        sharedBillsUnpaid: 200,
        sharedBillsPaid: 0,
        totalCost: 3700,
        totalDeposit: 3000,
        netBalance: -700,
      },
      {
        memberId: 'm3',
        memberName: 'Bashir',
        totalUnits: 10,
        memberUnits: 10,
        guestUnits: 0,
        mealCost: 1000,
        utilityCost: 0,
        sharedBillsUnpaid: 0,
        sharedBillsPaid: 0,
        totalCost: 1000,
        totalDeposit: 1000,
        netBalance: 0,
      },
    ],
  });

  // Active members sorted alphabetically first, inactive members last
  assert.deepEqual(
    rows.map((r) => r.memberName),
    ['Amina', 'Zahir', 'Bashir']
  );

  assert.equal(rows[0].status, 'PAYABLE');
  assert.equal(rows[0].totalDeposit, 3000);
  assert.equal(rows[0].totalUnits, 30);
  assert.equal(rows[0].isCurrentUser, false);

  assert.equal(rows[1].status, 'REFUNDABLE');
  assert.equal(rows[1].isCurrentUser, true);
  assert.equal(rows[1].room, '201');
  assert.equal(rows[1].guestUnits, 2);

  assert.equal(rows[2].status, 'SETTLED');
  assert.equal(rows[2].isActive, false);
});

test('Incomplete attendance applies per member without erasing other members confirmed bookings', () => {
  const autoMember: Member = {
    ...makeMember('m4', 'Nafis'),
    autoBookEnabled: true,
    autoBookLunch: true,
    autoBookNight: false,
    autoBookUpdatedAt: '2026-11-18',
  };
  const members = [
    makeMember('m1', 'Rahim'),
    makeMember('m2', 'Karim'),
    makeMember('m3', 'Jamal'),
    autoMember,
  ];

  const record: DailyMealRecord = {
    id: '2026-11-18',
    date: '2026-11-18',
    isFriday: false,
    lunchServiceStatus: 'ACTIVE',
    nightServiceStatus: 'ACTIVE',
    cancellationReason: '',
    bookings: {
      m1: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED' },
      m2: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED' },
      m3: { ...defaultBookingEntry(), statusLunch: 'CANCELLED', statusNight: 'BOOKED', guestNight: 1 },
    },
    // Manager only recorded attendance override for m1 (ate lunch only -> 1.5 instead of 2.0)
    attendances: {
      m1: {
        attendedLunch: true,
        attendedNight: false,
        guestLunchAttended: 0,
        guestNightAttended: 0,
        calculatedUnits: 1.5,
      },
    },
    totalDayUnits: 0,
    totalDayMeals: 0,
    updatedBy: 'm1',
  };

  const nowAfter = new Date('2026-11-19T00:00:00Z');
  // Expected: m1 = 1.5 (attendance), m2 = 2.0 (booking), m3 = 2.0 (1M + 1G booking), m4 = 1.5 (autoBook lunch only) => 7.0
  const dayTotal = calculateDayTotalUnits({ record, members, now: nowAfter });
  assert.equal(dayTotal, 7.0);

  const summary = calculateSummary({
    members,
    dailyMeals: [record],
    bazaarExpenses: [{ id: 'b1', buyerMemberId: 'm1', buyerName: 'Rahim', amount: 700, itemsDescription: 'Bazaar', category: 'Groceries', date: '2026-11-18' }],
    deposits: [],
    utilityBills: [],
    now: nowAfter,
  });

  assert.equal(summary.totalUnits, 7.0);
  assert.equal(summary.mealRate, 100);
  assert.equal(summary.memberSettlements.find((s) => s.memberId === 'm1')?.totalUnits, 1.5);
  assert.equal(summary.memberSettlements.find((s) => s.memberId === 'm2')?.totalUnits, 2.0);
  assert.equal(summary.memberSettlements.find((s) => s.memberId === 'm3')?.totalUnits, 2.0);
  assert.equal(summary.memberSettlements.find((s) => s.memberId === 'm4')?.totalUnits, 1.5);
});

test('Pre-joining automatic meal calculations are blocked before join date and before join-day cutoffs', () => {
  // Member joined on Wednesday 2026-11-18 at 14:00 Asia/Dhaka (08:00 UTC)
  const joinTimeMs = Date.UTC(2026, 10, 18, 8, 0, 0);
  const lateJoiner: Member = {
    ...makeMember('m_new', 'New Member'),
    autoBookEnabled: true,
    autoBookLunch: true,
    autoBookNight: true,
    autoBookUpdatedAt: '2026-11-18T14:05',
    createdAt: joinTimeMs,
  };

  // Day BEFORE joining (even if another record exists or stray autoBooked residue was present)
  const beforeJoin = resolveEffectiveBooking({
    member: lateJoiner,
    explicitBooking: null,
    date: '2026-11-17',
    isFriday: false,
    lunchDeadline: '09:00',
    nightDeadline: '17:00',
  });
  assert.equal(beforeJoin.statusLunch, 'NO_RESPONSE');
  assert.equal(beforeJoin.statusNight, 'NO_RESPONSE');

  const strayAutoBeforeJoin = resolveEffectiveBooking({
    member: lateJoiner,
    explicitBooking: {
      ...defaultBookingEntry(),
      statusLunch: 'BOOKED',
      statusNight: 'BOOKED',
      autoBooked: true,
    },
    date: '2026-11-16',
    isFriday: false,
    lunchDeadline: '09:00',
    nightDeadline: '17:00',
  });
  assert.equal(strayAutoBeforeJoin.statusLunch, 'NO_RESPONSE');
  assert.equal(strayAutoBeforeJoin.statusNight, 'NO_RESPONSE');

  // Even if autoBookUpdatedAt is empty string, pre-join dates must never auto-book
  const emptyAutoDateMember: Member = {
    ...lateJoiner,
    autoBookUpdatedAt: '',
  };
  const beforeJoinEmptyAuto = resolveEffectiveBooking({
    member: emptyAutoDateMember,
    explicitBooking: null,
    date: '2026-11-17',
    isFriday: false,
  });
  assert.equal(beforeJoinEmptyAuto.statusLunch, 'NO_RESPONSE');
  assert.equal(beforeJoinEmptyAuto.statusNight, 'NO_RESPONSE');

  // On join date (2026-11-18 at 14:00 Dhaka), lunch deadline 09:00 already passed, night deadline 17:00 is still open
  const onJoinDay = resolveEffectiveBooking({
    member: lateJoiner,
    explicitBooking: null,
    date: '2026-11-18',
    isFriday: false,
    lunchDeadline: '09:00',
    nightDeadline: '17:00',
  });
  assert.equal(onJoinDay.statusLunch, 'NO_RESPONSE');
  assert.equal(onJoinDay.statusNight, 'BOOKED');

  // Day AFTER joining -> both Lunch & Night auto-book normally
  const afterJoin = resolveEffectiveBooking({
    member: lateJoiner,
    explicitBooking: null,
    date: '2026-11-19',
    isFriday: false,
    lunchDeadline: '09:00',
    nightDeadline: '17:00',
  });
  assert.equal(afterJoin.statusLunch, 'BOOKED');
  assert.equal(afterJoin.statusNight, 'BOOKED');

  const summary = calculateSummary({
    members: [lateJoiner],
    dailyMeals: [
      {
        id: '2026-11-17',
        date: '2026-11-17',
        isFriday: false,
        lunchServiceStatus: 'ACTIVE',
        nightServiceStatus: 'ACTIVE',
        cancellationReason: '',
        bookings: {},
        attendances: {},
        totalDayUnits: 0,
        totalDayMeals: 0,
        updatedBy: 'admin',
      },
      {
        id: '2026-11-18',
        date: '2026-11-18',
        isFriday: false,
        lunchServiceStatus: 'ACTIVE',
        nightServiceStatus: 'ACTIVE',
        cancellationReason: '',
        bookings: {},
        attendances: {},
        totalDayUnits: 0,
        totalDayMeals: 0,
        updatedBy: 'admin',
      },
      {
        id: '2026-11-19',
        date: '2026-11-19',
        isFriday: false,
        lunchServiceStatus: 'ACTIVE',
        nightServiceStatus: 'ACTIVE',
        cancellationReason: '',
        bookings: {},
        attendances: {},
        totalDayUnits: 0,
        totalDayMeals: 0,
        updatedBy: 'admin',
      },
    ],
    bazaarExpenses: [],
    deposits: [],
    utilityBills: [],
    now: new Date('2026-11-20T00:00:00Z'),
  });

  // 0 (Nov 17 pre-join) + 1.0 (Nov 18 night only) + 2.0 (Nov 19 both) = 3.0 units
  assert.equal(summary.totalUnits, 3.0);
});

test('Shared bill equal splitting reconciles to exact total without paisa drift', async () => {
  const split3 = allocateEqualShares(100, ['m1', 'm2', 'm3']);
  assert.equal(split3.totalAmount, 100);
  assert.deepEqual(split3.memberShares, { m1: 33.34, m2: 33.33, m3: 33.33 });
  assert.equal(
    roundTwoDecimals(Object.values(split3.memberShares).reduce((a, b) => a + b, 0)),
    100
  );

  const split6 = allocateEqualShares(100, ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']);
  assert.equal(
    roundTwoDecimals(Object.values(split6.memberShares).reduce((a, b) => a + b, 0)),
    100
  );
  assert.deepEqual(split6.memberShares, {
    m1: 16.67,
    m2: 16.67,
    m3: 16.67,
    m4: 16.67,
    m5: 16.66,
    m6: 16.66,
  });

  // End-to-end demoMessService create + full payments leaves exactly 0 outstanding
  demoMessService.resetDemoData();
  let bills: SharedBill[] = [];
  let members: Member[] = [];
  const unsub = demoMessService.observeMessBundle('GV-MESS-2026', DEMO_USER_ID, {
    onSharedBills: (s) => {
      bills = s;
    },
    onMembers: (m) => {
      members = m;
    },
  });

  const threeMembers = members.slice(0, 3);
  const billId = await demoMessService.createSharedBill({
    messId: 'GV-MESS-2026',
    title: 'Water Filter Maintenance',
    allocationType: BillAllocationType.DIVIDED_EQUALLY,
    amountInput: 1000,
    month: getTodayDhakaDate().slice(0, 7),
    deadline: shiftDate(getTodayDhakaDate(), 3),
    notes: '',
    activeMembers: threeMembers,
    customShares: {},
  });

  const created = bills.find((b) => b.id === billId)!;
  assert.equal(created.totalAmount, 1000);
  const shareSum = roundTwoDecimals(
    Object.values(created.memberShares).reduce((a, b) => a + b, 0)
  );
  assert.equal(shareSum, 1000);

  for (const m of threeMembers) {
    const share = getMemberShare(created, m.id);
    const liveBill = bills.find((b) => b.id === billId)!;
    await demoMessService.recordBillPayment({
      messId: 'GV-MESS-2026',
      billId,
      memberId: m.id,
      memberName: m.displayName,
      assignedShare: share,
      amountPaid: share,
      paymentMethod: 'Cash',
      paymentDate: getTodayDhakaDate(),
      notes: '',
      expectedVersion: liveBill.version ?? 1,
    });
  }

  const paidBill = bills.find((b) => b.id === billId)!;
  const stats = getSharedBillStats(paidBill);
  assert.equal(stats.totalCollected, 1000);
  assert.equal(stats.outstandingBalance, 0);
  assert.equal(stats.paidMembersCount, 3);
  assert.equal(stats.unpaidMembersCount, 0);
  for (const m of threeMembers) {
    assert.equal(getMemberDue(paidBill, m.id), 0);
  }
  unsub();
});

test('Marking a member inactive disables auto-book, cancels unlocked future bookings, preserves locked/past meals, and blocks new self-bookings', async () => {
  // 1. Unit check on planInactiveMemberBookingCancellations at 11:00 Dhaka (lunch 09:00 passed, night 17:00 open) on Wednesday
  const today = '2026-11-25';
  const midDayNow = new Date('2026-11-25T05:00:00Z'); // 11:00 Asia/Dhaka
  const todayRecord: DailyMealRecord = {
    id: today,
    date: today,
    isFriday: false,
    lunchServiceStatus: 'ACTIVE',
    nightServiceStatus: 'ACTIVE',
    cancellationReason: '',
    bookings: {
      mem_rahim: {
        ...defaultBookingEntry(),
        statusLunch: 'BOOKED',
        statusNight: 'BOOKED',
        guestLunch: 1,
        guestNight: 2,
        autoBooked: true,
      },
    },
    attendances: {},
    totalDayUnits: 0,
    totalDayMeals: 0,
    version: 1,
    updatedBy: 'mem_rahim',
  };

  const todayPlan = planInactiveMemberBookingCancellations({
    record: todayRecord,
    memberId: 'mem_rahim',
    todayDate: today,
    lunchDeadline: '09:00',
    nightDeadline: '17:00',
    actorUid: 'mgr',
    now: midDayNow,
  });
  assert.equal(todayPlan.changed, true);
  // Lunch already passed -> preserved; Night still open -> cancelled & guests cleared
  assert.equal(todayPlan.updatedBooking.statusLunch, 'BOOKED');
  assert.equal(todayPlan.updatedBooking.guestLunch, 1);
  assert.equal(todayPlan.updatedBooking.statusNight, 'CANCELLED');
  assert.equal(todayPlan.updatedBooking.guestNight, 0);
  assert.equal(todayPlan.updatedBooking.autoBooked, false);

  // Past record -> untouched
  const pastPlan = planInactiveMemberBookingCancellations({
    record: { ...todayRecord, id: '2026-11-24', date: '2026-11-24' },
    memberId: 'mem_rahim',
    todayDate: today,
    actorUid: 'mgr',
    now: midDayNow,
  });
  assert.equal(pastPlan.changed, false);

  // 2. Service-level check in demoMessService
  demoMessService.resetDemoData();
  let members: Member[] = [];
  let dailyMeals: DailyMealRecord[] = [];
  const unsub = demoMessService.observeMessBundle('GV-MESS-2026', DEMO_USER_ID, {
    onMembers: (m) => {
      members = m;
    },
    onDailyMeals: (d) => {
      dailyMeals = d;
    },
  });

  const liveToday = getTodayDhakaDate();
  const futureDate = shiftDate(liveToday, 2);
  await demoMessService.saveMemberBooking({
    messId: 'GV-MESS-2026',
    date: futureDate,
    memberId: 'mem_rahim',
    booking: {
      ...defaultBookingEntry(),
      statusLunch: 'BOOKED',
      statusNight: 'BOOKED',
      guestLunch: 1,
      guestNight: 0,
    },
    lunchDeadline: '09:00',
    nightDeadline: '17:00',
    isManager: false,
    expectedVersion: null,
  });

  await demoMessService.updateMemberStatus('GV-MESS-2026', 'mem_rahim', false, {
    todayDate: liveToday,
    lunchDeadline: '09:00',
    nightDeadline: '17:00',
  });

  const rahim = members.find((m) => m.id === 'mem_rahim')!;
  assert.equal(rahim.isActive, false);
  assert.equal(rahim.autoBookEnabled, false);

  const futureRec = dailyMeals.find((r) => r.date === futureDate)!;
  assert.equal(futureRec.bookings.mem_rahim.statusLunch, 'CANCELLED');
  assert.equal(futureRec.bookings.mem_rahim.statusNight, 'CANCELLED');
  assert.equal(futureRec.bookings.mem_rahim.guestLunch, 0);
  assert.equal(futureRec.bookings.mem_rahim.autoBooked, false);
  assert.equal(futureRec.version, 2);

  // Yesterday's historical meal for mem_rahim remains untouched
  const yesterday = shiftDate(liveToday, -1);
  const yesterdayRec = dailyMeals.find((r) => r.date === yesterday)!;
  assert.equal(yesterdayRec.bookings.mem_rahim.statusLunch, 'BOOKED');
  assert.equal(yesterdayRec.bookings.mem_rahim.statusNight, 'BOOKED');

  // Inactive member cannot submit a new self-booking
  await assert.rejects(
    demoMessService.saveMemberBooking({
      messId: 'GV-MESS-2026',
      date: futureDate,
      memberId: 'mem_rahim',
      booking: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED' },
      lunchDeadline: '09:00',
      nightDeadline: '17:00',
      isManager: false,
      expectedVersion: futureRec.version ?? 2,
    }),
    /inactive/i
  );

  // Reactivating keeps autoBookEnabled off until member explicitly opts in
  await demoMessService.updateMemberStatus('GV-MESS-2026', 'mem_rahim', true);
  const reactivated = members.find((m) => m.id === 'mem_rahim')!;
  assert.equal(reactivated.isActive, true);
  assert.equal(reactivated.autoBookEnabled, false);

  unsub();
});

