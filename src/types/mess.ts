export type MemberRole = 'MANAGER' | 'MEMBER';
export type MealBookingStatus = 'NO_RESPONSE' | 'BOOKED' | 'CANCELLED';
export type MealServiceStatus = 'ACTIVE' | 'CANCELLED';
export type MealType = 'LUNCH' | 'NIGHT';

export const BillAllocationType = {
  FIXED_PER_MEMBER: 'FIXED_PER_MEMBER',
  DIVIDED_EQUALLY: 'DIVIDED_EQUALLY',
  CUSTOM_PER_MEMBER: 'CUSTOM_PER_MEMBER',
} as const;

export type BillAllocationTypeValue =
  (typeof BillAllocationType)[keyof typeof BillAllocationType];

export const BillPaymentStatus = {
  UNPAID: 'UNPAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
} as const;

export type BillPaymentStatusValue =
  (typeof BillPaymentStatus)[keyof typeof BillPaymentStatus];

export const BAZAAR_CATEGORIES = [
  'Groceries',
  'Meat & Fish',
  'Vegetables',
  'Spices',
  'Misc',
] as const;

export const PAYMENT_METHODS = ['Cash', 'bKash/Nagad', 'Bank', 'UPI'] as const;

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  currentMessId: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Mess {
  id: string;
  name: string;
  managerUid: string;
  adminUids: string[];
  memberUids: string[];
  activeMonth: string; // YYYY-MM
  lunchBookingDeadline: string; // HH:mm 24h Asia/Dhaka
  nightBookingDeadline: string; // HH:mm 24h Asia/Dhaka
  version?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface Member {
  id: string;
  userId: string;
  displayName: string;
  room: string;
  role: MemberRole;
  isActive: boolean;
  autoBookEnabled: boolean;
  autoBookLunch: boolean;
  autoBookNight: boolean;
  autoBookUpdatedAt: string; // YYYY-MM-DD
  createdAt?: number;
}

export interface MealBookingEntry {
  statusLunch: MealBookingStatus;
  statusNight: MealBookingStatus;
  guestLunch: number;
  guestNight: number;
  updatedBy: string;
  managerOverrideReason: string;
  autoBooked: boolean;
}

export interface MealAttendanceEntry {
  attendedLunch: boolean;
  attendedNight: boolean;
  guestLunchAttended: number;
  guestNightAttended: number;
  calculatedUnits: number;
}

export interface FinalOrderSummary {
  mealType: MealType;
  date: string;
  totalPortions: number;
  memberCount: number;
  guestCount: number;
  deadline: string;
  isLocked: boolean;
  lockedAtDhakaTime: string;
  savedAt?: number;
}

export interface DailyMealRecord {
  id: string; // YYYY-MM-DD
  date: string;
  isFriday: boolean;
  lunchServiceStatus: MealServiceStatus;
  nightServiceStatus: MealServiceStatus;
  cancellationReason: string;
  bookings: Record<string, MealBookingEntry>;
  attendances: Record<string, MealAttendanceEntry>;
  lunchFinalOrder?: FinalOrderSummary | null;
  nightFinalOrder?: FinalOrderSummary | null;
  totalDayUnits: number;
  totalDayMeals: number;
  version?: number;
  updatedBy: string;
  updatedAt?: number;
}

export interface AuditLog {
  id: string;
  action: string;
  performedByUid: string;
  performedByName: string;
  targetMemberId: string;
  targetMemberName: string;
  details: string;
  reason: string;
  timestampMs?: number;
}

export interface BazaarExpense {
  id: string;
  buyerMemberId: string;
  buyerName: string;
  amount: number;
  itemsDescription: string;
  category: string;
  date: string; // YYYY-MM-DD
  version?: number;
  createdAt?: number;
}

export interface Deposit {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  date: string; // YYYY-MM-DD
  paymentMethod: string;
  notes: string;
  recordedBy: string;
  version?: number;
  createdAt?: number;
}

export interface UtilityBill {
  id: string;
  title: string;
  amount: number;
  month: string; // YYYY-MM
  version?: number;
  createdAt?: number;
}

export interface BillPaymentRecord {
  memberId: string;
  memberName: string;
  amountPaid: number;
  status: BillPaymentStatusValue;
  paymentDate: string;
  paymentMethod: string;
  notes: string;
  recordedByUid: string;
  recordedByName: string;
  updatedAt?: number;
}

export interface SharedBill {
  id: string;
  title: string;
  allocationType: BillAllocationTypeValue;
  totalAmount: number;
  perMemberAmount: number;
  month: string;
  deadline: string; // YYYY-MM-DD
  notes: string;
  assignedMemberIds: string[];
  memberShares: Record<string, number>;
  memberNames: Record<string, string>;
  payments: Record<string, BillPaymentRecord>;
  createdByUid: string;
  createdByName: string;
  version?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface InAppNotification {
  id: string;
  messId: string;
  targetMemberId: string;
  targetMemberName: string;
  title: string;
  message: string;
  billId: string;
  amount: number;
  deadline: string;
  isRead: boolean;
  createdAt?: number;
}

export interface MemberSettlement {
  memberId: string;
  memberName: string;
  totalUnits: number;
  memberUnits: number;
  guestUnits: number;
  mealCost: number;
  utilityCost: number;
  sharedBillsUnpaid: number;
  sharedBillsPaid: number;
  totalCost: number;
  totalDeposit: number;
  netBalance: number;
}

export interface MessSummary {
  totalUnits: number;
  totalBazaarCost: number;
  mealRate: number;
  totalDeposits: number;
  totalUtilities: number;
  totalSharedBills: number;
  totalSharedBillsCollected: number;
  totalSharedBillsUnpaid: number;
  remainingFund: number;
  memberSettlements: MemberSettlement[];
}

export interface KitchenOrderSummary {
  lunchTotalPortions: number;
  lunchMemberCount: number;
  lunchGuestCount: number;
  nightTotalPortions: number;
  nightMemberCount: number;
  nightGuestCount: number;
  attendedLunchCount: number;
  attendedNightCount: number;
  lunchActive: boolean;
  nightActive: boolean;
  isFriday: boolean;
  cancellationReason: string;
  isLunchLocked: boolean;
  isNightLocked: boolean;
  lunchFinalOrder?: FinalOrderSummary | null;
  nightFinalOrder?: FinalOrderSummary | null;
}

export function isMessManagerRole(mess: Mess | null, userId: string): boolean {
  if (!mess || !userId) return false;
  return mess.managerUid === userId || (mess.adminUids ?? []).includes(userId);
}

export function defaultBookingEntry(): MealBookingEntry {
  return {
    statusLunch: 'NO_RESPONSE',
    statusNight: 'NO_RESPONSE',
    guestLunch: 0,
    guestNight: 0,
    updatedBy: '',
    managerOverrideReason: '',
    autoBooked: false,
  };
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + (value >= 0 ? 1e-9 : -1e-9)) * 100) / 100;
}

export function getMemberShare(bill: SharedBill, memberId: string): number {
  if (bill.assignedMemberIds.length > 0 && !bill.assignedMemberIds.includes(memberId)) {
    return 0;
  }
  return roundMoney(bill.memberShares[memberId] ?? bill.perMemberAmount);
}

export function getMemberPaid(bill: SharedBill, memberId: string): number {
  return roundMoney(bill.payments[memberId]?.amountPaid ?? 0);
}

export function getMemberDue(bill: SharedBill, memberId: string): number {
  return roundMoney(Math.max(0, getMemberShare(bill, memberId) - getMemberPaid(bill, memberId)));
}

export function getMemberPaymentStatus(
  bill: SharedBill,
  memberId: string
): BillPaymentStatusValue {
  const share = getMemberShare(bill, memberId);
  const paid = getMemberPaid(bill, memberId);
  if (share <= 0) return BillPaymentStatus.PAID;
  if (paid >= share) return BillPaymentStatus.PAID;
  if (paid > 0) return BillPaymentStatus.PARTIALLY_PAID;
  return BillPaymentStatus.UNPAID;
}

export function getSharedBillStats(bill: SharedBill) {
  const totalCollected = roundMoney(
    Object.values(bill.payments).reduce(
      (sum, record) => sum + (record.amountPaid || 0),
      0
    )
  );
  const outstandingBalance = roundMoney(Math.max(0, roundMoney(bill.totalAmount) - totalCollected));
  let paidMembersCount = 0;
  let partiallyPaidMembersCount = 0;
  let unpaidMembersCount = 0;

  for (const id of bill.assignedMemberIds) {
    const status = getMemberPaymentStatus(bill, id);
    if (status === BillPaymentStatus.PAID) paidMembersCount += 1;
    else if (status === BillPaymentStatus.PARTIALLY_PAID) partiallyPaidMembersCount += 1;
    else unpaidMembersCount += 1;
  }

  return {
    totalCollected,
    outstandingBalance,
    paidMembersCount,
    partiallyPaidMembersCount,
    unpaidMembersCount,
  };
}
