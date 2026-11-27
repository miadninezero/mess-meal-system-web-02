import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ConcurrencyConflictError,
  assertAndNextVersion,
  isConcurrencyConflictError,
  normalizeVersion,
} from './optimisticConcurrency';
import { demoMessService, DEMO_USER_ID } from '../services/demoMessService';
import { defaultBookingEntry, DailyMealRecord, Mess, SharedBill, BazaarExpense } from '../types/mess';
import { getTodayDhakaDate, shiftDate } from './dhakaTime';

const MESS_ID = 'GV-MESS-2026';

test('normalizeVersion handles valid numbers, floats, and legacy missing values', () => {
  assert.equal(normalizeVersion(undefined), 0);
  assert.equal(normalizeVersion(null), 0);
  assert.equal(normalizeVersion(-1), 0);
  assert.equal(normalizeVersion(Number.NaN), 0);
  assert.equal(normalizeVersion(0), 0);
  assert.equal(normalizeVersion(3), 3);
  assert.equal(normalizeVersion(2.9), 2);
});

test('assertAndNextVersion creates v1 when record does not exist and expectedVersion is null', () => {
  const next = assertAndNextVersion({
    exists: false,
    currentVersion: undefined,
    expectedVersion: null,
    recordLabel: 'daily meal record',
  });
  assert.equal(next, 1);
});

test('assertAndNextVersion upgrades legacy docs without version (0 -> 1) and detects subsequent stale writes', () => {
  const upgraded = assertAndNextVersion({
    exists: true,
    currentVersion: undefined,
    expectedVersion: 0,
    recordLabel: 'daily meal record',
  });
  assert.equal(upgraded, 1);

  assert.throws(
    () =>
      assertAndNextVersion({
        exists: true,
        currentVersion: 1,
        expectedVersion: 0,
        recordLabel: 'daily meal record',
      }),
    (err: unknown) => {
      assert.equal(isConcurrencyConflictError(err), true);
      assert.equal((err as ConcurrencyConflictError).expectedVersion, 0);
      assert.equal((err as ConcurrencyConflictError).actualVersion, 1);
      return true;
    }
  );
});

test('assertAndNextVersion rejects when expectedVersion is null for an already-created record', () => {
  assert.throws(
    () =>
      assertAndNextVersion({
        exists: true,
        currentVersion: 1,
        expectedVersion: null,
        recordLabel: 'daily meal record',
      }),
    (err: unknown) => {
      assert.equal(isConcurrencyConflictError(err), true);
      assert.equal((err as ConcurrencyConflictError).expectedVersion, null);
      assert.equal((err as ConcurrencyConflictError).actualVersion, 1);
      return true;
    }
  );
});

test('assertAndNextVersion rejects when record was deleted after load', () => {
  assert.throws(
    () =>
      assertAndNextVersion({
        exists: false,
        currentVersion: undefined,
        expectedVersion: 2,
        recordLabel: 'shared bill',
      }),
    (err: unknown) => {
      assert.equal(isConcurrencyConflictError(err), true);
      assert.equal((err as ConcurrencyConflictError).expectedVersion, 2);
      assert.equal((err as ConcurrencyConflictError).actualVersion, null);
      return true;
    }
  );
});

test('simultaneous daily meal edits reject stale write, preserve newer write, and succeed after reload', async () => {
  demoMessService.resetDemoData();
  const futureDate = shiftDate(getTodayDhakaDate(), 2);

  let latestRecords: DailyMealRecord[] = [];
  const unsub = demoMessService.observeMessBundle(MESS_ID, DEMO_USER_ID, {
    onDailyMeals: (records) => {
      latestRecords = records;
    },
  });

  // User A creates the brand-new future date record (expectedVersion = null -> v1)
  await demoMessService.saveMemberBooking({
    messId: MESS_ID,
    date: futureDate,
    memberId: DEMO_USER_ID,
    booking: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED' },
    lunchDeadline: '09:00',
    nightDeadline: '17:00',
    isManager: false,
    expectedVersion: null,
  });

  const created = latestRecords.find((r) => r.date === futureDate);
  assert.ok(created);
  assert.equal(created.version, 1);

  // Both User A and User B observe version 1
  const versionSeenByBoth = created.version!;

  // User A edits first (v1 -> v2)
  await demoMessService.saveMemberBooking({
    messId: MESS_ID,
    date: futureDate,
    memberId: 'mem_rahim',
    booking: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'CANCELLED', guestLunch: 2 },
    lunchDeadline: '09:00',
    nightDeadline: '17:00',
    isManager: false,
    expectedVersion: versionSeenByBoth,
  });

  const afterUserA = latestRecords.find((r) => r.date === futureDate)!;
  assert.equal(afterUserA.version, 2);
  assert.equal(afterUserA.bookings.mem_rahim.guestLunch, 2);

  // User B attempts stale write with expectedVersion = 1 -> rejected, User A's change preserved
  await assert.rejects(
    demoMessService.saveMemberBooking({
      messId: MESS_ID,
      date: futureDate,
      memberId: 'mem_karim',
      booking: { ...defaultBookingEntry(), statusLunch: 'CANCELLED', statusNight: 'BOOKED' },
      lunchDeadline: '09:00',
      nightDeadline: '17:00',
      isManager: false,
      expectedVersion: versionSeenByBoth,
    }),
    (err: unknown) => {
      assert.equal(isConcurrencyConflictError(err), true);
      assert.equal((err as ConcurrencyConflictError).expectedVersion, 1);
      assert.equal((err as ConcurrencyConflictError).actualVersion, 2);
      return true;
    }
  );

  // Stale write must NOT have polluted the record
  const afterRejectedB = latestRecords.find((r) => r.date === futureDate)!;
  assert.equal(afterRejectedB.version, 2);
  assert.equal(afterRejectedB.bookings.mem_karim, undefined);
  assert.equal(afterRejectedB.bookings.mem_rahim.guestLunch, 2);

  // Reload latest data via refreshMessData, then retry User B with fresh version -> v3
  let refreshedRecords: DailyMealRecord[] = [];
  await demoMessService.refreshMessData(MESS_ID, DEMO_USER_ID, {
    onDailyMeals: (records) => {
      refreshedRecords = records;
    },
  });
  const reloadedRecord = refreshedRecords.find((r) => r.date === futureDate)!;
  assert.equal(reloadedRecord.version, 2);

  await demoMessService.saveMemberBooking({
    messId: MESS_ID,
    date: futureDate,
    memberId: 'mem_karim',
    booking: { ...defaultBookingEntry(), statusLunch: 'CANCELLED', statusNight: 'BOOKED' },
    lunchDeadline: '09:00',
    nightDeadline: '17:00',
    isManager: false,
    expectedVersion: reloadedRecord.version!,
  });

  const afterReloadedB = latestRecords.find((r) => r.date === futureDate)!;
  assert.equal(afterReloadedB.version, 3);
  assert.equal(afterReloadedB.bookings.mem_rahim.guestLunch, 2);
  assert.equal(afterReloadedB.bookings.mem_karim.statusNight, 'BOOKED');

  unsub();
});

test('simultaneous service status update conflicts with concurrent booking edit on same day', async () => {
  demoMessService.resetDemoData();
  const futureDate = shiftDate(getTodayDhakaDate(), 3);

  let latestRecords: DailyMealRecord[] = [];
  const unsub = demoMessService.observeMessBundle(MESS_ID, DEMO_USER_ID, {
    onDailyMeals: (records) => {
      latestRecords = records;
    },
  });

  await demoMessService.updateMealServiceStatus(
    MESS_ID,
    futureDate,
    'ACTIVE',
    'ACTIVE',
    '',
    null
  );
  const initial = latestRecords.find((r) => r.date === futureDate)!;
  assert.equal(initial.version, 1);

  // Manager 1 updates a member booking (v1 -> v2)
  await demoMessService.saveMemberBooking({
    messId: MESS_ID,
    date: futureDate,
    memberId: DEMO_USER_ID,
    booking: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED' },
    lunchDeadline: '09:00',
    nightDeadline: '17:00',
    isManager: true,
    expectedVersion: 1,
  });

  // Manager 2 still holds v1 and tries to cancel lunch -> rejected
  await assert.rejects(
    demoMessService.updateMealServiceStatus(
      MESS_ID,
      futureDate,
      'CANCELLED',
      'ACTIVE',
      'Gas maintenance',
      1
    ),
    (err: unknown) => isConcurrencyConflictError(err)
  );

  const unchanged = latestRecords.find((r) => r.date === futureDate)!;
  assert.equal(unchanged.version, 2);
  assert.equal(unchanged.lunchServiceStatus, 'ACTIVE');

  unsub();
});

test('shared bill edits, payment recording, bazaar expenses, and deadlines enforce version checks', async () => {
  demoMessService.resetDemoData();
  let sharedBills: SharedBill[] = [];
  let bazaarExpenses: BazaarExpense[] = [];
  let currentMess: Mess | null = null;

  const unsub = demoMessService.observeMessBundle(MESS_ID, DEMO_USER_ID, {
    onMess: (m) => {
      currentMess = m;
    },
    onSharedBills: (s) => {
      sharedBills = s;
    },
    onBazaarExpenses: (b) => {
      bazaarExpenses = b;
    },
  });

  // Shared bill edit vs payment conflict
  const bill = sharedBills[0];
  assert.ok(bill);
  const billV1 = normalizeVersion(bill.version);
  assert.equal(billV1, 1);

  await demoMessService.recordBillPayment({
    messId: MESS_ID,
    billId: bill.id,
    memberId: 'mem_rahim',
    memberName: 'Rahim Ahmed',
    assignedShare: bill.memberShares.mem_rahim ?? bill.perMemberAmount,
    amountPaid: 500,
    paymentMethod: 'bKash',
    paymentDate: getTodayDhakaDate(),
    notes: 'Paid online',
    expectedVersion: billV1,
  });

  const billV2 = sharedBills.find((b) => b.id === bill.id)!;
  assert.equal(billV2.version, 2);

  await assert.rejects(
    demoMessService.updateSharedBill(MESS_ID, {
      ...bill,
      notes: 'Stale note overwrite',
      version: billV1,
    }),
    (err: unknown) => isConcurrencyConflictError(err)
  );
  assert.notEqual(sharedBills.find((b) => b.id === bill.id)!.notes, 'Stale note overwrite');

  // Bazaar expense conflict
  const expense = bazaarExpenses[0];
  const expV1 = normalizeVersion(expense.version);
  await demoMessService.updateBazaarExpense(MESS_ID, { ...expense, amount: expense.amount + 100 });
  const expV2 = bazaarExpenses.find((e) => e.id === expense.id)!;
  assert.equal(expV2.version, expV1 + 1);

  await assert.rejects(
    demoMessService.updateBazaarExpense(MESS_ID, { ...expense, amount: 1 }),
    (err: unknown) => isConcurrencyConflictError(err)
  );
  assert.equal(bazaarExpenses.find((e) => e.id === expense.id)!.amount, expense.amount + 100);

  // Mess deadline settings conflict
  assert.ok(currentMess);
  const messV1 = normalizeVersion((currentMess as Mess).version);
  await demoMessService.updateBookingDeadlines(MESS_ID, '09:30', '17:30', messV1);
  assert.equal(normalizeVersion((currentMess as Mess).version), messV1 + 1);

  await assert.rejects(
    demoMessService.updateBookingDeadlines(MESS_ID, '08:00', '16:00', messV1),
    (err: unknown) => isConcurrencyConflictError(err)
  );
  assert.equal((currentMess as Mess).lunchBookingDeadline, '09:30');

  unsub();
});
