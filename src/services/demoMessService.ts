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
import { IMessDataService, MessObservers } from './messServiceTypes';

const DEMO_STORAGE_KEY = 'mess_meal_demo_state_v1';
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
      updatedBy: DEMO_USER_ID,
      updatedAt: Date.now() - 3600000,
    };
  };

  const dailyMeals: DailyMealRecord[] = [
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

  const bazaarExpenses: BazaarExpense[] = [
    {
      id: 'baz_1',
      buyerMemberId: 'mem_rahim',
      buyerName: 'Rahim Ahmed',
      amount: 1450,
      itemsDescription: 'Rohu fish 2.5kg, potatoes, onions, green chili, cooking oil',
      category: 'Meat & Fish',
      date: yesterday,
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
      createdAt: Date.now() - 86400000 * 4,
    },
  ];

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
      createdAt: Date.now() - 86400000,
    },
  ];

  const utilityBills: UtilityBill[] = [
    {
      id: 'util_1',
      title: 'Cook (Khala) Monthly Salary',
      amount: 3500,
      month: currentMonth,
      createdAt: Date.now() - 86400000 * 5,
    },
    {
      id: 'util_2',
      title: 'LPG Gas & Stove Maintenance',
      amount: 1450,
      month: currentMonth,
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
  }

  private loadState(): DemoState {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as DemoState;
          if (parsed && parsed.messes && parsed.profile) {
            return parsed;
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

  observeMessBundle(messId: string, currentUserId: string, observers: MessObservers) {
    const emit = () => {
      const bundle = this.state.messes[messId];
      if (!bundle) {
        observers.onMess?.(null);
        return;
      }
      observers.onMess?.({ ...bundle.mess });
      observers.onMembers?.([...bundle.members]);
      observers.onDailyMeals?.([...bundle.dailyMeals]);
      observers.onBazaarExpenses?.(
        [...bundle.bazaarExpenses].sort((a, b) => b.date.localeCompare(a.date))
      );
      observers.onDeposits?.([...bundle.deposits].sort((a, b) => b.date.localeCompare(a.date)));
      observers.onUtilityBills?.([...bundle.utilityBills]);
      observers.onSharedBills?.(
        [...bundle.sharedBills].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
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
    };
    emit();
    this.listeners.add(emit);
    return () => {
      this.listeners.delete(emit);
    };
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

  async updateBookingDeadlines(messId: string, lunchDeadline: string, nightDeadline: string) {
    const bundle = this.getBundle(messId);
    bundle.mess.lunchBookingDeadline = lunchDeadline;
    bundle.mess.nightBookingDeadline = nightDeadline;
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

  private getOrCreateRecord(bundle: DemoMessBundle, date: string): DailyMealRecord {
    let rec = bundle.dailyMeals.find((r) => r.id === date || r.date === date);
    if (!rec) {
      const isFri = checkIsFriday(date);
      rec = {
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
        updatedBy: DEMO_USER_ID,
        updatedAt: Date.now(),
      };
      bundle.dailyMeals.push(rec);
    }
    return rec;
  }

  async updateMealServiceStatus(
    messId: string,
    date: string,
    lunchStatus: 'ACTIVE' | 'CANCELLED',
    nightStatus: 'ACTIVE' | 'CANCELLED',
    cancellationReason: string
  ) {
    const bundle = this.getBundle(messId);
    const rec = this.getOrCreateRecord(bundle, date);
    const isFri = checkIsFriday(date);
    rec.lunchServiceStatus = lunchStatus;
    rec.nightServiceStatus = isFri ? 'CANCELLED' : nightStatus;
    rec.cancellationReason = cancellationReason;
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
  }: {
    messId: string;
    date: string;
    memberId: string;
    booking: MealBookingEntry;
    lunchDeadline: string;
    nightDeadline: string;
    isManager: boolean;
  }) {
    const bundle = this.getBundle(messId);
    const isFri = checkIsFriday(date);
    const lunchPassed = isDeadlinePassed(date, lunchDeadline);
    const nightPassed = isFri ? true : isDeadlinePassed(date, nightDeadline);
    if (!isManager && lunchPassed && nightPassed) {
      throw new Error('Deadlines have passed. Bookings are locked.');
    }
    const rec = this.getOrCreateRecord(bundle, date);
    rec.bookings = {
      ...rec.bookings,
      [memberId]: isFri
        ? { ...booking, statusNight: 'CANCELLED', guestNight: 0 }
        : { ...booking },
    };
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
    for (const rec of bundle.dailyMeals) {
      if (rec.date < todayDate) continue;
      const b = rec.bookings[memberId];
      if (!b || !b.autoBooked) continue;
      const isFri = checkIsFriday(rec.date);
      const lunchPassed = isDeadlinePassed(rec.date, lunchDeadline);
      const nightPassed = isFri ? true : isDeadlinePassed(rec.date, nightDeadline);
      if (lunchPassed && nightPassed) continue;
      rec.bookings[memberId] = {
        ...b,
        statusLunch: lunchPassed ? b.statusLunch : 'NO_RESPONSE',
        statusNight: nightPassed ? b.statusNight : 'NO_RESPONSE',
        autoBooked: false,
      };
    }
    this.persist();
  }

  async saveFinalMealOrderSummary(
    messId: string,
    date: string,
    mealType: 'LUNCH' | 'NIGHT',
    summary: Parameters<IMessDataService['saveFinalMealOrderSummary']>[3]
  ) {
    const bundle = this.getBundle(messId);
    const rec = this.getOrCreateRecord(bundle, date);
    if (mealType === 'LUNCH') rec.lunchFinalOrder = { ...summary, savedAt: Date.now() };
    else rec.nightFinalOrder = { ...summary, savedAt: Date.now() };
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
  }: Parameters<IMessDataService['overrideMemberBooking']>[0]) {
    const bundle = this.getBundle(messId);
    const rec = this.getOrCreateRecord(bundle, date);
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
  }: Parameters<IMessDataService['saveAttendance']>[0]) {
    const bundle = this.getBundle(messId);
    const rec = this.getOrCreateRecord(bundle, date);
    rec.attendances = { ...rec.attendances, [memberId]: attendance };
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
      createdAt: Date.now(),
    });
    this.persist();
  }

  async updateBazaarExpense(messId: string, expense: BazaarExpense) {
    const bundle = this.getBundle(messId);
    bundle.bazaarExpenses = bundle.bazaarExpenses.map((e) =>
      e.id === expense.id ? expense : e
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
    bundle.deposits = bundle.deposits.map((d) => (d.id === deposit.id ? deposit : d));
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
    bundle.utilityBills.push({ ...bill, id: `util_${Date.now()}`, createdAt: Date.now() });
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
    bundle.utilityBills = bundle.utilityBills.map((b) => (b.id === bill.id ? bill : b));
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
    totalAmount: number
  ) {
    const bundle = this.getBundle(messId);
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
  }: Parameters<IMessDataService['recordBillPayment']>[0]) {
    const bundle = this.getBundle(messId);
    const status =
      amountPaid >= assignedShare && assignedShare > 0
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
