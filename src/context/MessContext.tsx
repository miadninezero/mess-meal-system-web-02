import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider, testFirestoreConnection } from '../firebase/config';
import { DEMO_USER_ID, demoMessService } from '../services/demoMessService';
import { firestoreMessService } from '../services/firestoreMessService';
import { IMessDataService } from '../services/messServiceTypes';
import {
  AuditLog,
  BazaarExpense,
  BillAllocationTypeValue,
  DailyMealRecord,
  Deposit,
  InAppNotification,
  KitchenOrderSummary,
  MealBookingEntry,
  MealServiceStatus,
  Member,
  Mess,
  MessSummary,
  SharedBill,
  UserProfile,
  UtilityBill,
  defaultBookingEntry,
  isMessManagerRole,
} from '../types/mess';
import {
  format12Hour,
  getCurrentDhakaMonth,
  getDhakaDateTime,
  getTodayDhakaDate,
  isDeadlinePassed,
  isFriday as checkIsFriday,
} from '../utils/dhakaTime';
import { createSingleFlightLock } from '../utils/asyncActionGuard';
import {
  calculateAttendanceUnits,
  calculateSummary,
  computeKitchenOrderSummary,
} from '../utils/messCalculations';
import {
  isConcurrencyConflictError,
  normalizeVersion,
} from '../utils/optimisticConcurrency';

export type NavTab =
  | 'dashboard'
  | 'meals'
  | 'bazaar'
  | 'bills'
  | 'deposits'
  | 'settlement'
  | 'mess_select';

export type AuthMode = 'loading' | 'unauthenticated' | 'firebase' | 'demo';

export interface AuthUserInfo {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
}

export interface ConcurrencyConflictState {
  message: string;
  recordLabel: string;
  occurredAt: number;
}

interface MessContextValue {
  authMode: AuthMode;
  authUser: AuthUserInfo | null;
  isDemoMode: boolean;
  userProfile: UserProfile | null;
  userMesses: Mess[];
  selectedMessId: string;
  currentMess: Mess | null;
  members: Member[];
  dailyMeals: DailyMealRecord[];
  bazaarExpenses: BazaarExpense[];
  deposits: Deposit[];
  utilityBills: UtilityBill[];
  sharedBills: SharedBill[];
  notifications: InAppNotification[];
  unreadNotificationsCount: number;
  auditLogs: AuditLog[];
  selectedDate: string;
  todayDhakaDate: string;
  isManager: boolean;
  currentMember: Member | null;
  summary: MessSummary;
  kitchenSummary: KitchenOrderSummary;
  uiMessage: { text: string; tone: 'info' | 'error' } | null;
  conflictState: ConcurrencyConflictState | null;
  syncRevision: number;
  isSubmitting: boolean;
  activeNav: NavTab;
  isWalkthroughOpen: boolean;
  walkthroughRunId: number;

  setActiveNav: (tab: NavTab) => void;
  setSelectedDate: (date: string) => void;
  clearUiMessage: () => void;
  showUiMessage: (text: string, tone?: 'info' | 'error') => void;
  clearConflict: () => void;
  reloadLatestData: () => Promise<void>;
  openWalkthrough: () => void;
  closeWalkthrough: () => void;

  signInWithGoogle: () => Promise<void>;
  enterDemoMode: () => void;
  resetDemoWorkspace: () => void;
  signOut: () => Promise<void>;

  selectMess: (messId: string) => Promise<void>;
  createMess: (name: string, managerName: string) => Promise<void>;
  joinMess: (messId: string, memberName: string, room: string) => Promise<void>;
  configureDeadlines: (
    lunchDeadline: string,
    nightDeadline: string,
    expectedVersion?: number | null
  ) => Promise<boolean>;

  updateMealServiceStatus: (
    date: string,
    lunchStatus: MealServiceStatus,
    nightStatus: MealServiceStatus,
    cancellationReason: string,
    expectedVersion?: number | null
  ) => Promise<boolean>;
  saveMyBooking: (
    date: string,
    statusLunch: 'BOOKED' | 'CANCELLED',
    statusNight: 'BOOKED' | 'CANCELLED',
    guestLunch: number,
    guestNight: number,
    expectedVersion?: number | null
  ) => Promise<boolean>;
  setAutoBooking: (enabled: boolean, bookLunch?: boolean, bookNight?: boolean) => Promise<void>;
  managerOverrideBooking: (params: {
    date: string;
    memberId: string;
    memberName: string;
    statusLunch: 'BOOKED' | 'CANCELLED';
    statusNight: 'BOOKED' | 'CANCELLED';
    guestLunch: number;
    guestNight: number;
    reason: string;
    expectedVersion?: number | null;
  }) => Promise<boolean>;
  saveFinalOrderSummary: (
    date: string,
    mealType: 'LUNCH' | 'NIGHT',
    expectedVersion?: number | null
  ) => Promise<boolean>;
  saveConfirmedAttendance: (params: {
    date: string;
    memberId: string;
    memberName: string;
    attendedLunch: boolean;
    attendedNight: boolean;
    guestLunchAttended: number;
    guestNightAttended: number;
    expectedVersion?: number | null;
  }) => Promise<boolean>;

  addBazaarExpense: (params: {
    buyerMemberId: string;
    buyerName: string;
    amount: number;
    itemsDescription: string;
    category: string;
    date: string;
  }) => Promise<boolean>;
  updateBazaarExpense: (expense: BazaarExpense) => Promise<boolean>;
  deleteBazaarExpense: (expenseId: string) => Promise<boolean>;

  addDeposit: (params: {
    memberId: string;
    memberName: string;
    amount: number;
    paymentMethod: string;
    notes: string;
    date: string;
  }) => Promise<boolean>;
  updateDeposit: (deposit: Deposit) => Promise<boolean>;
  deleteDeposit: (deposit: Deposit) => Promise<boolean>;

  addUtilityBill: (title: string, amount: number) => Promise<boolean>;
  updateUtilityBill: (bill: UtilityBill) => Promise<boolean>;
  deleteUtilityBill: (bill: UtilityBill) => Promise<boolean>;

  createSharedBill: (params: {
    title: string;
    allocationType: BillAllocationTypeValue;
    amountInput: number;
    deadline: string;
    notes: string;
    customShares?: Record<string, number>;
  }) => Promise<boolean>;
  updateSharedBill: (
    bill: SharedBill,
    updatedShares?: Record<string, number>
  ) => Promise<boolean>;
  deleteSharedBill: (bill: SharedBill) => Promise<boolean>;
  recordBillPayment: (params: {
    billId: string;
    memberId: string;
    memberName: string;
    assignedShare: number;
    amountPaid: number;
    paymentMethod: string;
    paymentDate: string;
    notes: string;
    expectedVersion?: number | null;
  }) => Promise<boolean>;

  updateMemberStatus: (memberId: string, isActive: boolean) => Promise<void>;
  promoteMemberToManager: (targetMember: Member) => Promise<void>;
  demoteManagerToMember: (targetMember: Member) => Promise<void>;
  resignAsManager: (successor?: Member | null) => Promise<void>;

  markNotificationAsRead: (notificationId: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
}

const MessContext = createContext<MessContextValue | null>(null);

export function MessProvider({ children }: { children: React.ReactNode }) {
  const isAutostart = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1';
  }, []);

  const [authMode, setAuthMode] = useState<AuthMode>(isAutostart ? 'demo' : 'loading');
  const [authUser, setAuthUser] = useState<AuthUserInfo | null>(
    isAutostart
      ? {
          uid: DEMO_USER_ID,
          displayName: 'Tanvir Hasan',
          email: 'tanvir.demo@messmeal.app',
        }
      : null
  );

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userMesses, setUserMesses] = useState<Mess[]>([]);
  const [selectedMessId, setSelectedMessId] = useState<string>('');
  const [currentMess, setCurrentMess] = useState<Mess | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [dailyMeals, setDailyMeals] = useState<DailyMealRecord[]>([]);
  const [bazaarExpenses, setBazaarExpenses] = useState<BazaarExpense[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [utilityBills, setUtilityBills] = useState<UtilityBill[]>([]);
  const [sharedBills, setSharedBills] = useState<SharedBill[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const todayDhakaDate = getTodayDhakaDate();
  const [selectedDate, setSelectedDate] = useState<string>(todayDhakaDate);
  const [activeNav, setActiveNav] = useState<NavTab>('dashboard');
  const [uiMessage, setUiMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);
  const [conflictState, setConflictState] = useState<ConcurrencyConflictState | null>(null);
  const [syncRevision, setSyncRevision] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState<boolean>(() => {
    if (!isAutostart) return false;
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('mess_meal_demo_tour_dismissed_v1') !== '1';
  });
  const [walkthroughRunId, setWalkthroughRunId] = useState(0);

  const autoSavedFinalRef = useRef<Set<string>>(new Set());
  const mutationLockRef = useRef(createSingleFlightLock());

  const openWalkthrough = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('mess_meal_demo_tour_dismissed_v1');
    }
    setWalkthroughRunId((prev) => prev + 1);
    setIsWalkthroughOpen(true);
  }, []);

  const closeWalkthrough = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('mess_meal_demo_tour_dismissed_v1', '1');
    }
    setIsWalkthroughOpen(false);
  }, []);

  const showUiMessage = useCallback((text: string, tone: 'info' | 'error' = 'info') => {
    setUiMessage({ text, tone });
  }, []);

  const clearUiMessage = useCallback(() => {
    setUiMessage(null);
  }, []);

  const clearConflict = useCallback(() => {
    setConflictState(null);
  }, []);

  const handleMutationError = useCallback(
    (e: unknown, fallbackMessage: string) => {
      if (isConcurrencyConflictError(e)) {
        setConflictState({
          message: e.message,
          recordLabel: e.recordLabel,
          occurredAt: Date.now(),
        });
        return;
      }
      showUiMessage(e instanceof Error ? e.message : fallbackMessage, 'error');
    },
    [showUiMessage]
  );

  // Auto-dismiss UI toast after 4.5s
  useEffect(() => {
    if (!uiMessage) return;
    const t = window.setTimeout(() => setUiMessage(null), 4500);
    return () => window.clearTimeout(t);
  }, [uiMessage]);

  // Listen to Firebase Auth state (unless already in demo mode via ?autostart=1)
  useEffect(() => {
    if (isAutostart) return;
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setAuthMode('firebase');
        setAuthUser({
          uid: fbUser.uid,
          displayName: fbUser.displayName || 'Member',
          email: fbUser.email || '',
          photoURL: fbUser.photoURL,
        });
      } else {
        setAuthMode((prev) => (prev === 'demo' ? 'demo' : 'unauthenticated'));
        setAuthUser((prev) => (prev?.uid === DEMO_USER_ID ? prev : null));
      }
    });
    return () => unsub();
  }, [isAutostart]);

  const service: IMessDataService = useMemo(
    () => (authMode === 'demo' ? demoMessService : firestoreMessService),
    [authMode]
  );

  // Observe user profile & user messes when authenticated
  useEffect(() => {
    if (!authUser || (authMode !== 'firebase' && authMode !== 'demo')) {
      setUserProfile(null);
      setUserMesses([]);
      setSelectedMessId('');
      return;
    }

    const storageKey = `mess_meal_selected_${authUser.uid}`;
    const cachedMessId =
      typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) || '' : '';
    if (cachedMessId) {
      setSelectedMessId(cachedMessId);
    }

    const unsubProfile = service.observeUserProfile(
      authUser.uid,
      (profile) => {
        setUserProfile(profile);
        if (profile?.currentMessId) {
          setSelectedMessId((prev) => {
            if (prev) return prev;
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(storageKey, profile.currentMessId);
            }
            return profile.currentMessId;
          });
        }
      },
      (err) => showUiMessage(err.message, 'error')
    );

    const unsubMesses = service.observeUserMesses(
      authUser.uid,
      (list) => {
        setUserMesses(list);
        if (list.length > 0) {
          setSelectedMessId((prev) => {
            if (prev && list.some((m) => m.id === prev)) return prev;
            if (!prev) {
              const firstId = list[0].id;
              if (typeof window !== 'undefined') {
                window.localStorage.setItem(storageKey, firstId);
              }
              return firstId;
            }
            return prev;
          });
        }
      },
      (err) => showUiMessage(err.message, 'error')
    );

    return () => {
      unsubProfile();
      unsubMesses();
    };
  }, [authMode, authUser, service, showUiMessage]);

  const reloadLatestData = useCallback(async () => {
    if (!selectedMessId || !authUser || (authMode !== 'firebase' && authMode !== 'demo')) {
      setConflictState(null);
      return;
    }
    try {
      await service.refreshMessData(selectedMessId, authUser.uid, {
        onMess: setCurrentMess,
        onMembers: setMembers,
        onDailyMeals: setDailyMeals,
        onBazaarExpenses: setBazaarExpenses,
        onDeposits: setDeposits,
        onUtilityBills: setUtilityBills,
        onSharedBills: setSharedBills,
        onNotifications: setNotifications,
        onAuditLogs: setAuditLogs,
        onError: (err) => showUiMessage(err.message, 'error'),
      });
      setConflictState(null);
      setSyncRevision((prev) => prev + 1);
      showUiMessage('Latest mess data loaded.');
    } catch (e) {
      showUiMessage(e instanceof Error ? e.message : 'Failed to reload latest data.', 'error');
    }
  }, [authMode, authUser, selectedMessId, service, showUiMessage]);

  // Observe active mess collections
  useEffect(() => {
    if (!selectedMessId || !authUser || (authMode !== 'firebase' && authMode !== 'demo')) {
      setCurrentMess(null);
      setMembers([]);
      setDailyMeals([]);
      setBazaarExpenses([]);
      setDeposits([]);
      setUtilityBills([]);
      setSharedBills([]);
      setNotifications([]);
      setAuditLogs([]);
      return;
    }

    return service.observeMessBundle(selectedMessId, authUser.uid, {
      onMess: setCurrentMess,
      onMembers: setMembers,
      onDailyMeals: setDailyMeals,
      onBazaarExpenses: setBazaarExpenses,
      onDeposits: setDeposits,
      onUtilityBills: setUtilityBills,
      onSharedBills: setSharedBills,
      onNotifications: setNotifications,
      onAuditLogs: setAuditLogs,
      onError: (err) => showUiMessage(err.message, 'error'),
    });
  }, [authMode, authUser, selectedMessId, service, showUiMessage]);

  const currentMember = useMemo(
    () => members.find((m) => m.userId === authUser?.uid) ?? null,
    [members, authUser]
  );

  const isManager = useMemo(() => {
    if (!authUser) return false;
    return isMessManagerRole(currentMess, authUser.uid) || currentMember?.role === 'MANAGER';
  }, [currentMess, currentMember, authUser]);

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const summary: MessSummary = useMemo(
    () =>
      calculateSummary({
        members,
        dailyMeals,
        bazaarExpenses,
        deposits,
        utilityBills,
        sharedBills,
        lunchDeadline: currentMess?.lunchBookingDeadline || '09:00',
        nightDeadline: currentMess?.nightBookingDeadline || '17:00',
      }),
    [members, dailyMeals, bazaarExpenses, deposits, utilityBills, sharedBills, currentMess]
  );

  const kitchenSummary: KitchenOrderSummary = useMemo(
    () =>
      computeKitchenOrderSummary({
        selectedDate,
        todayDhakaDate,
        dailyMeals,
        members,
        lunchDeadline: currentMess?.lunchBookingDeadline || '09:00',
        nightDeadline: currentMess?.nightBookingDeadline || '17:00',
      }),
    [selectedDate, todayDhakaDate, dailyMeals, members, currentMess]
  );

  // Auto-save final order summary when deadline passes (matching MessViewModel.kt)
  useEffect(() => {
    if (!selectedMessId || !currentMess || !isManager) return;
    if (selectedDate !== todayDhakaDate) return;

    const currentRecord = dailyMeals.find((r) => r.id === selectedDate || r.date === selectedDate);
    const expectedVersion = currentRecord ? normalizeVersion(currentRecord.version) : null;
    const lunchDeadline = currentMess.lunchBookingDeadline || '09:00';
    const nightDeadline = currentMess.nightBookingDeadline || '17:00';

    if (
      kitchenSummary.isLunchLocked &&
      kitchenSummary.lunchActive &&
      !kitchenSummary.lunchFinalOrder
    ) {
      const key = `${selectedMessId}_${selectedDate}_LUNCH`;
      if (!autoSavedFinalRef.current.has(key)) {
        autoSavedFinalRef.current.add(key);
        service
          .saveFinalMealOrderSummary(
            selectedMessId,
            selectedDate,
            'LUNCH',
            {
              mealType: 'LUNCH',
              date: selectedDate,
              totalPortions: kitchenSummary.lunchTotalPortions,
              memberCount: kitchenSummary.lunchMemberCount,
              guestCount: kitchenSummary.lunchGuestCount,
              deadline: lunchDeadline,
              isLocked: true,
              lockedAtDhakaTime: format12Hour(lunchDeadline),
            },
            expectedVersion
          )
          .catch(() => {});
      }
    }

    if (
      kitchenSummary.isNightLocked &&
      kitchenSummary.nightActive &&
      !kitchenSummary.isFriday &&
      !kitchenSummary.nightFinalOrder
    ) {
      const key = `${selectedMessId}_${selectedDate}_NIGHT`;
      if (!autoSavedFinalRef.current.has(key)) {
        autoSavedFinalRef.current.add(key);
        service
          .saveFinalMealOrderSummary(
            selectedMessId,
            selectedDate,
            'NIGHT',
            {
              mealType: 'NIGHT',
              date: selectedDate,
              totalPortions: kitchenSummary.nightTotalPortions,
              memberCount: kitchenSummary.nightMemberCount,
              guestCount: kitchenSummary.nightGuestCount,
              deadline: nightDeadline,
              isLocked: true,
              lockedAtDhakaTime: format12Hour(nightDeadline),
            },
            expectedVersion
          )
          .catch(() => {});
      }
    }
  }, [currentMess, dailyMeals, isManager, kitchenSummary, selectedDate, selectedMessId, service, todayDhakaDate]);

  // --- Auth Actions ---
  const signInWithGoogle = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setAuthMode('firebase');
      setAuthUser({
        uid: result.user.uid,
        displayName: result.user.displayName || 'Member',
        email: result.user.email || '',
        photoURL: result.user.photoURL,
      });
      await firestoreMessService.saveUserProfile({
        id: result.user.uid,
        displayName: result.user.displayName || 'Member',
        email: result.user.email || '',
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Google Sign-In failed.';
      showUiMessage(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [showUiMessage]);

  const enterDemoMode = useCallback(() => {
    setAuthMode('demo');
    setAuthUser({
      uid: DEMO_USER_ID,
      displayName: 'Tanvir Hasan',
      email: 'tanvir.demo@messmeal.app',
    });
    setActiveNav('dashboard');
    openWalkthrough();
    showUiMessage('Entered Demo Mess Workspace with guided walkthrough.');
  }, [openWalkthrough, showUiMessage]);

  const resetDemoWorkspace = useCallback(() => {
    demoMessService.resetDemoData();
    setConflictState(null);
    setSyncRevision((prev) => prev + 1);
    setSelectedMessId('GV-MESS-2026');
    setActiveNav('dashboard');
    openWalkthrough();
    showUiMessage('Demo workspace reset to initial seed data.');
  }, [openWalkthrough, showUiMessage]);

  const signOut = useCallback(async () => {
    if (authMode === 'firebase') {
      await firebaseSignOut(auth);
    }
    setConflictState(null);
    setAuthMode('unauthenticated');
    setAuthUser(null);
    setSelectedMessId('');
    setIsWalkthroughOpen(false);
    setActiveNav('dashboard');
  }, [authMode]);

  // --- Mess Setup ---
  const selectMess = useCallback(
    async (messId: string) => {
      if (!authUser) return;
      setConflictState(null);
      setSelectedMessId(messId);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`mess_meal_selected_${authUser.uid}`, messId);
      }
      setActiveNav('dashboard');
      await service.saveUserProfile({
        id: authUser.uid,
        displayName: userProfile?.displayName || authUser.displayName,
        email: userProfile?.email || authUser.email,
        currentMessId: messId,
      });
    },
    [authUser, service, userProfile]
  );

  const createMess = useCallback(
    async (name: string, managerName: string) => {
      if (!authUser) return;
      await mutationLockRef.current.run('createMess', async () => {
        setIsSubmitting(true);
        try {
          const newId = await service.createMess(name, managerName, getCurrentDhakaMonth());
          setSelectedMessId(newId);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(`mess_meal_selected_${authUser.uid}`, newId);
          }
          setActiveNav('dashboard');
          showUiMessage(`Mess '${name}' created successfully!`);
        } catch (e) {
          showUiMessage(e instanceof Error ? e.message : 'Failed to create mess.', 'error');
        } finally {
          setIsSubmitting(false);
        }
      });
    },
    [authUser, service, showUiMessage]
  );

  const joinMess = useCallback(
    async (messId: string, memberName: string, room: string) => {
      if (!authUser) return;
      await mutationLockRef.current.run('joinMess', async () => {
        setIsSubmitting(true);
        try {
          await service.joinMess(messId.trim(), memberName.trim(), room.trim());
          setSelectedMessId(messId.trim());
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(`mess_meal_selected_${authUser.uid}`, messId.trim());
          }
          setActiveNav('dashboard');
          showUiMessage('Joined mess successfully!');
        } catch (e) {
          showUiMessage(e instanceof Error ? e.message : 'Failed to join mess.', 'error');
        } finally {
          setIsSubmitting(false);
        }
      });
    },
    [authUser, service, showUiMessage]
  );

  const configureDeadlines = useCallback(
    async (
      lunchDeadline: string,
      nightDeadline: string,
      expectedVersion?: number | null
    ): Promise<boolean> => {
      if (!selectedMessId) return false;
      if (!isManager) {
        showUiMessage('Access Denied: Only Managers can configure deadlines.', 'error');
        return false;
      }
      const resolvedVersion =
        expectedVersion !== undefined
          ? expectedVersion
          : currentMess
            ? normalizeVersion(currentMess.version)
            : null;
      try {
        await service.updateBookingDeadlines(
          selectedMessId,
          lunchDeadline,
          nightDeadline,
          resolvedVersion
        );
        setConflictState(null);
        showUiMessage('Booking deadlines updated (Asia/Dhaka).');
        return true;
      } catch (e) {
        handleMutationError(e, 'Failed to update deadlines.');
        return false;
      }
    },
    [currentMess, handleMutationError, isManager, selectedMessId, service, showUiMessage]
  );

  // --- Meal Operations ---
  const updateMealServiceStatus = useCallback(
    async (
      date: string,
      lunchStatus: MealServiceStatus,
      nightStatus: MealServiceStatus,
      cancellationReason: string,
      expectedVersion?: number | null
    ): Promise<boolean> => {
      if (!selectedMessId) return false;
      if (!isManager) {
        showUiMessage('Access Denied: Only Managers can change meal service status.', 'error');
        return false;
      }
      const record = dailyMeals.find((r) => r.id === date || r.date === date);
      const resolvedVersion =
        expectedVersion !== undefined
          ? expectedVersion
          : record
            ? normalizeVersion(record.version)
            : null;
      try {
        await service.updateMealServiceStatus(
          selectedMessId,
          date,
          lunchStatus,
          nightStatus,
          cancellationReason,
          resolvedVersion
        );
        setConflictState(null);
        showUiMessage('Meal service status updated. Kitchen summary refreshed.');
        return true;
      } catch (e) {
        handleMutationError(e, 'Error updating service.');
        return false;
      }
    },
    [dailyMeals, handleMutationError, isManager, selectedMessId, service, showUiMessage]
  );

  const saveMyBooking = useCallback(
    async (
      date: string,
      statusLunch: 'BOOKED' | 'CANCELLED',
      statusNight: 'BOOKED' | 'CANCELLED',
      guestLunch: number,
      guestNight: number,
      expectedVersion?: number | null
    ): Promise<boolean> => {
      if (!selectedMessId || !authUser) return false;
      if (currentMember && !currentMember.isActive) {
        showUiMessage(
          'Your account is currently inactive. Meal bookings are disabled until a Manager reactivates your account.',
          'error'
        );
        return false;
      }
      const memberId = currentMember?.id || authUser.uid;
      const lunchCutoff = currentMess?.lunchBookingDeadline || '09:00';
      const nightCutoff = currentMess?.nightBookingDeadline || '17:00';
      const isFri = checkIsFriday(date);
      const lunchPassed = isDeadlinePassed(date, lunchCutoff);
      const nightPassed = isFri ? true : isDeadlinePassed(date, nightCutoff);

      const record = dailyMeals.find((r) => r.id === date || r.date === date);
      const resolvedVersion =
        expectedVersion !== undefined
          ? expectedVersion
          : record
            ? normalizeVersion(record.version)
            : null;
      const prevBooking = record?.bookings?.[memberId] ?? defaultBookingEntry();

      const effectiveLunch = lunchPassed ? prevBooking.statusLunch : statusLunch;
      const effectiveNight = isFri
        ? 'CANCELLED'
        : nightPassed
          ? prevBooking.statusNight
          : statusNight;
      const effectiveGuestLunch = lunchPassed
        ? prevBooking.guestLunch
        : Math.max(0, guestLunch);
      const effectiveGuestNight = isFri
        ? 0
        : nightPassed
          ? prevBooking.guestNight
          : Math.max(0, guestNight);

      if (lunchPassed && nightPassed) {
        showUiMessage(
          'Deadlines have passed. Bookings are locked. Contact Manager/Admin for overrides.',
          'error'
        );
        return false;
      }

      try {
        await service.saveMemberBooking({
          messId: selectedMessId,
          date,
          memberId,
          booking: {
            statusLunch: effectiveLunch,
            statusNight: effectiveNight,
            guestLunch: effectiveGuestLunch,
            guestNight: effectiveGuestNight,
            updatedBy: authUser.uid,
            managerOverrideReason: '',
            autoBooked: false,
          },
          lunchDeadline: lunchCutoff,
          nightDeadline: nightCutoff,
          isManager,
          expectedVersion: resolvedVersion,
        });
        setConflictState(null);
        showUiMessage(
          `Meal booking saved (${effectiveLunch === 'BOOKED' ? 'Lunch Booked' : 'Lunch Cancelled'} | ${effectiveNight === 'BOOKED' ? 'Night Booked' : 'Night Cancelled'}).`
        );
        return true;
      } catch (e) {
        handleMutationError(e, 'Booking failed.');
        return false;
      }
    },
    [
      authUser,
      currentMember,
      currentMess,
      dailyMeals,
      handleMutationError,
      isManager,
      selectedMessId,
      service,
      showUiMessage,
    ]
  );

  const setAutoBooking = useCallback(
    async (enabled: boolean, bookLunch = true, bookNight = true) => {
      if (!selectedMessId || !authUser) return;
      if (enabled && currentMember && !currentMember.isActive) {
        showUiMessage(
          'Your account is currently inactive. Auto-booking is disabled until a Manager reactivates your account.',
          'error'
        );
        return;
      }
      const memberId = currentMember?.id || authUser.uid;
      const effectiveLunchPref = enabled && !bookLunch && !bookNight ? true : bookLunch;
      const effectiveNightPref = bookNight;
      const lunchCutoff = currentMess?.lunchBookingDeadline || '09:00';
      const nightCutoff = currentMess?.nightBookingDeadline || '17:00';

      try {
        const updatedDate = enabled ? getDhakaDateTime() : '';
        await service.updateMemberAutoBookPreference({
          messId: selectedMessId,
          memberId,
          enabled,
          bookLunch: effectiveLunchPref,
          bookNight: effectiveNightPref,
          updatedDate,
        });

        if (enabled) {
          const targetDates = Array.from(new Set([todayDhakaDate, selectedDate])).filter(
            (d) => d >= todayDhakaDate
          );
          for (const d of targetDates) {
            const isFri = checkIsFriday(d);
            const record = dailyMeals.find((r) => r.id === d || r.date === d);
            const lunchActive = record?.lunchServiceStatus !== 'CANCELLED';
            const nightActive = isFri ? false : record?.nightServiceStatus !== 'CANCELLED';
            const lunchPassed = isDeadlinePassed(d, lunchCutoff);
            const nightPassed = isFri ? true : isDeadlinePassed(d, nightCutoff);
            const prev = record?.bookings?.[memberId] ?? defaultBookingEntry();

            const canAutoLunch =
              !lunchPassed && lunchActive && (prev.statusLunch === 'NO_RESPONSE' || prev.autoBooked);
            const canAutoNight =
              !nightPassed &&
              nightActive &&
              !isFri &&
              (prev.statusNight === 'NO_RESPONSE' || prev.autoBooked);

            if (!canAutoLunch && !canAutoNight) continue;

            const newLunch = canAutoLunch
              ? effectiveLunchPref
                ? 'BOOKED'
                : 'CANCELLED'
              : prev.statusLunch;
            const newNight = isFri
              ? 'CANCELLED'
              : canAutoNight
                ? effectiveNightPref
                  ? 'BOOKED'
                  : 'CANCELLED'
                : prev.statusNight;

            await service.saveMemberBooking({
              messId: selectedMessId,
              date: d,
              memberId,
              booking: {
                ...prev,
                statusLunch: newLunch,
                statusNight: newNight,
                updatedBy: authUser.uid,
                autoBooked: true,
              },
              lunchDeadline: lunchCutoff,
              nightDeadline: nightCutoff,
              isManager,
              expectedVersion: record ? normalizeVersion(record.version) : null,
            });
          }

          const scopeLabel =
            effectiveLunchPref && effectiveNightPref
              ? 'Lunch & Night'
              : effectiveLunchPref
                ? 'Lunch only'
                : 'Night only';
          setConflictState(null);
          showUiMessage(`Auto-booking turned ON (${scopeLabel}).`);
        } else {
          await service.clearAutoBookedEntries({
            messId: selectedMessId,
            memberId,
            todayDate: todayDhakaDate,
            records: dailyMeals,
            lunchDeadline: lunchCutoff,
            nightDeadline: nightCutoff,
          });
          setConflictState(null);
          showUiMessage('Auto-booking turned OFF. Please book your meals manually.');
        }
      } catch (e) {
        handleMutationError(e, 'Failed to update auto-booking.');
      }
    },
    [
      authUser,
      currentMember,
      currentMess,
      dailyMeals,
      handleMutationError,
      isManager,
      selectedDate,
      selectedMessId,
      service,
      showUiMessage,
      todayDhakaDate,
    ]
  );

  const managerOverrideBooking = useCallback(
    async ({
      date,
      memberId,
      memberName,
      statusLunch,
      statusNight,
      guestLunch,
      guestNight,
      reason,
      expectedVersion,
    }: {
      date: string;
      memberId: string;
      memberName: string;
      statusLunch: 'BOOKED' | 'CANCELLED';
      statusNight: 'BOOKED' | 'CANCELLED';
      guestLunch: number;
      guestNight: number;
      reason: string;
      expectedVersion?: number | null;
    }): Promise<boolean> => {
      if (!selectedMessId || !authUser) return false;
      if (!isManager) {
        showUiMessage('Access Denied: Only Managers can override locked bookings.', 'error');
        return false;
      }
      if (!reason.trim()) {
        showUiMessage('Please provide an override reason for audit history.', 'error');
        return false;
      }
      const record = dailyMeals.find((r) => r.id === date || r.date === date);
      const resolvedVersion =
        expectedVersion !== undefined
          ? expectedVersion
          : record
            ? normalizeVersion(record.version)
            : null;
      try {
        const booking: MealBookingEntry = {
          statusLunch,
          statusNight,
          guestLunch: Math.max(0, guestLunch),
          guestNight: Math.max(0, guestNight),
          updatedBy: authUser.uid,
          managerOverrideReason: reason.trim(),
          autoBooked: false,
        };
        await service.overrideMemberBooking({
          messId: selectedMessId,
          date,
          memberId,
          memberName,
          booking,
          reason: reason.trim(),
          expectedVersion: resolvedVersion,
        });
        setConflictState(null);
        showUiMessage('Manager booking override recorded in audit history.');
        return true;
      } catch (e) {
        handleMutationError(e, 'Override error.');
        return false;
      }
    },
    [authUser, dailyMeals, handleMutationError, isManager, selectedMessId, service, showUiMessage]
  );

  const saveFinalOrderSummary = useCallback(
    async (
      date: string,
      mealType: 'LUNCH' | 'NIGHT',
      expectedVersion?: number | null
    ): Promise<boolean> => {
      if (!selectedMessId) return false;
      if (!isManager) {
        showUiMessage('Access Denied: Only Managers can lock final kitchen orders.', 'error');
        return false;
      }
      const isLunch = mealType === 'LUNCH';
      const deadline = isLunch
        ? currentMess?.lunchBookingDeadline || '09:00'
        : currentMess?.nightBookingDeadline || '17:00';
      const record = dailyMeals.find((r) => r.id === date || r.date === date);
      const resolvedVersion =
        expectedVersion !== undefined
          ? expectedVersion
          : record
            ? normalizeVersion(record.version)
            : null;
      try {
        await service.saveFinalMealOrderSummary(
          selectedMessId,
          date,
          mealType,
          {
            mealType,
            date,
            totalPortions: isLunch
              ? kitchenSummary.lunchTotalPortions
              : kitchenSummary.nightTotalPortions,
            memberCount: isLunch
              ? kitchenSummary.lunchMemberCount
              : kitchenSummary.nightMemberCount,
            guestCount: isLunch
              ? kitchenSummary.lunchGuestCount
              : kitchenSummary.nightGuestCount,
            deadline,
            isLocked: true,
            lockedAtDhakaTime: format12Hour(deadline),
          },
          resolvedVersion
        );
        setConflictState(null);
        showUiMessage(`Final ${mealType.toLowerCase()} kitchen order saved & locked.`);
        return true;
      } catch (e) {
        handleMutationError(e, 'Failed to lock kitchen order.');
        return false;
      }
    },
    [
      currentMess,
      dailyMeals,
      handleMutationError,
      isManager,
      kitchenSummary,
      selectedMessId,
      service,
      showUiMessage,
    ]
  );

  const saveConfirmedAttendance = useCallback(
    async ({
      date,
      memberId,
      memberName,
      attendedLunch,
      attendedNight,
      guestLunchAttended,
      guestNightAttended,
      expectedVersion,
    }: {
      date: string;
      memberId: string;
      memberName: string;
      attendedLunch: boolean;
      attendedNight: boolean;
      guestLunchAttended: number;
      guestNightAttended: number;
      expectedVersion?: number | null;
    }): Promise<boolean> => {
      if (!selectedMessId) return false;
      if (!isManager) {
        showUiMessage('Access Denied: Only Managers can confirm attendance.', 'error');
        return false;
      }
      const rec = dailyMeals.find((r) => r.id === date || r.date === date);
      const resolvedVersion =
        expectedVersion !== undefined
          ? expectedVersion
          : rec
            ? normalizeVersion(rec.version)
            : null;
      const isFri = rec?.isFriday ?? checkIsFriday(date);
      const lunchStatus = rec?.lunchServiceStatus ?? 'ACTIVE';
      const nightStatus = isFri ? 'CANCELLED' : (rec?.nightServiceStatus ?? 'ACTIVE');
      const attendance = {
        attendedLunch: lunchStatus === 'ACTIVE' ? attendedLunch : false,
        attendedNight: !isFri && nightStatus === 'ACTIVE' ? attendedNight : false,
        guestLunchAttended: lunchStatus === 'ACTIVE' ? Math.max(0, guestLunchAttended) : 0,
        guestNightAttended: !isFri && nightStatus === 'ACTIVE' ? Math.max(0, guestNightAttended) : 0,
        calculatedUnits: 0,
      };
      attendance.calculatedUnits = calculateAttendanceUnits({
        isFriday: isFri,
        lunchServiceStatus: lunchStatus,
        nightServiceStatus: nightStatus,
        attendance,
      });

      try {
        await service.saveAttendance({
          messId: selectedMessId,
          date,
          memberId,
          memberName,
          attendance,
          isFriday: isFri,
          expectedVersion: resolvedVersion,
        });
        setConflictState(null);
        showUiMessage(`Confirmed attendance for ${memberName} (${attendance.calculatedUnits} units).`);
        return true;
      } catch (e) {
        handleMutationError(e, 'Failed to save attendance.');
        return false;
      }
    },
    [dailyMeals, handleMutationError, isManager, selectedMessId, service, showUiMessage]
  );

  // --- Bazaar ---
  const addBazaarExpense = useCallback(
    async (params: {
      buyerMemberId: string;
      buyerName: string;
      amount: number;
      itemsDescription: string;
      category: string;
      date: string;
    }): Promise<boolean> => {
      if (!selectedMessId) return false;
      const res = await mutationLockRef.current.run('addBazaarExpense', async () => {
        try {
          await service.addBazaarExpense(selectedMessId, params);
          setConflictState(null);
          showUiMessage('Bazaar expense logged.');
          return true;
        } catch (e) {
          handleMutationError(e, 'Failed to log bazaar expense.');
          return false;
        }
      });
      return Boolean(res.value);
    },
    [handleMutationError, selectedMessId, service, showUiMessage]
  );

  const updateBazaarExpense = useCallback(
    async (expense: BazaarExpense): Promise<boolean> => {
      if (!selectedMessId) return false;
      const res = await mutationLockRef.current.run(`updateBazaarExpense:${expense.id}`, async () => {
        try {
          await service.updateBazaarExpense(selectedMessId, expense);
          setConflictState(null);
          showUiMessage('Bazaar expense updated.');
          return true;
        } catch (e) {
          handleMutationError(e, 'Failed to update bazaar expense.');
          return false;
        }
      });
      return Boolean(res.value);
    },
    [handleMutationError, selectedMessId, service, showUiMessage]
  );

  const deleteBazaarExpense = useCallback(
    async (expenseId: string): Promise<boolean> => {
      if (!selectedMessId) return false;
      const res = await mutationLockRef.current.run(`deleteBazaarExpense:${expenseId}`, async () => {
        try {
          await service.deleteBazaarExpense(selectedMessId, expenseId);
          setConflictState(null);
          showUiMessage('Bazaar expense deleted.');
          return true;
        } catch (e) {
          handleMutationError(e, 'Failed to delete expense.');
          return false;
        }
      });
      return Boolean(res.value);
    },
    [handleMutationError, selectedMessId, service, showUiMessage]
  );

  // --- Deposits ---
  const addDeposit = useCallback(
    async (params: {
      memberId: string;
      memberName: string;
      amount: number;
      paymentMethod: string;
      notes: string;
      date: string;
    }): Promise<boolean> => {
      if (!selectedMessId || !authUser) return false;
      if (!isManager) {
        showUiMessage('Access Denied: Only Managers can add deposits.', 'error');
        return false;
      }
      const res = await mutationLockRef.current.run('addDeposit', async () => {
        try {
          await service.addDeposit(selectedMessId, {
            ...params,
            recordedBy: authUser.uid,
          });
          setConflictState(null);
          showUiMessage('Deposit recorded.');
          return true;
        } catch (e) {
          handleMutationError(e, 'Failed to add deposit.');
          return false;
        }
      });
      return Boolean(res.value);
    },
    [authUser, handleMutationError, isManager, selectedMessId, service, showUiMessage]
  );

  const updateDeposit = useCallback(
    async (deposit: Deposit): Promise<boolean> => {
      if (!selectedMessId) return false;
      if (!isManager) {
        showUiMessage('Access Denied: Only Managers can edit deposits.', 'error');
        return false;
      }
      const res = await mutationLockRef.current.run(`updateDeposit:${deposit.id}`, async () => {
        try {
          await service.updateDeposit(selectedMessId, deposit);
          setConflictState(null);
          showUiMessage('Deposit updated.');
          return true;
        } catch (e) {
          handleMutationError(e, 'Failed to update deposit.');
          return false;
        }
      });
      return Boolean(res.value);
    },
    [handleMutationError, isManager, selectedMessId, service, showUiMessage]
  );

  const deleteDeposit = useCallback(
    async (deposit: Deposit): Promise<boolean> => {
      if (!selectedMessId) return false;
      if (!isManager) {
        showUiMessage('Access Denied: Only Managers can delete deposits.', 'error');
        return false;
      }
      const res = await mutationLockRef.current.run(`deleteDeposit:${deposit.id}`, async () => {
        try {
          await service.deleteDeposit(selectedMessId, deposit);
          setConflictState(null);
          showUiMessage('Deposit removed.');
          return true;
        } catch (e) {
          handleMutationError(e, 'Failed to delete deposit.');
          return false;
        }
      });
      return Boolean(res.value);
    },
    [handleMutationError, isManager, selectedMessId, service, showUiMessage]
  );

  // --- Utility Bills ---
  const addUtilityBill = useCallback(
    async (title: string, amount: number): Promise<boolean> => {
      if (!selectedMessId) return false;
      if (!isManager) {
        showUiMessage('Access Denied: Only Managers can add utility bills.', 'error');
        return false;
      }
      const res = await mutationLockRef.current.run('addUtilityBill', async () => {
        try {
          await service.addUtilityBill(selectedMessId, {
            title: title.trim(),
            amount,
            month: currentMess?.activeMonth || getCurrentDhakaMonth(),
          });
          setConflictState(null);
          showUiMessage('Utility bill added.');
          return true;
        } catch (e) {
          handleMutationError(e, 'Failed to add utility bill.');
          return false;
        }
      });
      return Boolean(res.value);
    },
    [currentMess, handleMutationError, isManager, selectedMessId, service, showUiMessage]
  );

  const updateUtilityBill = useCallback(
    async (bill: UtilityBill): Promise<boolean> => {
      if (!selectedMessId) return false;
      if (!isManager) {
        showUiMessage('Access Denied: Only Managers can edit utility bills.', 'error');
        return false;
      }
      const res = await mutationLockRef.current.run(`updateUtilityBill:${bill.id}`, async () => {
        try {
          await service.updateUtilityBill(selectedMessId, bill);
          setConflictState(null);
          showUiMessage('Utility bill updated.');
          return true;
        } catch (e) {
          handleMutationError(e, 'Failed to update utility bill.');
          return false;
        }
      });
      return Boolean(res.value);
    },
    [handleMutationError, isManager, selectedMessId, service, showUiMessage]
  );

  const deleteUtilityBill = useCallback(
    async (bill: UtilityBill): Promise<boolean> => {
      if (!selectedMessId) return false;
      if (!isManager) {
        showUiMessage('Access Denied: Only Managers can delete utility bills.', 'error');
        return false;
      }
      const res = await mutationLockRef.current.run(`deleteUtilityBill:${bill.id}`, async () => {
        try {
          await service.deleteUtilityBill(selectedMessId, bill.id, bill.title, bill.amount);
          setConflictState(null);
          showUiMessage('Utility bill removed.');
          return true;
        } catch (e) {
          handleMutationError(e, 'Failed to delete utility bill.');
          return false;
        }
      });
      return Boolean(res.value);
    },
    [handleMutationError, isManager, selectedMessId, service, showUiMessage]
  );

  // --- Shared Bills ---
  const createSharedBill = useCallback(
    async ({
      title,
      allocationType,
      amountInput,
      deadline,
      notes,
      customShares = {},
    }: {
      title: string;
      allocationType: BillAllocationTypeValue;
      amountInput: number;
      deadline: string;
      notes: string;
      customShares?: Record<string, number>;
    }): Promise<boolean> => {
      if (!selectedMessId) return false;
      if (!isManager) {
        showUiMessage('Access Denied: Only Managers can create shared bills.', 'error');
        return false;
      }
      const activeMembers = members.filter((m) => m.isActive);
      if (activeMembers.length === 0) {
        showUiMessage('Cannot create bill: No active members found.', 'error');
        return false;
      }
      const res = await mutationLockRef.current.run('createSharedBill', async () => {
        try {
          await service.createSharedBill({
            messId: selectedMessId,
            title,
            allocationType,
            amountInput,
            month: currentMess?.activeMonth || getCurrentDhakaMonth(),
            deadline,
            notes,
            activeMembers,
            customShares,
          });
          setConflictState(null);
          showUiMessage(
            `Shared bill '${title}' published. Notifications sent to ${activeMembers.length} members.`
          );
          return true;
        } catch (e) {
          handleMutationError(e, 'Failed to create shared bill.');
          return false;
        }
      });
      return Boolean(res.value);
    },
    [currentMess, handleMutationError, isManager, members, selectedMessId, service, showUiMessage]
  );

  const updateSharedBill = useCallback(
    async (bill: SharedBill, updatedShares?: Record<string, number>): Promise<boolean> => {
      if (!selectedMessId) return false;
      if (!isManager) {
        showUiMessage('Access Denied: Only Managers can edit shared bills.', 'error');
        return false;
      }
      const res = await mutationLockRef.current.run(`updateSharedBill:${bill.id}`, async () => {
        try {
          await service.updateSharedBill(selectedMessId, bill, updatedShares);
          setConflictState(null);
          showUiMessage('Shared bill updated.');
          return true;
        } catch (e) {
          handleMutationError(e, 'Failed to update bill.');
          return false;
        }
      });
      return Boolean(res.value);
    },
    [handleMutationError, isManager, selectedMessId, service, showUiMessage]
  );

  const deleteSharedBill = useCallback(
    async (bill: SharedBill): Promise<boolean> => {
      if (!selectedMessId) return false;
      if (!isManager) {
        showUiMessage('Access Denied: Only Managers can delete shared bills.', 'error');
        return false;
      }
      const res = await mutationLockRef.current.run(`deleteSharedBill:${bill.id}`, async () => {
        try {
          await service.deleteSharedBill(
            selectedMessId,
            bill.id,
            bill.title,
            bill.totalAmount,
            normalizeVersion(bill.version)
          );
          setConflictState(null);
          showUiMessage(`Shared bill '${bill.title}' removed.`);
          return true;
        } catch (e) {
          handleMutationError(e, 'Failed to delete bill.');
          return false;
        }
      });
      return Boolean(res.value);
    },
    [handleMutationError, isManager, selectedMessId, service, showUiMessage]
  );

  const recordBillPayment = useCallback(
    async (params: {
      billId: string;
      memberId: string;
      memberName: string;
      assignedShare: number;
      amountPaid: number;
      paymentMethod: string;
      paymentDate: string;
      notes: string;
      expectedVersion?: number | null;
    }): Promise<boolean> => {
      if (!selectedMessId) return false;
      if (!isManager) {
        showUiMessage('Access Denied: Only Managers can record payments.', 'error');
        return false;
      }
      const targetBill = sharedBills.find((b) => b.id === params.billId);
      const resolvedVersion =
        params.expectedVersion !== undefined
          ? params.expectedVersion
          : targetBill
            ? normalizeVersion(targetBill.version)
            : null;
      const res = await mutationLockRef.current.run(
        `recordBillPayment:${params.billId}:${params.memberId}`,
        async () => {
          try {
            await service.recordBillPayment({
              messId: selectedMessId,
              ...params,
              expectedVersion: resolvedVersion,
            });
            setConflictState(null);
            const statusText =
              params.amountPaid >= params.assignedShare && params.assignedShare > 0
                ? 'Paid in full'
                : params.amountPaid > 0
                  ? `Partially paid (৳${params.amountPaid})`
                  : 'Marked as unpaid';
            showUiMessage(`Payment recorded for ${params.memberName}: ${statusText}.`);
            return true;
          } catch (e) {
            handleMutationError(e, 'Failed to record payment.');
            return false;
          }
        }
      );
      return Boolean(res.value);
    },
    [handleMutationError, isManager, selectedMessId, service, sharedBills, showUiMessage]
  );

  // --- Member Roles & Status ---
  const updateMemberStatus = useCallback(
    async (memberId: string, isActive: boolean) => {
      if (!selectedMessId) return;
      if (!isManager) {
        showUiMessage('Access Denied: Only Managers can update member status.', 'error');
        return;
      }
      try {
        await service.updateMemberStatus(selectedMessId, memberId, isActive, {
          todayDate: todayDhakaDate,
          lunchDeadline: currentMess?.lunchBookingDeadline || '09:00',
          nightDeadline: currentMess?.nightBookingDeadline || '17:00',
        });
        showUiMessage(
          isActive
            ? 'Member marked as Active.'
            : 'Member marked as Inactive. Auto-booking disabled and unlocked future bookings cancelled.'
        );
      } catch (e) {
        showUiMessage(e instanceof Error ? e.message : 'Failed to update member.', 'error');
      }
    },
    [currentMess, isManager, selectedMessId, service, showUiMessage, todayDhakaDate]
  );

  const promoteMemberToManager = useCallback(
    async (targetMember: Member) => {
      if (!selectedMessId) return;
      if (!isManager) {
        showUiMessage('Access Denied: Only Managers can promote members.', 'error');
        return;
      }
      try {
        await service.promoteMemberToManager(selectedMessId, targetMember);
        showUiMessage(`${targetMember.displayName} is now a Manager.`);
      } catch (e) {
        showUiMessage(e instanceof Error ? e.message : 'Failed to promote member.', 'error');
      }
    },
    [isManager, selectedMessId, service, showUiMessage]
  );

  const demoteManagerToMember = useCallback(
    async (targetMember: Member) => {
      if (!selectedMessId) return;
      if (!isManager) {
        showUiMessage('Access Denied: Only Managers can demote managers.', 'error');
        return;
      }
      try {
        await service.demoteManagerToMember(selectedMessId, targetMember);
        showUiMessage(`${targetMember.displayName}'s role updated to Member.`);
      } catch (e) {
        showUiMessage(e instanceof Error ? e.message : 'Failed to update role.', 'error');
      }
    },
    [isManager, selectedMessId, service, showUiMessage]
  );

  const resignAsManager = useCallback(
    async (successor?: Member | null) => {
      if (!selectedMessId || !authUser) return;
      if (!isManager) {
        showUiMessage('You are not a Manager.', 'error');
        return;
      }
      const memberId = currentMember?.id || authUser.uid;
      try {
        await service.resignAsManager(selectedMessId, memberId, successor);
        showUiMessage(
          successor
            ? `Resigned as Manager. Handed over to ${successor.displayName}.`
            : 'You have stepped down from Manager role.'
        );
      } catch (e) {
        showUiMessage(e instanceof Error ? e.message : 'Resignation failed.', 'error');
      }
    },
    [authUser, currentMember, isManager, selectedMessId, service, showUiMessage]
  );

  const markNotificationAsRead = useCallback(
    async (notificationId: string) => {
      if (!selectedMessId) return;
      await service.markNotificationAsRead(selectedMessId, notificationId).catch(() => {});
    },
    [selectedMessId, service]
  );

  const markAllNotificationsAsRead = useCallback(async () => {
    if (!selectedMessId) return;
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await service.markAllNotificationsAsRead(selectedMessId, unreadIds).catch(() => {});
    showUiMessage('All notifications marked as read.');
  }, [notifications, selectedMessId, service, showUiMessage]);

  const value: MessContextValue = {
    authMode,
    authUser,
    isDemoMode: authMode === 'demo',
    userProfile,
    userMesses,
    selectedMessId,
    currentMess,
    members,
    dailyMeals,
    bazaarExpenses,
    deposits,
    utilityBills,
    sharedBills,
    notifications,
    unreadNotificationsCount,
    auditLogs,
    selectedDate,
    todayDhakaDate,
    isManager,
    currentMember,
    summary,
    kitchenSummary,
    uiMessage,
    conflictState,
    syncRevision,
    isSubmitting,
    activeNav,
    isWalkthroughOpen,
    walkthroughRunId,

    setActiveNav,
    setSelectedDate,
    clearUiMessage,
    showUiMessage,
    clearConflict,
    reloadLatestData,
    openWalkthrough,
    closeWalkthrough,
    signInWithGoogle,
    enterDemoMode,
    resetDemoWorkspace,
    signOut,
    selectMess,
    createMess,
    joinMess,
    configureDeadlines,
    updateMealServiceStatus,
    saveMyBooking,
    setAutoBooking,
    managerOverrideBooking,
    saveFinalOrderSummary,
    saveConfirmedAttendance,
    addBazaarExpense,
    updateBazaarExpense,
    deleteBazaarExpense,
    addDeposit,
    updateDeposit,
    deleteDeposit,
    addUtilityBill,
    updateUtilityBill,
    deleteUtilityBill,
    createSharedBill,
    updateSharedBill,
    deleteSharedBill,
    recordBillPayment,
    updateMemberStatus,
    promoteMemberToManager,
    demoteManagerToMember,
    resignAsManager,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  };

  return <MessContext.Provider value={value}>{children}</MessContext.Provider>;
}

export function useMess() {
  const ctx = useContext(MessContext);
  if (!ctx) throw new Error('useMess must be used within MessProvider');
  return ctx;
}
