import {
  AuditLog,
  BazaarExpense,
  BillAllocationType,
  BillPaymentStatus,
  DailyMealRecord,
  Deposit,
  InAppNotification,
  MealBookingEntry,
  Member,
  Mess,
  SharedBill,
  UserProfile,
  UtilityBill,
  defaultBookingEntry,
} from '../types/mess';
import {
  getCurrentDhakaMonth,
  getTodayDhakaDate,
  isDeadlinePassed,
  isFriday as checkIsFriday,
  shiftDate,
} from '../utils/dhakaTime';
import { roundTwoDecimals } from '../utils/messCalculations';
import { assertAndNextVersion, normalizeVersion } from '../utils/optimisticConcurrency';
import { IMessDataService, MessObservers } from './messServiceTypes';

const DEMO_STORAGE_KEY = 'mess_meal_demo_state_v2';
export const DEMO_USER_ID = 'demo_tanvir_uid';

interface DemoMessBundle {
  mess: Mess;
  members: Member[];
  dailyMeals: DailyMealRecord[];
  bazaarExpenses: BazaarExpense[];
  deposits: Deposit[];
  utilityBills: UtilityBill[];
  sharedBills: SharedBill[];
  notifications: InAppNotification[];
  auditLogs: AuditLog[];
}

interface DemoState {
  profile: UserProfile;
  messes: Record<string, DemoMessBundle>;
}

function createInitialDemoState(): DemoState {
  const today = getTodayDhakaDate();
  const currentMonth = getCurrentDhakaMonth();
  const messId = 'GV-MESS-2026';

  const yesterday = shiftDate(today, -1);
  const twoDaysAgo = shiftDate(today, -2);
  const threeDaysAgo = shiftDate(today, -3);
  const fourDaysAgo = shiftDate(today, -4);
  const tomorrow = shiftDate(today, 1);

  const members: Member[] = [
    {
      id: DEMO_USER_ID,
      userId: DEMO_USER_ID,
      displayName: 'Tanvir Hasan',
      room: 'Room 302',
      role: 'MANAGER',
      isActive: true,
      autoBookEnabled: true,
      autoBookLunch: true,
      autoBookNight: true,
      autoBookUpdatedAt: threeDaysAgo,
      createdAt: Date.now() - 86400000 * 15,
    },
    {
      id: 'mem_rahim',
      userId: 'uid_rahim',
      displayName: 'Rahim Ahmed',
      room: 'Room 301',
      role: 'MEMBER',
      isActive: true,
      autoBookEnabled: true,
      autoBookLunch: true,
      autoBookNight: true,
      autoBookUpdatedAt: threeDaysAgo,
      createdAt: Date.now() - 86400000 * 14,
    },
    {
      id: 'mem_karim',
      userId: 'uid_karim',
      displayName: 'Karim Uddin',
      room: 'Room 304',
      role: 'MEMBER',
      isActive: true,
      autoBookEnabled: false,
      autoBookLunch: true,
      autoBookNight: true,
      autoBookUpdatedAt: '',
      createdAt: Date.now() - 86400000 * 14,
    },
    {
      id: 'mem_jamal',
      userId: 'uid_jamal',
      displayName: 'Jamal Chowdhury',
      room: 'Room 205',
      role: 'MEMBER',
      isActive: true,
      autoBookEnabled: false,
      autoBookLunch: true,
      autoBookNight: false,
      autoBookUpdatedAt: '',
      createdAt: Date.now() - 86400000 * 12,
    },
    {
      id: 'mem_nafis',
      userId: 'uid_nafis',
      displayName: 'Nafis Rahman',
      room: 'Room 201',
      role: 'MEMBER',
      isActive: true,
      autoBookEnabled: true,
      autoBookLunch: false,
      autoBookNight: true,
      autoBookUpdatedAt: threeDaysAgo,
      createdAt: Date.now() - 86400000 * 10,
    },
  ];

  const mkRecord = (
    date: string,
    bookings: Record<string, MealBookingEntry>
  ): DailyMealRecord => {
    const isFri = checkIsFriday(date);
    return {
      id: date,
      date,
      isFriday: isFri,
      lunchServiceStatus: 'ACTIVE',
      nightServiceStatus: isFri ? 'CANCELLED' : 'ACTIVE',
      cancellationReason: '',
      bookings,
      attendances: {},
      totalDayUnits: 0,
      totalDayMeals: 0,
      version: 1,
      updatedBy: DEMO_USER_ID,
      updatedAt: Date.now() - 3600000,
    };
  };

  const [refYear, refMonth] = currentMonth.split('-').map(Number);
  const shiftMonthKey = (offsetMonths: number): string => {
    const abs = refYear * 12 + (refMonth - 1) + offsetMonths;
    const y = Math.floor(abs / 12);
    const m = ((abs % 12) + 12) % 12 + 1;
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
  };

  const historicalMeals: DailyMealRecord[] = [];
  const sampleDays = ['04', '07', '10', '13', '16', '19', '22', '25', '27'];
  for (let mOff = -5; mOff <= -1; mOff += 1) {
    const mk = shiftMonthKey(mOff);
    for (const day of sampleDays) {
      const dateStr = `${mk}-${day}`;
      const isFri = checkIsFriday(dateStr);
      const dayUnitsPerMember = isFri ? 1 : 2;
      const attendances: DailyMealRecord['attendances'] = {};
      for (const m of members) {
        attendances[m.id] = {
          attendedLunch: true,
          attendedNight: !isFri,
          guestLunchAttended: 0,
          guestNightAttended: 0,
          calculatedUnits: dayUnitsPerMember,
        };
      }
      historicalMeals.push({
        id: dateStr,
        date: dateStr,
        isFriday: isFri,
        lunchServiceStatus: 'ACTIVE',
        nightServiceStatus: isFri ? 'CANCELLED' : 'ACTIVE',
        cancellationReason: '',
        bookings: {},
        attendances,
        totalDayUnits: dayUnitsPerMember * members.length,
        totalDayMeals: dayUnitsPerMember * members.length,
        version: 1,
        updatedBy: DEMO_USER_ID,
        updatedAt: Date.now() - Math.abs(mOff) * 30 * 86400000,
      });
    }
  }

  const dailyMeals: DailyMealRecord[] = [
    ...historicalMeals,
    mkRecord(fourDaysAgo, {
      [DEMO_USER_ID]: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED' },
      mem_rahim: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED', guestLunch: 1 },
      mem_karim: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'CANCELLED' },
      mem_jamal: { ...defaultBookingEntry(), statusLunch: 'CANCELLED', statusNight: 'BOOKED' },
      mem_nafis: { ...defaultBookingEntry(), statusLunch: 'CANCELLED', statusNight: 'BOOKED' },
    }),
    mkRecord(threeDaysAgo, {
      [DEMO_USER_ID]: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED', autoBooked: true },
      mem_rahim: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED', autoBooked: true },
      mem_karim: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED' },
      mem_jamal: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'CANCELLED' },
      mem_nafis: { ...defaultBookingEntry(), statusLunch: 'CANCELLED', statusNight: 'BOOKED', autoBooked: true },
    }),
    mkRecord(twoDaysAgo, {
      [DEMO_USER_ID]: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED', guestNight: 1 },
      mem_rahim: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'CANCELLED' },
      mem_karim: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED' },
      mem_jamal: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED' },
      mem_nafis: { ...defaultBookingEntry(), statusLunch: 'CANCELLED', statusNight: 'BOOKED' },
    }),
    mkRecord(yesterday, {
      [DEMO_USER_ID]: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED' },
      mem_rahim: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED' },
      mem_karim: { ...defaultBookingEntry(), statusLunch: 'CANCELLED', statusNight: 'BOOKED' },
      mem_jamal: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'CANCELLED', guestLunch: 1 },
      mem_nafis: { ...defaultBookingEntry(), statusLunch: 'CANCELLED', statusNight: 'BOOKED' },
    }),
    mkRecord(today, {
      [DEMO_USER_ID]: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED', autoBooked: true },
      mem_rahim: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'BOOKED', autoBooked: true },
      mem_karim: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'NO_RESPONSE', guestLunch: 1 },
      mem_jamal: { ...defaultBookingEntry(), statusLunch: 'BOOKED', statusNight: 'CANCELLED' },
      mem_nafis: { ...defaultBookingEntry(), statusLunch: 'CANCELLED', statusNight: 'BOOKED', autoBooked: true },
    }),
  ];

  const historicalBazaarSpecs = [
    { mOff: -5, a1: 4200, a2: 3000, d1: 'Monthly rice, oil & dry staples', d2: 'Fish, chicken & fresh vegetables' },
    { mOff: -4, a1: 4900, a2: 3500, d1: 'Wholesale grains, lentils & spices', d2: 'Beef, hilsa & weekly bazaar' },
    { mOff: -3, a1: 4450, a2: 3500, d1: 'Miniket rice & cooking essentials', d2: 'Poultry, eggs & market produce' },
    { mOff: -2, a1: 5300, a2: 3900, d1: 'Bulk groceries & pantry restock', d2: 'Rohu fish, mutton & vegetables' },
    { mOff: -1, a1: 5050, a2: 3800, d1: 'Rice, dal, edible oil & onion sack', d2: 'Meat, fish & leafy greens' },
  ];

  const historicalBazaars: BazaarExpense[] = historicalBazaarSpecs.flatMap((spec) => {
    const mk = shiftMonthKey(spec.mOff);
    const tsBase = Date.now() - Math.abs(spec.mOff) * 30 * 86400000;
    return [
      {
        id: `baz_hist_${mk}_1`,
        buyerMemberId: DEMO_USER_ID,
        buyerName: 'Tanvir Hasan',
        amount: spec.a1,
        itemsDescription: spec.d1,
        category: 'Groceries',
        date: `${mk}-08`,
        version: 1,
        createdAt: tsBase,
      },
      {
        id: `baz_hist_${mk}_2`,
        buyerMemberId: 'mem_rahim',
        buyerName: 'Rahim Ahmed',
        amount: spec.a2,
        itemsDescription: spec.d2,
        category: 'Meat & Fish',
        date: `${mk}-20`,
        version: 1,
        createdAt: tsBase + 86400000 * 12,
      },
    ];
  });

  const bazaarExpenses: BazaarExpense[] = [
    {
      id: 'baz_1',
      buyerMemberId: 'mem_rahim',
      buyerName: 'Rahim Ahmed',
      amount: 1450,
      itemsDescription: 'Rohu fish 2.5kg, potatoes, onions, green chili, cooking oil',
      category: 'Meat & Fish',
      date: yesterday,
      version: 1,
      createdAt: Date.now() - 86400000,
    },
    {
      id: 'baz_2',
      buyerMemberId: DEMO_USER_ID,
      buyerName: 'Tanvir Hasan',
      amount: 1280,
      itemsDescription: 'Miniket rice 10kg, masoor dal 2kg, salt, turmeric',
      category: 'Groceries',
      date: twoDaysAgo,
      version: 1,
      createdAt: Date.now() - 86400000 * 2,
    },
    {
      id: 'baz_3',
      buyerMemberId: 'mem_karim',
      buyerName: 'Karim Uddin',
      amount: 820,
      itemsDescription: 'Broiler chicken 2kg, eggplant, cauliflower, tomatoes',
      category: 'Vegetables',
      date: threeDaysAgo,
      version: 1,
      createdAt: Date.now() - 86400000 * 3,
    },
    {
      id: 'baz_4',
      buyerMemberId: 'mem_jamal',
      buyerName: 'Jamal Chowdhury',
      amount: 460,
      itemsDescription: 'Ginger, garlic, cumin, coriander, mustard oil',
      category: 'Spices',
      date: fourDaysAgo,
      version: 1,
      createdAt: Date.now() - 86400000 * 4,
    },
    ...historicalBazaars,
  ];

  const historicalDepositPerMember: Record<number, number> = {
    [-5]: 1500,
    [-4]: 1750,
    [-3]: 1650,
    [-2]: 1950,
    [-1]: 1850,
  };

  const historicalDeposits: Deposit[] = [-1, -2, -3, -4, -5].flatMap((mOff) => {
    const mk = shiftMonthKey(mOff);
    const perHead = historicalDepositPerMember[mOff];
    const tsBase = Date.now() - Math.abs(mOff) * 30 * 86400000;
    return members.map((m, idx) => ({
      id: `dep_hist_${mk}_${m.id}`,
      memberId: m.id,
      memberName: m.displayName,
      amount: perHead,
      date: `${mk}-0${idx + 2}`,
      paymentMethod: idx % 2 === 0 ? 'bKash/Nagad' : 'Cash',
      notes: `Monthly mess deposit (${mk})`,
      recordedBy: DEMO_USER_ID,
      version: 1,
      createdAt: tsBase + idx * 3600000,
    }));
  });

  const deposits: Deposit[] = [
    {
      id: 'dep_1',
      memberId: DEMO_USER_ID,
      memberName: 'Tanvir Hasan',
      amount: 3500,
      date: fourDaysAgo,
      paymentMethod: 'bKash/Nagad',
      notes: 'Monthly advance deposit',
      recordedBy: DEMO_USER_ID,
      version: 1,
      createdAt: Date.now() - 86400000 * 4,
    },
    {
      id: 'dep_2',
      memberId: 'mem_rahim',
      memberName: 'Rahim Ahmed',
      amount: 3000,
      date: fourDaysAgo,
      paymentMethod: 'Cash',
      notes: 'First installment',
      recordedBy: DEMO_USER_ID,
      version: 1,
      createdAt: Date.now() - 86400000 * 4,
    },
    {
      id: 'dep_3',
      memberId: 'mem_karim',
      memberName: 'Karim Uddin',
      amount: 2500,
      date: threeDaysAgo,
      paymentMethod: 'bKash/Nagad',
      notes: 'Advance deposit',
      recordedBy: DEMO_USER_ID,
      version: 1,
      createdAt: Date.now() - 86400000 * 3,
    },
    {
      id: 'dep_4',
      memberId: 'mem_jamal',
      memberName: 'Jamal Chowdhury',
      amount: 2000,
      date: twoDaysAgo,
      paymentMethod: 'Bank',
      notes: 'Bank transfer ref #4821',
      recordedBy: DEMO_USER_ID,
      version: 1,
      createdAt: Date.now() - 86400000 * 2,
    },
    {
      id: 'dep_5',
      memberId: 'mem_nafis',
      memberName: 'Nafis Rahman',
      amount: 2200,
      date: yesterday,
      paymentMethod: 'Cash',
      notes: 'Advance cash',
      recordedBy: DEMO_USER_ID,
      version: 1,
      createdAt: Date.now() - 86400000,
    },
    ...historicalDeposits,
  ];

  const utilityBills: UtilityBill[] = [
    {
      id: 'util_1',
      title: 'Cook (Khala) Monthly Salary',
      amount: 3500,
      month: currentMonth,
      version: 1,
      createdAt: Date.now() - 86400000 * 5,
    },
    {
      id: 'util_2',
      title: 'LPG Gas & Stove Maintenance',
      amount: 1450,
      month: currentMonth,
      version: 1,
      createdAt: Date.now() - 86400000 * 4,
    },
  ];

  const sharedBills: SharedBill[] = [
    {
      id: 'sb_wifi',
      title: 'Fiber Broadband Wi-Fi',
      allocationType: BillAllocationType.DIVIDED_EQUALLY,
      totalAmount: 1500,
      perMemberAmount: 300,
      month: currentMonth,
      deadline: tomorrow,
      notes: '100 Mbps shared router plan for Floor 2 & 3',
      assignedMemberIds: members.map((m) => m.id),
      memberShares: {
        [DEMO_USER_ID]: 300,
        mem_rahim: 300,
        mem_karim: 300,
        mem_jamal: 300,
        mem_nafis: 300,
      },
      memberNames: {
        [DEMO_USER_ID]: 'Tanvir Hasan',
        mem_rahim: 'Rahim Ahmed',
        mem_karim: 'Karim Uddin',
        mem_jamal: 'Jamal Chowdhury',
        mem_nafis: 'Nafis Rahman',
      },
      payments: {
        [DEMO_USER_ID]: {
          memberId: DEMO_USER_ID,
          memberName: 'Tanvir Hasan',
          amountPaid: 300,
          status: BillPaymentStatus.PAID,
          paymentDate: yesterday,
          paymentMethod: 'bKash/Nagad',
          notes: 'Paid in full',
          recordedByUid: DEMO_USER_ID,
          recordedByName: 'Tanvir Hasan',
        },
        mem_rahim: {
          memberId: 'mem_rahim',
          memberName: 'Rahim Ahmed',
          amountPaid: 300,
          status: BillPaymentStatus.PAID,
          paymentDate: yesterday,
          paymentMethod: 'Cash',
          notes: '',
          recordedByUid: DEMO_USER_ID,
          recordedByName: 'Tanvir Hasan',
        },
        mem_karim: {
          memberId: 'mem_karim',
          memberName: 'Karim Uddin',
          amountPaid: 150,
          status: BillPaymentStatus.PARTIALLY_PAID,
          paymentDate: today,
          paymentMethod: 'Cash',
          notes: 'Will pay remaining tomorrow',
          recordedByUid: DEMO_USER_ID,
          recordedByName: 'Tanvir Hasan',
        },
      },
      createdByUid: DEMO_USER_ID,
      createdByName: 'Tanvir Hasan',
      version: 1,
      createdAt: Date.now() - 86400000 * 3,
      updatedAt: Date.now() - 3600000,
    },
  ];

  const notifications: InAppNotification[] = [
    {
      id: 'notif_1',
      messId,
      targetMemberId: DEMO_USER_ID,
      targetMemberName: 'Tanvir Hasan',
      title: 'New Bill: Fiber Broadband Wi-Fi',
      message: `Your share is ৳300. Deadline: ${tomorrow}.`,
      billId: 'sb_wifi',
      amount: 300,
      deadline: tomorrow,
      isRead: false,
      createdAt: Date.now() - 86400000 * 2,
    },
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'log_1',
      action: 'SHARED_BILL_PUBLISHED',
      performedByUid: DEMO_USER_ID,
      performedByName: 'Tanvir Hasan',
      targetMemberId: '',
      targetMemberName: '',
      details: `Published 'Fiber Broadband Wi-Fi': ৳1500 total (DIVIDED_EQUALLY) for 5 members.`,
      reason: '',
      timestampMs: Date.now() - 86400000 * 2,
    },
    {
      id: 'log_2',
      action: 'DEPOSIT_ADDED',
      performedByUid: DEMO_USER_ID,
      performedByName: 'Tanvir Hasan',
      targetMemberId: 'mem_nafis',
      targetMemberName: 'Nafis Rahman',
      details: `Added deposit of ৳2200 via Cash on ${yesterday}`,
      reason: '',
      timestampMs: Date.now() - 86400000,
    },
  ];

  return {
    profile: {
      id: DEMO_USER_ID,
      displayName: 'Tanvir Hasan',
      email: 'tanvir.demo@messmeal.app',
      currentMessId: messId,
      createdAt: Date.now() - 86400000 * 15,
      updatedAt: Date.now(),
    },
    messes: {
      [messId]: {
        mess: {
          id: messId,
          name: 'Green View Bachelor Mess',
          managerUid: DEMO_USER_ID,
          adminUids: [DEMO_USER_ID],
          memberUids: members.map((m) => m.userId),
          activeMonth: currentMonth,
          lunchBookingDeadline: '09:00',
          nightBookingDeadline: '17:00',
          version: 1,
          createdAt: Date.now() - 86400000 * 15,
          updatedAt: Date.now(),
        },
        members,
        dailyMeals,
        bazaarExpenses,
        deposits,
        utilityBills,
        sharedBills,
        notifications,
        auditLogs,
      },
    },
  };
}

class DemoMessServiceImpl implements IMessDataService {
  private state: DemoState;
  private listeners = new Set<() => void>();

  constructor() {
    this.state = this.loadState();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (ev) => {
        if (ev.key === DEMO_STORAGE_KEY && ev.newValue) {
          this.syncFromStorageIfPresent();
          this.listeners.forEach((cb) => cb());
        }
      });
    }
  }

  private normalizeBundleVersions(bundle: DemoMessBundle): DemoMessBundle {
    return {
      ...bundle,
      mess: { ...bundle.mess, version: normalizeVersion(bundle.mess.version) },
      dailyMeals: bundle.dailyMeals.map((r) => ({ ...r, version: normalizeVersion(r.version) })),
      bazaarExpenses: bundle.bazaarExpenses.map((e) => ({
        ...e,
        version: normalizeVersion(e.version),
      })),
      deposits: bundle.deposits.map((d) => ({ ...d, version: normalizeVersion(d.version) })),
      utilityBills: bundle.utilityBills.map((u) => ({ ...u, version: normalizeVersion(u.version) })),
      sharedBills: bundle.sharedBills.map((s) => ({ ...s, version: normalizeVersion(s.version) })),
    };
  }

  private normalizeDemoState(parsed: DemoState): DemoState {
    const normalizedMesses: Record<string, DemoMessBundle> = {};
    for (const [id, b] of Object.entries(parsed.messes)) {
      normalizedMesses[id] = this.normalizeBundleVersions(b);
    }
    return {
      ...parsed,
      messes: normalizedMesses,
    };
  }

  private syncFromStorageIfPresent() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as DemoState;
          if (parsed && parsed.messes && parsed.profile) {
            this.state = this.normalizeDemoState(parsed);
          }
        }
      } catch {
        // ignore storage errors
      }
    }
  }

  private loadState(): DemoState {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as DemoState;
          if (parsed && parsed.messes && parsed.profile) {
            return this.normalizeDemoState(parsed);
          }
        }
      } catch {
        // ignore storage errors
      }
    }
    const fresh = createInitialDemoState();
    this.persist(fresh);
    return fresh;
  }

  private persist(next: DemoState = this.state) {
    this.state = next;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
    }
    this.listeners.forEach((cb) => cb());
  }

  resetDemoData() {
    const fresh = createInitialDemoState();
    this.persist(fresh);
  }

  private getBundle(messId: string): DemoMessBundle {
    this.syncFromStorageIfPresent();
    const b = this.state.messes[messId];
    if (!b) throw new Error('Mess not found in demo workspace.');
    return b;
  }

  private addAudit(
    bundle: DemoMessBundle,
    entry: Omit<AuditLog, 'id' | 'timestampMs'>
  ) {
    bundle.auditLogs = [
      {
        ...entry,
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestampMs: Date.now(),
      },
      ...bundle.auditLogs,
    ].slice(0, 50);
  }

  observeUserProfile(userId: string, onData: (profile: UserProfile | null) => void) {
    const emit = () => onData(this.state.profile.id === userId ? { ...this.state.profile } : null);
    emit();
    this.listeners.add(emit);
    return () => {
      this.listeners.delete(emit);
    };
  }

  observeUserMesses(userId: string, onData: (messes: Mess[]) => void) {
    const emit = () => {
      const list = Object.values(this.state.messes)
        .map((b) => b.mess)
        .filter((m) => m.memberUids.includes(userId));
      onData(list);
    };
    emit();
    this.listeners.add(emit);
    return () => {
      this.listeners.delete(emit);
    };
  }

  private emitBundle(messId: string, currentUserId: string, observers: MessObservers) {
    const bundle = this.state.messes[messId];
    if (!bundle) {
      observers.onMess?.(null);
      return;
    }
    observers.onMess?.({ ...bundle.mess, version: normalizeVersion(bundle.mess.version) });
    observers.onMembers?.([...bundle.members]);
    observers.onDailyMeals?.(
      bundle.dailyMeals.map((r) => ({ ...r, version: normalizeVersion(r.version) }))
    );
    observers.onBazaarExpenses?.(
      [...bundle.bazaarExpenses]
        .map((e) => ({ ...e, version: normalizeVersion(e.version) }))
        .sort((a, b) => b.date.localeCompare(a.date))
    );
    observers.onDeposits?.(
      [...bundle.deposits]
        .map((d) => ({ ...d, version: normalizeVersion(d.version) }))
        .sort((a, b) => b.date.localeCompare(a.date))
    );
    observers.onUtilityBills?.(
      bundle.utilityBills.map((u) => ({ ...u, version: normalizeVersion(u.version) }))
    );
    observers.onSharedBills?.(
      [...bundle.sharedBills]
        .map((s) => ({ ...s, version: normalizeVersion(s.version) }))
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    );
    const currentMember = bundle.members.find((m) => m.userId === currentUserId);
    const memId = currentMember?.id || currentUserId;
    observers.onNotifications?.(
      bundle.notifications.filter(
        (n) =>
          n.targetMemberId === memId ||
          n.targetMemberId === currentUserId ||
          n.targetMemberId === 'ALL' ||
          !n.targetMemberId
      )
    );
    observers.onAuditLogs?.([...bundle.auditLogs]);
  }

  observeMessBundle(messId: string, currentUserId: string, observers: MessObservers) {
    const emit = () => this.emitBundle(messId, currentUserId, observers);
    emit();
    this.listeners.add(emit);
    return () => {
      this.listeners.delete(emit);
    };
  }

  async refreshMessData(messId: string, currentUserId: string, observers: MessObservers) {
    this.syncFromStorageIfPresent();
    this.emitBundle(messId, currentUserId, observers);
  }

  async saveUserProfile(profile: Partial<UserProfile> & { id: string }) {
    this.state.profile = { ...this.state.profile, ...profile, updatedAt: Date.now() };
    this.persist();
  }

  async createMess(name: string, managerName: string, defaultMonth: string) {
    const messId = `MESS-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const uid = this.state.profile.id;
    this.state.messes[messId] = {
      mess: {
        id: messId,
        name: name.trim(),
        managerUid: uid,
        adminUids: [uid],
        memberUids: [uid],
        activeMonth: defaultMonth,
        lunchBookingDeadline: '09:00',
        nightBookingDeadline: '17:00',
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      members: [
        {
          id: uid,
          userId: uid,
          displayName: managerName.trim(),
          room: 'Manager',
          role: 'MANAGER',
          isActive: true,
          autoBookEnabled: false,
          autoBookLunch: true,
          autoBookNight: true,
          autoBookUpdatedAt: '',
          createdAt: Date.now(),
        },
      ],
      dailyMeals: [],
      bazaarExpenses: [],
      deposits: [],
      utilityBills: [],
      sharedBills: [],
      notifications: [],
      auditLogs: [],
    };
    this.state.profile.currentMessId = messId;
    this.persist();
    return messId;
  }

  async joinMess(messId: string, memberName: string, room: string) {
    const bundle = this.getBundle(messId.trim());
    const uid = this.state.profile.id;
    if (!bundle.mess.memberUids.includes(uid)) {
      bundle.mess.memberUids.push(uid);
      bundle.members.push({
        id: uid,
        userId: uid,
        displayName: memberName.trim(),
        room: room.trim(),
        role: 'MEMBER',
        isActive: true,
        autoBookEnabled: false,
        autoBookLunch: true,
        autoBookNight: true,
        autoBookUpdatedAt: '',
        createdAt: Date.now(),
      });
    }
    this.state.profile.currentMessId = messId.trim();
    this.persist();
  }

  async updateBookingDeadlines(
    messId: string,
    lunchDeadline: string,
    nightDeadline: string,
    expectedVersion?: number | null
  ) {
    const bundle = this.getBundle(messId);
    const targetExpected =
      expectedVersion !== undefined ? expectedVersion : normalizeVersion(bundle.mess.version);
    const nextVersion = assertAndNextVersion({
      exists: true,
      currentVersion: bundle.mess.version,
      expectedVersion: targetExpected,
      recordLabel: 'mess deadline settings',
    });
    bundle.mess.lunchBookingDeadline = lunchDeadline;
    bundle.mess.nightBookingDeadline = nightDeadline;
    bundle.mess.version = nextVersion;
    bundle.mess.updatedAt = Date.now();
    this.addAudit(bundle, {
      action: 'DEADLINE_CONFIGURED',
      performedByUid: DEMO_USER_ID,
      performedByName: this.state.profile.displayName,
      targetMemberId: '',
      targetMemberName: '',
      details: `Lunch cutoff: ${lunchDeadline}, Night cutoff: ${nightDeadline} (Asia/Dhaka)`,
      reason: '',
    });
    this.persist();
  }

  async promoteMemberToManager(messId: string, targetMember: Member) {
    const bundle = this.getBundle(messId);
    bundle.members = bundle.members.map((m) =>
      m.id === targetMember.id ? { ...m, role: 'MANAGER' } : m
    );
    const targetUid = targetMember.userId || targetMember.id;
    if (!bundle.mess.adminUids.includes(targetUid)) {
      bundle.mess.adminUids = [...bundle.mess.adminUids, targetUid];
    }
    this.addAudit(bundle, {
      action: 'MEMBER_PROMOTED_TO_MANAGER',
      performedByUid: DEMO_USER_ID,
      performedByName: this.state.profile.displayName,
      targetMemberId: targetMember.id,
      targetMemberName: targetMember.displayName,
      details: `Assigned Manager role to ${targetMember.displayName}`,
      reason: '',
    });
    this.persist();
  }

  async demoteManagerToMember(messId: string, targetMember: Member) {
    const bundle = this.getBundle(messId);
    bundle.members = bundle.members.map((m) =>
      m.id === targetMember.id ? { ...m, role: 'MEMBER' } : m
    );
    const targetUid = targetMember.userId || targetMember.id;
    bundle.mess.adminUids = bundle.mess.adminUids.filter((u) => u !== targetUid);
    this.addAudit(bundle, {
      action: 'MANAGER_DEMOTED_TO_MEMBER',
      performedByUid: DEMO_USER_ID,
      performedByName: this.state.profile.displayName,
      targetMemberId: targetMember.id,
      targetMemberName: targetMember.displayName,
      details: `Changed ${targetMember.displayName}'s role to Member`,
      reason: '',
    });
    this.persist();
  }

  async resignAsManager(messId: string, currentMemberId: string, successor?: Member | null) {
    const bundle = this.getBundle(messId);
    bundle.members = bundle.members.map((m) => {
      if (m.id === currentMemberId) return { ...m, role: 'MEMBER' };
      if (successor && m.id === successor.id) return { ...m, role: 'MANAGER' };
      return m;
    });
    bundle.mess.adminUids = bundle.mess.adminUids.filter((u) => u !== DEMO_USER_ID);
    if (successor) {
      const sUid = successor.userId || successor.id;
      if (!bundle.mess.adminUids.includes(sUid)) bundle.mess.adminUids.push(sUid);
      if (bundle.mess.managerUid === DEMO_USER_ID) bundle.mess.managerUid = sUid;
    } else if (bundle.mess.managerUid === DEMO_USER_ID && bundle.mess.adminUids.length > 0) {
      bundle.mess.managerUid = bundle.mess.adminUids[0];
    }
    this.addAudit(bundle, {
      action: 'MANAGER_RESIGNED',
      performedByUid: DEMO_USER_ID,
      performedByName: this.state.profile.displayName,
      targetMemberId: successor?.id || currentMemberId,
      targetMemberName: successor?.displayName || '',
      details: successor
        ? `${this.state.profile.displayName} resigned and handed over Manager role to ${successor.displayName}`
        : `${this.state.profile.displayName} resigned from Manager role`,
      reason: '',
    });
    this.persist();
  }

  async updateMemberStatus(messId: string, memberId: string, isActive: boolean) {
    const bundle = this.getBundle(messId);
    bundle.members = bundle.members.map((m) => (m.id === memberId ? { ...m, isActive } : m));
    this.addAudit(bundle, {
      action: 'MEMBER_STATUS_UPDATED',
      performedByUid: DEMO_USER_ID,
      performedByName: this.state.profile.displayName,
      targetMemberId: memberId,
      targetMemberName: bundle.members.find((m) => m.id === memberId)?.displayName || '',
      details: `Set member active status to ${isActive ? 'Active' : 'Inactive'}`,
      reason: '',
    });
    this.persist();
  }

  private createEmptyRecord(date: string, version: number): DailyMealRecord {
    const isFri = checkIsFriday(date);
    return {
      id: date,
      date,
      isFriday: isFri,
      lunchServiceStatus: 'ACTIVE',
      nightServiceStatus: isFri ? 'CANCELLED' : 'ACTIVE',
      cancellationReason: '',
      bookings: {},
      attendances: {},
      totalDayUnits: 0,
      totalDayMeals: 0,
      version,
      updatedBy: DEMO_USER_ID,
      updatedAt: Date.now(),
    };
  }

  private findRecord(bundle: DemoMessBundle, date: string): DailyMealRecord | undefined {
    return bundle.dailyMeals.find((r) => r.id === date || r.date === date);
  }

  async updateMealServiceStatus(
    messId: string,
    date: string,
    lunchStatus: 'ACTIVE' | 'CANCELLED',
    nightStatus: 'ACTIVE' | 'CANCELLED',
    cancellationReason: string,
    expectedVersion: number | null
  ) {
    const bundle = this.getBundle(messId);
    const existing = this.findRecord(bundle, date);
    const nextVersion = assertAndNextVersion({
      exists: Boolean(existing),
      currentVersion: existing?.version,
      expectedVersion,
      recordLabel: `daily meal record (${date})`,
    });
    const rec = existing ?? this.createEmptyRecord(date, nextVersion);
    if (!existing) {
      bundle.dailyMeals.push(rec);
    }
    const isFri = checkIsFriday(date);
    rec.lunchServiceStatus = lunchStatus;
    rec.nightServiceStatus = isFri ? 'CANCELLED' : nightStatus;
    rec.cancellationReason = cancellationReason;
    rec.version = nextVersion;
    rec.updatedBy = DEMO_USER_ID;
    rec.updatedAt = Date.now();
    this.addAudit(bundle, {
      action: 'SERVICE_STATUS_UPDATED',
      performedByUid: DEMO_USER_ID,
      performedByName: this.state.profile.displayName,
      targetMemberId: '',
      targetMemberName: '',
      details: `Date: ${date} | Lunch: ${lunchStatus}, Night: ${rec.nightServiceStatus}`,
      reason: cancellationReason,
    });
    this.persist();
  }

  async saveMemberBooking({
    messId,
    date,
    memberId,
    booking,
    lunchDeadline,
    nightDeadline,
    isManager,
    expectedVersion,
  }: {
    messId: string;
    date: string;
    memberId: string;
    booking: MealBookingEntry;
    lunchDeadline: string;
    nightDeadline: string;
    isManager: boolean;
    expectedVersion: number | null;
  }) {
    const bundle = this.getBundle(messId);
    const isFri = checkIsFriday(date);
    const lunchPassed = isDeadlinePassed(date, lunchDeadline);
    const nightPassed = isFri ? true : isDeadlinePassed(date, nightDeadline);
    if (!isManager && lunchPassed && nightPassed) {
      throw new Error('Deadlines have passed. Bookings are locked.');
    }
    const existing = this.findRecord(bundle, date);
    const nextVersion = assertAndNextVersion({
      exists: Boolean(existing),
      currentVersion: existing?.version,
      expectedVersion,
      recordLabel: `daily meal record (${date})`,
    });
    const rec = existing ?? this.createEmptyRecord(date, nextVersion);
    if (!existing) {
      bundle.dailyMeals.push(rec);
    }
    rec.bookings = {
      ...rec.bookings,
      [memberId]: isFri
        ? { ...booking, statusNight: 'CANCELLED', guestNight: 0 }
        : { ...booking },
    };
    rec.version = nextVersion;
    rec.updatedBy = DEMO_USER_ID;
    rec.updatedAt = Date.now();
    this.persist();
  }

  async updateMemberAutoBookPreference({
    messId,
    memberId,
    enabled,
    bookLunch,
    bookNight,
    updatedDate,
  }: {
    messId: string;
    memberId: string;
    enabled: boolean;
    bookLunch: boolean;
    bookNight: boolean;
    updatedDate: string;
  }) {
    const bundle = this.getBundle(messId);
    bundle.members = bundle.members.map((m) =>
      m.id === memberId
        ? {
            ...m,
            autoBookEnabled: enabled,
            autoBookLunch: bookLunch,
            autoBookNight: bookNight,
            autoBookUpdatedAt: updatedDate,
          }
        : m
    );
    this.persist();
  }

  async clearAutoBookedEntries({
    messId,
    memberId,
    todayDate,
    records,
    lunchDeadline,
    nightDeadline,
  }: {
    messId: string;
    memberId: string;
    todayDate: string;
    records: DailyMealRecord[];
    lunchDeadline: string;
    nightDeadline: string;
  }) {
    const bundle = this.getBundle(messId);
    const versionMap = new Map(
      records.map((r) => [r.date || r.id, normalizeVersion(r.version)])
    );
    for (const rec of bundle.dailyMeals) {
      const date = rec.date || rec.id;
      if (date < todayDate) continue;
      const b = rec.bookings[memberId];
      if (!b || !b.autoBooked) continue;
      const isFri = checkIsFriday(date);
      const lunchPassed = isDeadlinePassed(date, lunchDeadline);
      const nightPassed = isFri ? true : isDeadlinePassed(date, nightDeadline);
      if (lunchPassed && nightPassed) continue;
      const nextVersion = assertAndNextVersion({
        exists: true,
        currentVersion: rec.version,
        expectedVersion: versionMap.has(date)
          ? versionMap.get(date)!
          : normalizeVersion(rec.version),
        recordLabel: `daily meal record (${date})`,
      });
      rec.bookings[memberId] = {
        ...b,
        statusLunch: lunchPassed ? b.statusLunch : 'NO_RESPONSE',
        statusNight: nightPassed ? b.statusNight : 'NO_RESPONSE',
        autoBooked: false,
      };
      rec.version = nextVersion;
      rec.updatedBy = DEMO_USER_ID;
      rec.updatedAt = Date.now();
    }
    this.persist();
  }

  async saveFinalMealOrderSummary(
    messId: string,
    date: string,
    mealType: 'LUNCH' | 'NIGHT',
    summary: Parameters<IMessDataService['saveFinalMealOrderSummary']>[3],
    expectedVersion: number | null
  ) {
    const bundle = this.getBundle(messId);
    const existing = this.findRecord(bundle, date);
    const nextVersion = assertAndNextVersion({
      exists: Boolean(existing),
      currentVersion: existing?.version,
      expectedVersion,
      recordLabel: `daily meal record (${date})`,
    });
    const rec = existing ?? this.createEmptyRecord(date, nextVersion);
    if (!existing) {
      bundle.dailyMeals.push(rec);
    }
    if (mealType === 'LUNCH') rec.lunchFinalOrder = { ...summary, savedAt: Date.now() };
    else rec.nightFinalOrder = { ...summary, savedAt: Date.now() };
    rec.version = nextVersion;
    rec.updatedBy = DEMO_USER_ID;
    rec.updatedAt = Date.now();
    this.persist();
  }

  async overrideMemberBooking({
    messId,
    date,
    memberId,
    memberName,
    booking,
    reason,
    expectedVersion,
  }: Parameters<IMessDataService['overrideMemberBooking']>[0]) {
    const bundle = this.getBundle(messId);
    const existing = this.findRecord(bundle, date);
    const nextVersion = assertAndNextVersion({
      exists: Boolean(existing),
      currentVersion: existing?.version,
      expectedVersion,
      recordLabel: `daily meal record (${date})`,
    });
    const rec = existing ?? this.createEmptyRecord(date, nextVersion);
    if (!existing) {
      bundle.dailyMeals.push(rec);
    }
    const isFri = checkIsFriday(date);
    rec.bookings = {
      ...rec.bookings,
      [memberId]: {
        ...booking,
        statusNight: isFri ? 'CANCELLED' : booking.statusNight,
        guestNight: isFri ? 0 : booking.guestNight,
        managerOverrideReason: reason,
        autoBooked: false,
      },
    };
    rec.version = nextVersion;
    rec.updatedBy = DEMO_USER_ID;
    rec.updatedAt = Date.now();
    this.addAudit(bundle, {
      action: 'BOOKING_OVERRIDE',
      performedByUid: DEMO_USER_ID,
      performedByName: this.state.profile.displayName,
      targetMemberId: memberId,
      targetMemberName: memberName,
      details: `Date: ${date} | Lunch: ${booking.statusLunch} (+${booking.guestLunch}G), Night: ${booking.statusNight} (+${booking.guestNight}G)`,
      reason,
    });
    this.persist();
  }

  async saveAttendance({
    messId,
    date,
    memberId,
    memberName,
    attendance,
    expectedVersion,
  }: Parameters<IMessDataService['saveAttendance']>[0]) {
    const bundle = this.getBundle(messId);
    const existing = this.findRecord(bundle, date);
    const nextVersion = assertAndNextVersion({
      exists: Boolean(existing),
      currentVersion: existing?.version,
      expectedVersion,
      recordLabel: `daily meal record (${date})`,
    });
    const rec = existing ?? this.createEmptyRecord(date, nextVersion);
    if (!existing) {
      bundle.dailyMeals.push(rec);
    }
    rec.attendances = { ...rec.attendances, [memberId]: attendance };
    rec.version = nextVersion;
    rec.updatedBy = DEMO_USER_ID;
    rec.updatedAt = Date.now();
    this.addAudit(bundle, {
      action: 'ATTENDANCE_CONFIRMED',
      performedByUid: DEMO_USER_ID,
      performedByName: this.state.profile.displayName,
      targetMemberId: memberId,
      targetMemberName: memberName,
      details: `Date: ${date} | Units: ${attendance.calculatedUnits}`,
      reason: '',
    });
    this.persist();
  }

  async addBazaarExpense(messId: string, expense: Omit<BazaarExpense, 'id'>) {
    const bundle = this.getBundle(messId);
    bundle.bazaarExpenses.unshift({
      ...expense,
      id: `baz_${Date.now()}`,
      version: 1,
      createdAt: Date.now(),
    });
    this.persist();
  }

  async updateBazaarExpense(messId: string, expense: BazaarExpense) {
    const bundle = this.getBundle(messId);
    const existing = bundle.bazaarExpenses.find((e) => e.id === expense.id);
    const nextVersion = assertAndNextVersion({
      exists: Boolean(existing),
      currentVersion: existing?.version,
      expectedVersion: normalizeVersion(expense.version),
      recordLabel: 'bazaar expense',
    });
    bundle.bazaarExpenses = bundle.bazaarExpenses.map((e) =>
      e.id === expense.id ? { ...expense, version: nextVersion } : e
    );
    this.persist();
  }

  async deleteBazaarExpense(messId: string, expenseId: string) {
    const bundle = this.getBundle(messId);
    bundle.bazaarExpenses = bundle.bazaarExpenses.filter((e) => e.id !== expenseId);
    this.persist();
  }

  async addDeposit(messId: string, deposit: Omit<Deposit, 'id'>) {
    const bundle = this.getBundle(messId);
    bundle.deposits.unshift({
      ...deposit,
      id: `dep_${Date.now()}`,
      version: 1,
      createdAt: Date.now(),
    });
    this.addAudit(bundle, {
      action: 'DEPOSIT_ADDED',
      performedByUid: DEMO_USER_ID,
      performedByName: this.state.profile.displayName,
      targetMemberId: deposit.memberId,
      targetMemberName: deposit.memberName,
      details: `Added deposit of ৳${deposit.amount} via ${deposit.paymentMethod} on ${deposit.date}`,
      reason: '',
    });
    this.persist();
  }

  async updateDeposit(messId: string, deposit: Deposit) {
    const bundle = this.getBundle(messId);
    const existing = bundle.deposits.find((d) => d.id === deposit.id);
    const nextVersion = assertAndNextVersion({
      exists: Boolean(existing),
      currentVersion: existing?.version,
      expectedVersion: normalizeVersion(deposit.version),
      recordLabel: 'deposit record',
    });
    bundle.deposits = bundle.deposits.map((d) =>
      d.id === deposit.id ? { ...deposit, version: nextVersion } : d
    );
    this.addAudit(bundle, {
      action: 'DEPOSIT_UPDATED',
      performedByUid: DEMO_USER_ID,
      performedByName: this.state.profile.displayName,
      targetMemberId: deposit.memberId,
      targetMemberName: deposit.memberName,
      details: `Updated deposit to ৳${deposit.amount} (${deposit.paymentMethod})`,
      reason: '',
    });
    this.persist();
  }

  async deleteDeposit(messId: string, deposit: Deposit) {
    const bundle = this.getBundle(messId);
    bundle.deposits = bundle.deposits.filter((d) => d.id !== deposit.id);
    this.addAudit(bundle, {
      action: 'DEPOSIT_DELETED',
      performedByUid: DEMO_USER_ID,
      performedByName: this.state.profile.displayName,
      targetMemberId: deposit.memberId,
      targetMemberName: deposit.memberName,
      details: `Deleted deposit of ৳${deposit.amount} (${deposit.date})`,
      reason: '',
    });
    this.persist();
  }

  async addUtilityBill(messId: string, bill: Omit<UtilityBill, 'id'>) {
    const bundle = this.getBundle(messId);
    bundle.utilityBills.push({
      ...bill,
      id: `util_${Date.now()}`,
      version: 1,
      createdAt: Date.now(),
    });
    this.addAudit(bundle, {
      action: 'UTILITY_BILL_ADDED',
      performedByUid: DEMO_USER_ID,
      performedByName: this.state.profile.displayName,
      targetMemberId: '',
      targetMemberName: '',
      details: `Added utility bill '${bill.title}': ৳${bill.amount}`,
      reason: '',
    });
    this.persist();
  }

  async updateUtilityBill(messId: string, bill: UtilityBill) {
    const bundle = this.getBundle(messId);
    const existing = bundle.utilityBills.find((b) => b.id === bill.id);
    const nextVersion = assertAndNextVersion({
      exists: Boolean(existing),
      currentVersion: existing?.version,
      expectedVersion: normalizeVersion(bill.version),
      recordLabel: `utility bill (${bill.title})`,
    });
    bundle.utilityBills = bundle.utilityBills.map((b) =>
      b.id === bill.id ? { ...bill, version: nextVersion } : b
    );
    this.addAudit(bundle, {
      action: 'UTILITY_BILL_UPDATED',
      performedByUid: DEMO_USER_ID,
      performedByName: this.state.profile.displayName,
      targetMemberId: '',
      targetMemberName: '',
      details: `Updated utility bill '${bill.title}': ৳${bill.amount}`,
      reason: '',
    });
    this.persist();
  }

  async deleteUtilityBill(messId: string, billId: string, title: string, amount: number) {
    const bundle = this.getBundle(messId);
    bundle.utilityBills = bundle.utilityBills.filter((b) => b.id !== billId);
    this.addAudit(bundle, {
      action: 'UTILITY_BILL_DELETED',
      performedByUid: DEMO_USER_ID,
      performedByName: this.state.profile.displayName,
      targetMemberId: '',
      targetMemberName: '',
      details: `Deleted utility bill '${title}' (৳${amount})`,
      reason: '',
    });
    this.persist();
  }

  async createSharedBill({
    messId,
    title,
    allocationType,
    amountInput,
    month,
    deadline,
    notes,
    activeMembers,
    customShares,
  }: Parameters<IMessDataService['createSharedBill']>[0]) {
    const bundle = this.getBundle(messId);
    const billId = `sb_${Date.now()}`;
    const memberCount = activeMembers.length;
    const assignedMemberIds = activeMembers.map((m) => m.id);
    const memberNames: Record<string, string> = {};
    const memberShares: Record<string, number> = {};
    activeMembers.forEach((m) => {
      memberNames[m.id] = m.displayName || 'Member';
    });

    let totalAmount = 0;
    let perMemberAmount = 0;

    if (allocationType === BillAllocationType.FIXED_PER_MEMBER) {
      perMemberAmount = roundTwoDecimals(amountInput);
      totalAmount = roundTwoDecimals(perMemberAmount * memberCount);
      activeMembers.forEach((m) => {
        memberShares[m.id] = perMemberAmount;
      });
    } else if (allocationType === BillAllocationType.DIVIDED_EQUALLY) {
      totalAmount = roundTwoDecimals(amountInput);
      perMemberAmount = memberCount > 0 ? roundTwoDecimals(totalAmount / memberCount) : 0;
      activeMembers.forEach((m) => {
        memberShares[m.id] = perMemberAmount;
      });
    } else {
      activeMembers.forEach((m) => {
        memberShares[m.id] = roundTwoDecimals(Math.max(0, customShares[m.id] ?? 0));
      });
      totalAmount = roundTwoDecimals(Object.values(memberShares).reduce((s, v) => s + v, 0));
      perMemberAmount = memberCount > 0 ? roundTwoDecimals(totalAmount / memberCount) : 0;
    }

    bundle.sharedBills.unshift({
      id: billId,
      title: title.trim(),
      allocationType,
      totalAmount,
      perMemberAmount,
      month,
      deadline,
      notes,
      assignedMemberIds,
      memberShares,
      memberNames,
      payments: {},
      createdByUid: DEMO_USER_ID,
      createdByName: this.state.profile.displayName,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    activeMembers.forEach((m) => {
      const share = memberShares[m.id] ?? perMemberAmount;
      bundle.notifications.unshift({
        id: `notif_${Date.now()}_${m.id}`,
        messId,
        targetMemberId: m.id,
        targetMemberName: m.displayName,
        title: `New Bill: ${title.trim()}`,
        message: `Your share is ৳${share.toFixed(0)}. Deadline: ${deadline}.`,
        billId,
        amount: share,
        deadline,
        isRead: false,
        createdAt: Date.now(),
      });
    });

    this.addAudit(bundle, {
      action: 'SHARED_BILL_PUBLISHED',
      performedByUid: DEMO_USER_ID,
      performedByName: this.state.profile.displayName,
      targetMemberId: '',
      targetMemberName: '',
      details: `Published '${title}': ৳${totalAmount} total (${allocationType}) for ${memberCount} members.`,
      reason: '',
    });
    this.persist();
    return billId;
  }

  async updateSharedBill(
    messId: string,
    bill: SharedBill,
    updatedShares?: Record<string, number>
  ) {
    const bundle = this.getBundle(messId);
    const existing = bundle.sharedBills.find((b) => b.id === bill.id);
    const nextVersion = assertAndNextVersion({
      exists: Boolean(existing),
      currentVersion: existing?.version,
      expectedVersion: normalizeVersion(bill.version),
      recordLabel: `shared bill (${bill.title})`,
    });

    const finalShares = updatedShares ?? bill.memberShares;
    const finalTotal = updatedShares
      ? roundTwoDecimals(Object.values(finalShares).reduce((s, v) => s + v, 0))
      : bill.totalAmount;
    const finalPerMem =
      bill.assignedMemberIds.length > 0
        ? roundTwoDecimals(finalTotal / bill.assignedMemberIds.length)
        : bill.perMemberAmount;

    const updatedPayments = { ...bill.payments };
    for (const [memId, rec] of Object.entries(updatedPayments)) {
      const share = finalShares[memId] ?? finalPerMem;
      updatedPayments[memId] = {
        ...rec,
        status:
          rec.amountPaid >= share && share > 0
            ? BillPaymentStatus.PAID
            : rec.amountPaid > 0
              ? BillPaymentStatus.PARTIALLY_PAID
              : BillPaymentStatus.UNPAID,
      };
    }

    bundle.sharedBills = bundle.sharedBills.map((b) =>
      b.id === bill.id
        ? {
            ...bill,
            totalAmount: finalTotal,
            perMemberAmount: finalPerMem,
            memberShares: finalShares,
            payments: updatedPayments,
            version: nextVersion,
            updatedAt: Date.now(),
          }
        : b
    );
    this.addAudit(bundle, {
      action: 'SHARED_BILL_UPDATED',
      performedByUid: DEMO_USER_ID,
      performedByName: this.state.profile.displayName,
      targetMemberId: '',
      targetMemberName: '',
      details: `Updated bill '${bill.title}' (Total: ৳${finalTotal}, Deadline: ${bill.deadline})`,
      reason: '',
    });
    this.persist();
  }

  async deleteSharedBill(
    messId: string,
    billId: string,
    billTitle: string,
    totalAmount: number,
    expectedVersion?: number | null
  ) {
    const bundle = this.getBundle(messId);
    if (expectedVersion !== undefined) {
      const existing = bundle.sharedBills.find((b) => b.id === billId);
      assertAndNextVersion({
        exists: Boolean(existing),
        currentVersion: existing?.version,
        expectedVersion,
        recordLabel: `shared bill (${billTitle})`,
      });
    }
    bundle.sharedBills = bundle.sharedBills.filter((b) => b.id !== billId);
    this.addAudit(bundle, {
      action: 'SHARED_BILL_DELETED',
      performedByUid: DEMO_USER_ID,
      performedByName: this.state.profile.displayName,
      targetMemberId: '',
      targetMemberName: '',
      details: `Deleted shared bill '${billTitle}' (Total: ৳${totalAmount})`,
      reason: '',
    });
    this.persist();
  }

  async recordBillPayment({
    messId,
    billId,
    memberId,
    memberName,
    assignedShare,
    amountPaid,
    paymentMethod,
    paymentDate,
    notes,
    expectedVersion,
  }: Parameters<IMessDataService['recordBillPayment']>[0]) {
    const bundle = this.getBundle(messId);
    const existing = bundle.sharedBills.find((b) => b.id === billId);
    const nextVersion = assertAndNextVersion({
      exists: Boolean(existing),
      currentVersion: existing?.version,
      expectedVersion,
      recordLabel: 'shared bill',
    });

    const liveShare =
      existing && typeof existing.memberShares?.[memberId] === 'number'
        ? existing.memberShares[memberId]
        : existing && typeof existing.perMemberAmount === 'number'
          ? existing.perMemberAmount
          : assignedShare;

    const status =
      amountPaid >= liveShare && liveShare > 0
        ? BillPaymentStatus.PAID
        : amountPaid > 0
          ? BillPaymentStatus.PARTIALLY_PAID
          : BillPaymentStatus.UNPAID;

    bundle.sharedBills = bundle.sharedBills.map((b) =>
      b.id === billId
        ? {
            ...b,
            payments: {
              ...b.payments,
              [memberId]: {
                memberId,
                memberName,
                amountPaid,
                status,
                paymentDate,
                paymentMethod,
                notes,
                recordedByUid: DEMO_USER_ID,
                recordedByName: this.state.profile.displayName,
                updatedAt: Date.now(),
              },
            },
            version: nextVersion,
            updatedAt: Date.now(),
          }
        : b
    );
    this.addAudit(bundle, {
      action: 'BILL_PAYMENT_RECORDED',
      performedByUid: DEMO_USER_ID,
      performedByName: this.state.profile.displayName,
      targetMemberId: memberId,
      targetMemberName: memberName,
      details: `Recorded payment of ৳${amountPaid} for ${memberName} (Status: ${status}, Method: ${paymentMethod})`,
      reason: '',
    });
    this.persist();
  }

  async markNotificationAsRead(messId: string, notificationId: string) {
    const bundle = this.getBundle(messId);
    bundle.notifications = bundle.notifications.map((n) =>
      n.id === notificationId ? { ...n, isRead: true } : n
    );
    this.persist();
  }

  async markAllNotificationsAsRead(messId: string, notificationIds: string[]) {
    const bundle = this.getBundle(messId);
    const idSet = new Set(notificationIds);
    bundle.notifications = bundle.notifications.map((n) =>
      idSet.has(n.id) ? { ...n, isRead: true } : n
    );
    this.persist();
  }
}

export const demoMessService = new DemoMessServiceImpl();
