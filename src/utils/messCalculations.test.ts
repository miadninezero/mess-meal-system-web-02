import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAttendanceUnits,
  calculateBookingUnits,
  calculateSummary,
  computeKitchenOrderSummary,
  computeMonthlyBazaarVsDeposits,
  resolveEffectiveBooking,
  roundTwoDecimals,
} from './messCalculations';
import {
  format12Hour,
  formatReadableDate,
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
} from '../types/mess';

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
