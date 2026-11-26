import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BillAllocationType,
  BillPaymentStatus,
  DailyMealRecord,
  Member,
  defaultBookingEntry,
} from '../types/mess';
import {
  buildMonthlyExportReport,
  formatMonthlyReportCsv,
  formatPdfCurrency,
  getExportFilename,
  sanitizeCsvCell,
} from './monthlyExport';

function makeMember(id: string, name: string, room: string): Member {
  return {
    id,
    userId: id,
    displayName: name,
    room,
    role: 'MEMBER',
    isActive: true,
    autoBookEnabled: false,
    autoBookLunch: true,
    autoBookNight: true,
    autoBookUpdatedAt: '',
  };
}

test('Monthly export scopes meals, bazaar expenses, deposits, and bills strictly to activeMonth', () => {
  const members = [makeMember('m1', 'Tanvir', '302'), makeMember('m2', 'Rahim', '301')];
  const dailyMeals: DailyMealRecord[] = [
    {
      id: '2026-10-20',
      date: '2026-10-20',
      isFriday: false,
      lunchServiceStatus: 'ACTIVE',
      nightServiceStatus: 'ACTIVE',
      cancellationReason: '',
      bookings: {
        m1: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED' },
      },
      attendances: {},
      totalDayUnits: 2,
      totalDayMeals: 2,
      updatedBy: 'm1',
    },
    {
      id: '2026-11-18',
      date: '2026-11-18',
      isFriday: false,
      lunchServiceStatus: 'ACTIVE',
      nightServiceStatus: 'ACTIVE',
      cancellationReason: '',
      bookings: {
        m1: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED' },
        m2: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'CANCELLED', guestLunch: 1 },
      },
      attendances: {},
      totalDayUnits: 5,
      totalDayMeals: 5,
      updatedBy: 'm1',
    },
  ];

  const report = buildMonthlyExportReport({
    messName: 'Green View Mess',
    messId: 'GV-2026',
    activeMonth: '2026-11',
    todayDhakaDate: '2026-11-26',
    members,
    dailyMeals,
    bazaarExpenses: [
      {
        id: 'b_old',
        buyerMemberId: 'm1',
        buyerName: 'Tanvir',
        amount: 9999,
        itemsDescription: 'October rice',
        category: 'Groceries',
        date: '2026-10-15',
      },
      {
        id: 'b_nov_1',
        buyerMemberId: 'm1',
        buyerName: 'Tanvir',
        amount: 500,
        itemsDescription: 'Rohu fish, potatoes',
        category: 'Meat & Fish',
        date: '2026-11-18',
      },
    ],
    deposits: [
      {
        id: 'd_old',
        memberId: 'm1',
        memberName: 'Tanvir',
        amount: 8000,
        date: '2026-10-02',
        paymentMethod: 'Cash',
        notes: 'Oct deposit',
        recordedBy: 'm1',
      },
      {
        id: 'd_nov',
        memberId: 'm1',
        memberName: 'Tanvir',
        amount: 1000,
        date: '2026-11-05',
        paymentMethod: 'Cash',
        notes: 'Nov deposit',
        recordedBy: 'm1',
      },
    ],
    utilityBills: [
      { id: 'u_old', title: 'Oct Cook', amount: 3000, month: '2026-10' },
      { id: 'u_nov', title: 'Nov Cook', amount: 400, month: '2026-11' },
    ],
    sharedBills: [
      {
        id: 'sb_nov',
        title: 'Fiber Wi-Fi',
        allocationType: BillAllocationType.DIVIDED_EQUALLY,
        totalAmount: 600,
        perMemberAmount: 300,
        month: '2026-11',
        deadline: '2026-11-28',
        notes: '',
        assignedMemberIds: ['m1', 'm2'],
        memberShares: { m1: 300, m2: 300 },
        memberNames: { m1: 'Tanvir', m2: 'Rahim' },
        payments: {
          m1: {
            memberId: 'm1',
            memberName: 'Tanvir',
            amountPaid: 300,
            status: BillPaymentStatus.PAID,
            paymentDate: '2026-11-20',
            paymentMethod: 'Cash',
            notes: '',
            recordedByUid: 'm1',
            recordedByName: 'Tanvir',
          },
        },
        createdByUid: 'm1',
        createdByName: 'Tanvir',
      },
    ],
    now: new Date('2026-11-26T00:00:00Z'),
  });

  // November units: m1 = 2, m2 = 1.5 + 1.5 = 3 -> total 5 units; bazaar = 500 -> rate = 100
  assert.equal(report.totals.totalUnits, 5);
  assert.equal(report.summary.mealRate, 100);
  assert.equal(report.totals.totalBazaar, 500);
  assert.equal(report.totals.totalUtilities, 400);
  assert.equal(report.totals.totalSharedBills, 600);
  assert.equal(report.totals.totalDeposits, 1000);
  assert.equal(report.totals.grandTotalExpenses, 1500);
  assert.equal(report.bazaarExpenses.length, 1);
  assert.equal(report.utilityBills.length, 1);
  assert.equal(report.sharedBills.length, 1);

  const tanvir = report.memberRows.find((r) => r.memberId === 'm1')!;
  // Tanvir: 2*100 = 200 meal + 200 util + 0 unpaid shared bill = 400 cost; 1000 deposit -> +600
  assert.equal(tanvir.netBalance, 600);
  assert.equal(tanvir.status, 'REFUNDABLE');
});

test('CSV formatting escapes quotes/commas, mitigates formula injection, and includes all sections', () => {
  assert.equal(sanitizeCsvCell('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.equal(sanitizeCsvCell('Rice, "Miniket"'), '"Rice, ""Miniket"""');
  assert.equal(sanitizeCsvCell(-125.5), '-125.5');

  const report = buildMonthlyExportReport({
    messName: 'Green View',
    messId: 'GV-2026',
    activeMonth: '2026-11',
    todayDhakaDate: '2026-11-26',
    members: [makeMember('m1', 'Tanvir', '302')],
    dailyMeals: [],
    bazaarExpenses: [
      {
        id: 'b1',
        buyerMemberId: 'm1',
        buyerName: 'Tanvir',
        amount: 320,
        itemsDescription: 'Rice, Oil & Spices',
        category: 'Groceries',
        date: '2026-11-22',
      },
    ],
    deposits: [],
    utilityBills: [{ id: 'u1', title: 'Gas', amount: 450, month: '2026-11' }],
    sharedBills: [],
  });

  const csv = formatMonthlyReportCsv(report);
  assert.ok(csv.includes('MONTHLY OVERVIEW'));
  assert.ok(csv.includes('MEMBER MEAL & BALANCE SUMMARY'));
  assert.ok(csv.includes('MONTHLY BAZAAR EXPENSES'));
  assert.ok(csv.includes('FIXED UTILITIES & SHARED BILLS'));
  assert.ok(csv.includes('"Rice, Oil & Spices"'));
  assert.ok(csv.includes('Gas'));
});

test('PDF currency and export filenames format cleanly', () => {
  assert.equal(formatPdfCurrency(1450.5), 'Tk 1,450.50');
  assert.equal(formatPdfCurrency(-297.8), '-Tk 297.80');
  assert.equal(getExportFilename('2026-11', 'csv'), 'mess-meal-summary-2026-11.csv');
  assert.equal(getExportFilename('2026-11', 'pdf'), 'mess-meal-summary-2026-11.pdf');
});
