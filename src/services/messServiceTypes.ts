import {
  AuditLog,
  BazaarExpense,
  BillAllocationTypeValue,
  DailyMealRecord,
  Deposit,
  FinalOrderSummary,
  InAppNotification,
  MealAttendanceEntry,
  MealBookingEntry,
  MealServiceStatus,
  Member,
  Mess,
  SharedBill,
  UserProfile,
  UtilityBill,
} from '../types/mess';

export interface MessObservers {
  onMess?: (mess: Mess | null) => void;
  onMembers?: (members: Member[]) => void;
  onDailyMeals?: (records: DailyMealRecord[]) => void;
  onBazaarExpenses?: (expenses: BazaarExpense[]) => void;
  onDeposits?: (deposits: Deposit[]) => void;
  onUtilityBills?: (bills: UtilityBill[]) => void;
  onSharedBills?: (bills: SharedBill[]) => void;
  onNotifications?: (notifications: InAppNotification[]) => void;
  onAuditLogs?: (logs: AuditLog[]) => void;
  onError?: (err: Error) => void;
}

export interface IMessDataService {
  observeUserProfile(
    userId: string,
    onData: (profile: UserProfile | null) => void,
    onError: (err: Error) => void
  ): () => void;

  observeUserMesses(
    userId: string,
    onData: (messes: Mess[]) => void,
    onError: (err: Error) => void
  ): () => void;

  observeMessBundle(
    messId: string,
    currentUserId: string,
    observers: MessObservers
  ): () => void;

  refreshMessData(
    messId: string,
    currentUserId: string,
    observers: MessObservers
  ): Promise<void>;

  saveUserProfile(profile: Partial<UserProfile> & { id: string }): Promise<void>;

  createMess(name: string, managerName: string, defaultMonth: string): Promise<string>;
  joinMess(messId: string, memberName: string, room: string): Promise<void>;
  updateBookingDeadlines(
    messId: string,
    lunchDeadline: string,
    nightDeadline: string,
    expectedVersion?: number | null
  ): Promise<void>;

  promoteMemberToManager(messId: string, targetMember: Member): Promise<void>;
  demoteManagerToMember(messId: string, targetMember: Member): Promise<void>;
  resignAsManager(messId: string, currentMemberId: string, successor?: Member | null): Promise<void>;
  updateMemberStatus(messId: string, memberId: string, isActive: boolean): Promise<void>;

  updateMealServiceStatus(
    messId: string,
    date: string,
    lunchStatus: MealServiceStatus,
    nightStatus: MealServiceStatus,
    cancellationReason: string,
    expectedVersion: number | null
  ): Promise<void>;

  saveMemberBooking(params: {
    messId: string;
    date: string;
    memberId: string;
    booking: MealBookingEntry;
    lunchDeadline: string;
    nightDeadline: string;
    isManager: boolean;
    expectedVersion: number | null;
  }): Promise<void>;

  updateMemberAutoBookPreference(params: {
    messId: string;
    memberId: string;
    enabled: boolean;
    bookLunch: boolean;
    bookNight: boolean;
    updatedDate: string;
  }): Promise<void>;

  clearAutoBookedEntries(params: {
    messId: string;
    memberId: string;
    todayDate: string;
    records: DailyMealRecord[];
    lunchDeadline: string;
    nightDeadline: string;
  }): Promise<void>;

  saveFinalMealOrderSummary(
    messId: string,
    date: string,
    mealType: 'LUNCH' | 'NIGHT',
    summary: FinalOrderSummary,
    expectedVersion: number | null
  ): Promise<void>;

  overrideMemberBooking(params: {
    messId: string;
    date: string;
    memberId: string;
    memberName: string;
    booking: MealBookingEntry;
    reason: string;
    expectedVersion: number | null;
  }): Promise<void>;

  saveAttendance(params: {
    messId: string;
    date: string;
    memberId: string;
    memberName: string;
    attendance: MealAttendanceEntry;
    isFriday: boolean;
    expectedVersion: number | null;
  }): Promise<void>;

  addBazaarExpense(messId: string, expense: Omit<BazaarExpense, 'id'>): Promise<void>;
  updateBazaarExpense(messId: string, expense: BazaarExpense): Promise<void>;
  deleteBazaarExpense(messId: string, expenseId: string): Promise<void>;

  addDeposit(messId: string, deposit: Omit<Deposit, 'id'>): Promise<void>;
  updateDeposit(messId: string, deposit: Deposit): Promise<void>;
  deleteDeposit(messId: string, deposit: Deposit): Promise<void>;

  addUtilityBill(messId: string, bill: Omit<UtilityBill, 'id'>): Promise<void>;
  updateUtilityBill(messId: string, bill: UtilityBill): Promise<void>;
  deleteUtilityBill(messId: string, billId: string, title: string, amount: number): Promise<void>;

  createSharedBill(params: {
    messId: string;
    title: string;
    allocationType: BillAllocationTypeValue;
    amountInput: number;
    month: string;
    deadline: string;
    notes: string;
    activeMembers: Member[];
    customShares: Record<string, number>;
  }): Promise<string>;

  updateSharedBill(
    messId: string,
    bill: SharedBill,
    updatedShares?: Record<string, number>
  ): Promise<void>;

  deleteSharedBill(
    messId: string,
    billId: string,
    billTitle: string,
    totalAmount: number,
    expectedVersion?: number | null
  ): Promise<void>;

  recordBillPayment(params: {
    messId: string;
    billId: string;
    memberId: string;
    memberName: string;
    assignedShare: number;
    amountPaid: number;
    paymentMethod: string;
    paymentDate: string;
    notes: string;
    expectedVersion: number | null;
  }): Promise<void>;

  markNotificationAsRead(messId: string, notificationId: string): Promise<void>;
  markAllNotificationsAsRead(messId: string, notificationIds: string[]): Promise<void>;
}
