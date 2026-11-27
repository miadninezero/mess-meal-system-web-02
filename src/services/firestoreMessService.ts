import {
  Timestamp,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocsFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { OperationType, handleFirestoreError } from '../firebase/errors';
import {
  AuditLog,
  BazaarExpense,
  BillAllocationType,
  BillAllocationTypeValue,
  BillPaymentStatus,
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
import { isDeadlinePassed, isFriday as checkIsFriday } from '../utils/dhakaTime';
import { roundTwoDecimals } from '../utils/messCalculations';
import {
  assertAndNextVersion,
  isConcurrencyConflictError,
  normalizeVersion,
} from '../utils/optimisticConcurrency';
import { IMessDataService, MessObservers } from './messServiceTypes';

function toMillis(val: unknown): number | undefined {
  if (!val) return undefined;
  if (typeof val === 'number') return val;
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof (val as { toMillis?: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return undefined;
}

function requireUser() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be signed in with Google before accessing Firestore.');
  }
  return user;
}

async function recordAuditLog(
  messId: string,
  entry: {
    action: string;
    performedByUid: string;
    performedByName: string;
    targetMemberId?: string;
    targetMemberName?: string;
    details: string;
    reason?: string;
  }
) {
  const ref = doc(collection(db, 'messes', messId, 'audit_logs'));
  try {
    await setDoc(ref, {
      action: entry.action.slice(0, 80),
      performedByUid: entry.performedByUid,
      performedByName: (entry.performedByName || 'User').slice(0, 120),
      targetMemberId: (entry.targetMemberId || '').slice(0, 128),
      targetMemberName: (entry.targetMemberName || '').slice(0, 120),
      details: entry.details.slice(0, 600),
      reason: (entry.reason || '').slice(0, 300),
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    console.warn('Audit log write failure:', e);
  }
}

export const firestoreMessService: IMessDataService = {
  observeUserProfile(userId, onData, onError) {
    const path = `users/${userId}`;
    const ref = doc(db, 'users', userId);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          onData(null);
          return;
        }
        const d = snap.data();
        onData({
          id: snap.id,
          displayName: d.displayName ?? '',
          email: d.email ?? '',
          currentMessId: d.currentMessId ?? '',
          createdAt: toMillis(d.createdAt),
          updatedAt: toMillis(d.updatedAt),
        });
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, path);
        } catch (err) {
          onError(err as Error);
        }
      }
    );
  },

  observeUserMesses(userId, onData, onError) {
    const path = 'messes';
    const q = query(collection(db, 'messes'), where('memberUids', 'array-contains', userId));
    return onSnapshot(
      q,
      (snap) => {
        const list: Mess[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            name: d.name ?? '',
            managerUid: d.managerUid ?? '',
            adminUids: Array.isArray(d.adminUids) ? d.adminUids : [],
            memberUids: Array.isArray(d.memberUids) ? d.memberUids : [],
            activeMonth: d.activeMonth ?? '',
            lunchBookingDeadline: d.lunchBookingDeadline ?? '09:00',
            nightBookingDeadline: d.nightBookingDeadline ?? '17:00',
            version: normalizeVersion(d.version),
            createdAt: toMillis(d.createdAt),
            updatedAt: toMillis(d.updatedAt),
          };
        });
        onData(list);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, path);
        } catch (err) {
          onError(err as Error);
        }
      }
    );
  },

  observeMessBundle(messId, currentUserId, observers: MessObservers) {
    if (!messId) return () => {};

    const unsubs: (() => void)[] = [];
    const forwardErr = (err: unknown, op: OperationType, path: string) => {
      try {
        handleFirestoreError(err, op, path);
      } catch (wrapped) {
        observers.onError?.(wrapped as Error);
      }
    };

    // Mess doc
    unsubs.push(
      onSnapshot(
        doc(db, 'messes', messId),
        (snap) => {
          if (!snap.exists()) {
            observers.onMess?.(null);
            return;
          }
          const d = snap.data();
          observers.onMess?.({
            id: snap.id,
            name: d.name ?? '',
            managerUid: d.managerUid ?? '',
            adminUids: Array.isArray(d.adminUids) ? d.adminUids : [],
            memberUids: Array.isArray(d.memberUids) ? d.memberUids : [],
            activeMonth: d.activeMonth ?? '',
            lunchBookingDeadline: d.lunchBookingDeadline ?? '09:00',
            nightBookingDeadline: d.nightBookingDeadline ?? '17:00',
            version: normalizeVersion(d.version),
            createdAt: toMillis(d.createdAt),
            updatedAt: toMillis(d.updatedAt),
          });
        },
        (e) => forwardErr(e, OperationType.GET, `messes/${messId}`)
      )
    );

    // Members
    let latestMembers: Member[] = [];
    let latestRawNotifications: InAppNotification[] = [];

    const emitFilteredNotifications = () => {
      const currentMember = latestMembers.find((m) => m.userId === currentUserId);
      const memberId = currentMember?.id || currentUserId;
      const filtered = latestRawNotifications.filter(
        (n) =>
          n.targetMemberId === memberId ||
          n.targetMemberId === currentUserId ||
          n.targetMemberId === 'ALL' ||
          !n.targetMemberId
      );
      observers.onNotifications?.(filtered);
    };

    unsubs.push(
      onSnapshot(
        collection(db, 'messes', messId, 'members'),
        (snap) => {
          latestMembers = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              userId: d.userId ?? '',
              displayName: d.displayName ?? '',
              room: d.room ?? '',
              role: d.role === 'MANAGER' ? 'MANAGER' : 'MEMBER',
              isActive: d.isActive !== false,
              autoBookEnabled: Boolean(d.autoBookEnabled),
              autoBookLunch: d.autoBookLunch !== false,
              autoBookNight: d.autoBookNight !== false,
              autoBookUpdatedAt: d.autoBookUpdatedAt ?? '',
              createdAt: toMillis(d.createdAt),
            };
          });
          observers.onMembers?.(latestMembers);
          emitFilteredNotifications();
        },
        (e) => forwardErr(e, OperationType.LIST, `messes/${messId}/members`)
      )
    );

    // Daily meals
    unsubs.push(
      onSnapshot(
        collection(db, 'messes', messId, 'daily_meals'),
        (snap) => {
          const list: DailyMealRecord[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              date: d.date ?? docSnap.id,
              isFriday: Boolean(d.isFriday),
              lunchServiceStatus: d.lunchServiceStatus === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE',
              nightServiceStatus: d.nightServiceStatus === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE',
              cancellationReason: d.cancellationReason ?? '',
              bookings: d.bookings ?? {},
              attendances: d.attendances ?? {},
              lunchFinalOrder: d.lunchFinalOrder ?? null,
              nightFinalOrder: d.nightFinalOrder ?? null,
              totalDayUnits: Number(d.totalDayUnits ?? 0),
              totalDayMeals: Number(d.totalDayMeals ?? 0),
              version: normalizeVersion(d.version),
              updatedBy: d.updatedBy ?? '',
              updatedAt: toMillis(d.updatedAt),
            };
          });
          observers.onDailyMeals?.(list);
        },
        (e) => forwardErr(e, OperationType.LIST, `messes/${messId}/daily_meals`)
      )
    );

    // Bazaar expenses
    unsubs.push(
      onSnapshot(
        collection(db, 'messes', messId, 'bazaar_expenses'),
        (snap) => {
          const list: BazaarExpense[] = snap.docs
            .map((docSnap) => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                buyerMemberId: d.buyerMemberId ?? '',
                buyerName: d.buyerName ?? '',
                amount: Number(d.amount ?? 0),
                itemsDescription: d.itemsDescription ?? '',
                category: d.category ?? 'Groceries',
                date: d.date ?? '',
                version: normalizeVersion(d.version),
                createdAt: toMillis(d.createdAt),
              };
            })
            .sort((a, b) => b.date.localeCompare(a.date));
          observers.onBazaarExpenses?.(list);
        },
        (e) => forwardErr(e, OperationType.LIST, `messes/${messId}/bazaar_expenses`)
      )
    );

    // Deposits
    unsubs.push(
      onSnapshot(
        collection(db, 'messes', messId, 'deposits'),
        (snap) => {
          const list: Deposit[] = snap.docs
            .map((docSnap) => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                memberId: d.memberId ?? '',
                memberName: d.memberName ?? '',
                amount: Number(d.amount ?? 0),
                date: d.date ?? '',
                paymentMethod: d.paymentMethod ?? 'Cash',
                notes: d.notes ?? '',
                recordedBy: d.recordedBy ?? '',
                version: normalizeVersion(d.version),
                createdAt: toMillis(d.createdAt),
              };
            })
            .sort((a, b) => b.date.localeCompare(a.date));
          observers.onDeposits?.(list);
        },
        (e) => forwardErr(e, OperationType.LIST, `messes/${messId}/deposits`)
      )
    );

    // Utility Bills
    unsubs.push(
      onSnapshot(
        collection(db, 'messes', messId, 'utility_bills'),
        (snap) => {
          const list: UtilityBill[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              title: d.title ?? '',
              amount: Number(d.amount ?? 0),
              month: d.month ?? '',
              version: normalizeVersion(d.version),
              createdAt: toMillis(d.createdAt),
            };
          });
          observers.onUtilityBills?.(list);
        },
        (e) => forwardErr(e, OperationType.LIST, `messes/${messId}/utility_bills`)
      )
    );

    // Shared Bills
    unsubs.push(
      onSnapshot(
        collection(db, 'messes', messId, 'shared_bills'),
        (snap) => {
          const list: SharedBill[] = snap.docs
            .map((docSnap) => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                title: d.title ?? '',
                allocationType: d.allocationType ?? BillAllocationType.FIXED_PER_MEMBER,
                totalAmount: Number(d.totalAmount ?? 0),
                perMemberAmount: Number(d.perMemberAmount ?? 0),
                month: d.month ?? '',
                deadline: d.deadline ?? '',
                notes: d.notes ?? '',
                assignedMemberIds: Array.isArray(d.assignedMemberIds) ? d.assignedMemberIds : [],
                memberShares: d.memberShares ?? {},
                memberNames: d.memberNames ?? {},
                payments: d.payments ?? {},
                createdByUid: d.createdByUid ?? '',
                createdByName: d.createdByName ?? '',
                version: normalizeVersion(d.version),
                createdAt: toMillis(d.createdAt),
                updatedAt: toMillis(d.updatedAt),
              };
            })
            .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
          observers.onSharedBills?.(list);
        },
        (e) => forwardErr(e, OperationType.LIST, `messes/${messId}/shared_bills`)
      )
    );

    // Notifications
    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'messes', messId, 'notifications'),
          orderBy('createdAt', 'desc'),
          limit(50)
        ),
        (snap) => {
          latestRawNotifications = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              messId: d.messId ?? messId,
              targetMemberId: d.targetMemberId ?? '',
              targetMemberName: d.targetMemberName ?? '',
              title: d.title ?? '',
              message: d.message ?? '',
              billId: d.billId ?? '',
              amount: Number(d.amount ?? 0),
              deadline: d.deadline ?? '',
              isRead: Boolean(d.isRead),
              createdAt: toMillis(d.createdAt),
            };
          });
          emitFilteredNotifications();
        },
        (e) => forwardErr(e, OperationType.LIST, `messes/${messId}/notifications`)
      )
    );

    // Audit Logs
    unsubs.push(
      onSnapshot(
        query(
          collection(db, 'messes', messId, 'audit_logs'),
          orderBy('timestamp', 'desc'),
          limit(50)
        ),
        (snap) => {
          const list: AuditLog[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              action: d.action ?? '',
              performedByUid: d.performedByUid ?? '',
              performedByName: d.performedByName ?? '',
              targetMemberId: d.targetMemberId ?? '',
              targetMemberName: d.targetMemberName ?? '',
              details: d.details ?? '',
              reason: d.reason ?? '',
              timestampMs: toMillis(d.timestamp),
            };
          });
          observers.onAuditLogs?.(list);
        },
        (e) => forwardErr(e, OperationType.LIST, `messes/${messId}/audit_logs`)
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  },

  async refreshMessData(messId, currentUserId, observers: MessObservers) {
    if (!messId) return;
    try {
      const [
        messSnap,
        membersSnap,
        mealsSnap,
        bazaarSnap,
        depositsSnap,
        utilitiesSnap,
        sharedBillsSnap,
      ] = await Promise.all([
        getDocFromServer(doc(db, 'messes', messId)),
        getDocsFromServer(collection(db, 'messes', messId, 'members')),
        getDocsFromServer(collection(db, 'messes', messId, 'daily_meals')),
        getDocsFromServer(collection(db, 'messes', messId, 'bazaar_expenses')),
        getDocsFromServer(collection(db, 'messes', messId, 'deposits')),
        getDocsFromServer(collection(db, 'messes', messId, 'utility_bills')),
        getDocsFromServer(collection(db, 'messes', messId, 'shared_bills')),
      ]);

      if (!messSnap.exists()) {
        observers.onMess?.(null);
      } else {
        const d = messSnap.data();
        observers.onMess?.({
          id: messSnap.id,
          name: d.name ?? '',
          managerUid: d.managerUid ?? '',
          adminUids: Array.isArray(d.adminUids) ? d.adminUids : [],
          memberUids: Array.isArray(d.memberUids) ? d.memberUids : [],
          activeMonth: d.activeMonth ?? '',
          lunchBookingDeadline: d.lunchBookingDeadline ?? '09:00',
          nightBookingDeadline: d.nightBookingDeadline ?? '17:00',
          version: normalizeVersion(d.version),
          createdAt: toMillis(d.createdAt),
          updatedAt: toMillis(d.updatedAt),
        });
      }

      const freshMembers: Member[] = membersSnap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          userId: d.userId ?? '',
          displayName: d.displayName ?? '',
          room: d.room ?? '',
          role: d.role === 'MANAGER' ? 'MANAGER' : 'MEMBER',
          isActive: d.isActive !== false,
          autoBookEnabled: Boolean(d.autoBookEnabled),
          autoBookLunch: d.autoBookLunch !== false,
          autoBookNight: d.autoBookNight !== false,
          autoBookUpdatedAt: d.autoBookUpdatedAt ?? '',
          createdAt: toMillis(d.createdAt),
        };
      });
      observers.onMembers?.(freshMembers);

      observers.onDailyMeals?.(
        mealsSnap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            date: d.date ?? docSnap.id,
            isFriday: Boolean(d.isFriday),
            lunchServiceStatus: d.lunchServiceStatus === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE',
            nightServiceStatus: d.nightServiceStatus === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE',
            cancellationReason: d.cancellationReason ?? '',
            bookings: d.bookings ?? {},
            attendances: d.attendances ?? {},
            lunchFinalOrder: d.lunchFinalOrder ?? null,
            nightFinalOrder: d.nightFinalOrder ?? null,
            totalDayUnits: Number(d.totalDayUnits ?? 0),
            totalDayMeals: Number(d.totalDayMeals ?? 0),
            version: normalizeVersion(d.version),
            updatedBy: d.updatedBy ?? '',
            updatedAt: toMillis(d.updatedAt),
          };
        })
      );

      observers.onBazaarExpenses?.(
        bazaarSnap.docs
          .map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              buyerMemberId: d.buyerMemberId ?? '',
              buyerName: d.buyerName ?? '',
              amount: Number(d.amount ?? 0),
              itemsDescription: d.itemsDescription ?? '',
              category: d.category ?? 'Groceries',
              date: d.date ?? '',
              version: normalizeVersion(d.version),
              createdAt: toMillis(d.createdAt),
            };
          })
          .sort((a, b) => b.date.localeCompare(a.date))
      );

      observers.onDeposits?.(
        depositsSnap.docs
          .map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              memberId: d.memberId ?? '',
              memberName: d.memberName ?? '',
              amount: Number(d.amount ?? 0),
              date: d.date ?? '',
              paymentMethod: d.paymentMethod ?? 'Cash',
              notes: d.notes ?? '',
              recordedBy: d.recordedBy ?? '',
              version: normalizeVersion(d.version),
              createdAt: toMillis(d.createdAt),
            };
          })
          .sort((a, b) => b.date.localeCompare(a.date))
      );

      observers.onUtilityBills?.(
        utilitiesSnap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            title: d.title ?? '',
            amount: Number(d.amount ?? 0),
            month: d.month ?? '',
            version: normalizeVersion(d.version),
            createdAt: toMillis(d.createdAt),
          };
        })
      );

      observers.onSharedBills?.(
        sharedBillsSnap.docs
          .map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              title: d.title ?? '',
              allocationType: d.allocationType ?? BillAllocationType.FIXED_PER_MEMBER,
              totalAmount: Number(d.totalAmount ?? 0),
              perMemberAmount: Number(d.perMemberAmount ?? 0),
              month: d.month ?? '',
              deadline: d.deadline ?? '',
              notes: d.notes ?? '',
              assignedMemberIds: Array.isArray(d.assignedMemberIds) ? d.assignedMemberIds : [],
              memberShares: d.memberShares ?? {},
              memberNames: d.memberNames ?? {},
              payments: d.payments ?? {},
              createdByUid: d.createdByUid ?? '',
              createdByName: d.createdByName ?? '',
              version: normalizeVersion(d.version),
              createdAt: toMillis(d.createdAt),
              updatedAt: toMillis(d.updatedAt),
            };
          })
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      );
      void currentUserId;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, `messes/${messId}`);
    }
  },

  async saveUserProfile(profile) {
    const user = requireUser();
    const path = `users/${user.uid}`;
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          displayName: (profile.displayName ?? user.displayName ?? 'User').slice(0, 120),
          email: (profile.email ?? user.email ?? '').slice(0, 200),
          currentMessId: (profile.currentMessId ?? '').slice(0, 128),
          createdAt: profile.createdAt ? Timestamp.fromMillis(profile.createdAt) : serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async createMess(name, managerName, defaultMonth) {
    const user = requireUser();
    const messRef = doc(collection(db, 'messes'));
    const messId = messRef.id;
    const memberRef = doc(db, 'messes', messId, 'members', user.uid);
    const userRef = doc(db, 'users', user.uid);

    try {
      const batch = writeBatch(db);
      batch.set(messRef, {
        name: name.trim().slice(0, 120),
        managerUid: user.uid,
        adminUids: [user.uid],
        memberUids: [user.uid],
        activeMonth: defaultMonth.slice(0, 10),
        lunchBookingDeadline: '09:00',
        nightBookingDeadline: '17:00',
        version: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(memberRef, {
        userId: user.uid,
        displayName: managerName.trim().slice(0, 120),
        room: 'Manager',
        role: 'MANAGER',
        isActive: true,
        autoBookEnabled: false,
        autoBookLunch: true,
        autoBookNight: true,
        autoBookUpdatedAt: '',
        createdAt: serverTimestamp(),
      });
      batch.set(
        userRef,
        {
          currentMessId: messId,
          displayName: (user.displayName || managerName).slice(0, 120),
          email: (user.email || '').slice(0, 200),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await batch.commit();
      return messId;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, messRef.path);
    }
  },

  async joinMess(messId, memberName, room) {
    const user = requireUser();
    const cleanMessId = messId.trim();
    const messRef = doc(db, 'messes', cleanMessId);
    const memberRef = doc(db, 'messes', cleanMessId, 'members', user.uid);
    const userRef = doc(db, 'users', user.uid);

    try {
      const snap = await getDoc(messRef);
      if (!snap.exists()) {
        throw new Error('Mess not found. Please verify the Mess ID with your manager.');
      }

      const batch = writeBatch(db);
      batch.update(messRef, {
        memberUids: arrayUnion(user.uid),
        updatedAt: serverTimestamp(),
      });
      batch.set(memberRef, {
        userId: user.uid,
        displayName: memberName.trim().slice(0, 120),
        room: room.trim().slice(0, 60),
        role: 'MEMBER',
        isActive: true,
        autoBookEnabled: false,
        autoBookLunch: true,
        autoBookNight: true,
        autoBookUpdatedAt: '',
        createdAt: serverTimestamp(),
      });
      batch.set(
        userRef,
        {
          currentMessId: cleanMessId,
          displayName: (user.displayName || memberName).slice(0, 120),
          email: (user.email || '').slice(0, 200),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, messRef.path);
    }
  },

  async updateBookingDeadlines(messId, lunchDeadline, nightDeadline, expectedVersion) {
    const user = requireUser();
    const messRef = doc(db, 'messes', messId);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(messRef);
        const targetExpected =
          expectedVersion !== undefined ? expectedVersion : normalizeVersion(snap.data()?.version);
        const nextVersion = assertAndNextVersion({
          exists: snap.exists(),
          currentVersion: snap.data()?.version,
          expectedVersion: targetExpected,
          recordLabel: 'mess deadline settings',
        });
        tx.update(messRef, {
          lunchBookingDeadline: lunchDeadline.slice(0, 5),
          nightBookingDeadline: nightDeadline.slice(0, 5),
          version: nextVersion,
          updatedAt: serverTimestamp(),
        });
      });
      await recordAuditLog(messId, {
        action: 'DEADLINE_CONFIGURED',
        performedByUid: user.uid,
        performedByName: user.displayName || 'Manager',
        details: `Lunch cutoff: ${lunchDeadline}, Night cutoff: ${nightDeadline} (Asia/Dhaka)`,
      });
    } catch (e) {
      if (isConcurrencyConflictError(e)) throw e;
      handleFirestoreError(e, OperationType.UPDATE, messRef.path);
    }
  },

  async promoteMemberToManager(messId, targetMember) {
    const user = requireUser();
    const messRef = doc(db, 'messes', messId);
    const memberDocId = targetMember.id || targetMember.userId;
    const memberRef = doc(db, 'messes', messId, 'members', memberDocId);
    const targetUid = targetMember.userId || targetMember.id;

    try {
      const batch = writeBatch(db);
      batch.update(memberRef, { role: 'MANAGER' });
      batch.update(messRef, {
        adminUids: arrayUnion(targetUid),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      await recordAuditLog(messId, {
        action: 'MEMBER_PROMOTED_TO_MANAGER',
        performedByUid: user.uid,
        performedByName: user.displayName || 'Manager',
        targetMemberId: targetMember.id,
        targetMemberName: targetMember.displayName,
        details: `Assigned Manager role to ${targetMember.displayName}`,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, memberRef.path);
    }
  },

  async demoteManagerToMember(messId, targetMember) {
    const user = requireUser();
    const messRef = doc(db, 'messes', messId);
    const memberDocId = targetMember.id || targetMember.userId;
    const memberRef = doc(db, 'messes', messId, 'members', memberDocId);
    const targetUid = targetMember.userId || targetMember.id;

    try {
      const batch = writeBatch(db);
      batch.update(memberRef, { role: 'MEMBER' });
      batch.update(messRef, {
        adminUids: arrayRemove(targetUid),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      await recordAuditLog(messId, {
        action: 'MANAGER_DEMOTED_TO_MEMBER',
        performedByUid: user.uid,
        performedByName: user.displayName || 'Manager',
        targetMemberId: targetMember.id,
        targetMemberName: targetMember.displayName,
        details: `Changed ${targetMember.displayName}'s role to Member`,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, memberRef.path);
    }
  },

  async resignAsManager(messId, currentMemberId, successor) {
    const user = requireUser();
    const messRef = doc(db, 'messes', messId);
    const currentMemberRef = doc(db, 'messes', messId, 'members', currentMemberId || user.uid);

    try {
      const messSnap = await getDoc(messRef);
      const messData = messSnap.data();
      const currentAdmins: string[] = Array.isArray(messData?.adminUids) ? messData.adminUids : [];

      const batch = writeBatch(db);
      batch.update(currentMemberRef, { role: 'MEMBER' });
      batch.update(messRef, { adminUids: arrayRemove(user.uid) });

      if (successor) {
        const successorUid = successor.userId || successor.id;
        const successorRef = doc(db, 'messes', messId, 'members', successor.id || successorUid);
        batch.update(successorRef, { role: 'MANAGER' });
        batch.update(messRef, { adminUids: arrayUnion(successorUid) });
        if (messData?.managerUid === user.uid) {
          batch.update(messRef, { managerUid: successorUid });
        }
      } else {
        const remainingAdmins = currentAdmins.filter((id) => id !== user.uid);
        if (messData?.managerUid === user.uid && remainingAdmins.length > 0) {
          batch.update(messRef, { managerUid: remainingAdmins[0] });
        }
      }
      batch.update(messRef, { updatedAt: serverTimestamp() });
      await batch.commit();

      await recordAuditLog(messId, {
        action: 'MANAGER_RESIGNED',
        performedByUid: user.uid,
        performedByName: user.displayName || 'Manager',
        targetMemberId: successor?.id || currentMemberId,
        targetMemberName: successor?.displayName || '',
        details: successor
          ? `${user.displayName || 'Manager'} resigned and transferred Manager role to ${successor.displayName}`
          : `${user.displayName || 'Manager'} resigned from Manager role`,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, messRef.path);
    }
  },

  async updateMemberStatus(messId, memberId, isActive) {
    const user = requireUser();
    const ref = doc(db, 'messes', messId, 'members', memberId);
    try {
      await updateDoc(ref, { isActive });
      await recordAuditLog(messId, {
        action: 'MEMBER_STATUS_UPDATED',
        performedByUid: user.uid,
        performedByName: user.displayName || 'Manager',
        targetMemberId: memberId,
        details: `Set member active status to ${isActive ? 'Active' : 'Inactive'}`,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, ref.path);
    }
  },

  async updateMealServiceStatus(
    messId,
    date,
    lunchStatus,
    nightStatus,
    cancellationReason,
    expectedVersion
  ) {
    const user = requireUser();
    const isFri = checkIsFriday(date);
    const ref = doc(db, 'messes', messId, 'daily_meals', date);
    const effectiveNight: MealServiceStatus = isFri ? 'CANCELLED' : nightStatus;

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const nextVersion = assertAndNextVersion({
          exists: snap.exists(),
          currentVersion: snap.data()?.version,
          expectedVersion,
          recordLabel: `daily meal record (${date})`,
        });

        if (!snap.exists()) {
          tx.set(ref, {
            date,
            isFriday: isFri,
            lunchServiceStatus: lunchStatus,
            nightServiceStatus: effectiveNight,
            cancellationReason: cancellationReason.slice(0, 300),
            bookings: {},
            version: nextVersion,
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.update(ref, {
            date,
            isFriday: isFri,
            lunchServiceStatus: lunchStatus,
            nightServiceStatus: effectiveNight,
            cancellationReason: cancellationReason.slice(0, 300),
            version: nextVersion,
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
          });
        }
      });
      await recordAuditLog(messId, {
        action: 'SERVICE_STATUS_UPDATED',
        performedByUid: user.uid,
        performedByName: user.displayName || 'Manager',
        details: `Date: ${date} | Lunch: ${lunchStatus}, Night: ${effectiveNight}${cancellationReason ? ` | Reason: ${cancellationReason}` : ''}`,
        reason: cancellationReason,
      });
    } catch (e) {
      if (isConcurrencyConflictError(e)) throw e;
      handleFirestoreError(e, OperationType.UPDATE, ref.path);
    }
  },

  async saveMemberBooking({
    messId,
    date,
    memberId,
    booking,
    lunchDeadline,
    nightDeadline,
    isManager,
    expectedVersion,
  }) {
    const user = requireUser();
    const isFri = checkIsFriday(date);
    const ref = doc(db, 'messes', messId, 'daily_meals', date);
    const isLunchPassed = isDeadlinePassed(date, lunchDeadline);
    const isNightPassed = isFri ? true : isDeadlinePassed(date, nightDeadline);

    if (!isManager && isLunchPassed && isNightPassed) {
      throw new Error(
        'Booking deadlines for both Lunch and Night have passed. Bookings are locked.'
      );
    }

    const effectiveBooking: MealBookingEntry = isFri
      ? { ...booking, statusNight: 'CANCELLED', guestNight: 0, updatedBy: user.uid }
      : { ...booking, updatedBy: user.uid };

    const bookingPayload = {
      statusLunch: effectiveBooking.statusLunch,
      statusNight: effectiveBooking.statusNight,
      guestLunch: effectiveBooking.guestLunch,
      guestNight: effectiveBooking.guestNight,
      updatedBy: user.uid,
      managerOverrideReason: effectiveBooking.managerOverrideReason || '',
      autoBooked: Boolean(effectiveBooking.autoBooked),
    };

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const nextVersion = assertAndNextVersion({
          exists: snap.exists(),
          currentVersion: snap.data()?.version,
          expectedVersion,
          recordLabel: `daily meal record (${date})`,
        });

        if (!snap.exists()) {
          tx.set(ref, {
            date,
            isFriday: isFri,
            lunchServiceStatus: 'ACTIVE',
            nightServiceStatus: isFri ? 'CANCELLED' : 'ACTIVE',
            bookings: { [memberId]: bookingPayload },
            version: nextVersion,
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.update(ref, {
            [`bookings.${memberId}`]: bookingPayload,
            version: nextVersion,
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
          });
        }
      });
    } catch (e) {
      if (isConcurrencyConflictError(e)) throw e;
      handleFirestoreError(e, OperationType.UPDATE, ref.path);
    }
  },

  async updateMemberAutoBookPreference({
    messId,
    memberId,
    enabled,
    bookLunch,
    bookNight,
    updatedDate,
  }) {
    requireUser();
    const ref = doc(db, 'messes', messId, 'members', memberId);
    try {
      await updateDoc(ref, {
        autoBookEnabled: enabled,
        autoBookLunch: bookLunch,
        autoBookNight: bookNight,
        autoBookUpdatedAt: updatedDate.slice(0, 16),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, ref.path);
    }
  },

  async clearAutoBookedEntries({
    messId,
    memberId,
    todayDate,
    records,
    lunchDeadline,
    nightDeadline,
  }) {
    const user = requireUser();
    for (const record of records) {
      const date = record.date || record.id;
      if (date < todayDate) continue;
      const booking = record.bookings?.[memberId];
      if (!booking || !booking.autoBooked) continue;
      const isFri = checkIsFriday(date);
      const lunchPassed = isDeadlinePassed(date, lunchDeadline);
      const nightPassed = isFri ? true : isDeadlinePassed(date, nightDeadline);
      if (lunchPassed && nightPassed) continue;

      const updated: MealBookingEntry = {
        ...booking,
        statusLunch: lunchPassed ? booking.statusLunch : 'NO_RESPONSE',
        statusNight: nightPassed ? booking.statusNight : 'NO_RESPONSE',
        autoBooked: false,
        updatedBy: user.uid,
      };
      const ref = doc(db, 'messes', messId, 'daily_meals', date);
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          const nextVersion = assertAndNextVersion({
            exists: snap.exists(),
            currentVersion: snap.data()?.version,
            expectedVersion: normalizeVersion(record.version),
            recordLabel: `daily meal record (${date})`,
          });
          tx.update(ref, {
            [`bookings.${memberId}`]: updated,
            version: nextVersion,
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
          });
        });
      } catch (e) {
        if (isConcurrencyConflictError(e)) throw e;
        handleFirestoreError(e, OperationType.UPDATE, ref.path);
      }
    }
  },

  async saveFinalMealOrderSummary(messId, date, mealType, summary, expectedVersion) {
    const user = requireUser();
    const isFri = checkIsFriday(date);
    const ref = doc(db, 'messes', messId, 'daily_meals', date);
    const fieldName = mealType === 'LUNCH' ? 'lunchFinalOrder' : 'nightFinalOrder';
    const orderPayload = {
      mealType: summary.mealType,
      date: summary.date,
      totalPortions: summary.totalPortions,
      memberCount: summary.memberCount,
      guestCount: summary.guestCount,
      deadline: summary.deadline,
      isLocked: true,
      lockedAtDhakaTime: summary.lockedAtDhakaTime,
      savedAt: serverTimestamp(),
    };

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const nextVersion = assertAndNextVersion({
          exists: snap.exists(),
          currentVersion: snap.data()?.version,
          expectedVersion,
          recordLabel: `daily meal record (${date})`,
        });

        if (!snap.exists()) {
          tx.set(ref, {
            date,
            isFriday: isFri,
            lunchServiceStatus: 'ACTIVE',
            nightServiceStatus: isFri ? 'CANCELLED' : 'ACTIVE',
            [fieldName]: orderPayload,
            version: nextVersion,
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.update(ref, {
            [fieldName]: orderPayload,
            version: nextVersion,
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
          });
        }
      });
    } catch (e) {
      if (isConcurrencyConflictError(e)) throw e;
      handleFirestoreError(e, OperationType.UPDATE, ref.path);
    }
  },

  async overrideMemberBooking({
    messId,
    date,
    memberId,
    memberName,
    booking,
    reason,
    expectedVersion,
  }) {
    const user = requireUser();
    const isFri = checkIsFriday(date);
    const ref = doc(db, 'messes', messId, 'daily_meals', date);
    const bookingPayload = {
      statusLunch: booking.statusLunch,
      statusNight: isFri ? 'CANCELLED' : booking.statusNight,
      guestLunch: Math.max(0, booking.guestLunch),
      guestNight: isFri ? 0 : Math.max(0, booking.guestNight),
      updatedBy: user.uid,
      managerOverrideReason: reason.slice(0, 300),
      autoBooked: false,
    };

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const nextVersion = assertAndNextVersion({
          exists: snap.exists(),
          currentVersion: snap.data()?.version,
          expectedVersion,
          recordLabel: `daily meal record (${date})`,
        });

        if (!snap.exists()) {
          tx.set(ref, {
            date,
            isFriday: isFri,
            lunchServiceStatus: 'ACTIVE',
            nightServiceStatus: isFri ? 'CANCELLED' : 'ACTIVE',
            bookings: { [memberId]: bookingPayload },
            version: nextVersion,
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.update(ref, {
            [`bookings.${memberId}`]: bookingPayload,
            version: nextVersion,
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
          });
        }
      });
      await recordAuditLog(messId, {
        action: 'BOOKING_OVERRIDE',
        performedByUid: user.uid,
        performedByName: user.displayName || 'Manager',
        targetMemberId: memberId,
        targetMemberName: memberName,
        details: `Date: ${date} | Lunch: ${bookingPayload.statusLunch} (+${bookingPayload.guestLunch}G), Night: ${bookingPayload.statusNight} (+${bookingPayload.guestNight}G)`,
        reason,
      });
    } catch (e) {
      if (isConcurrencyConflictError(e)) throw e;
      handleFirestoreError(e, OperationType.UPDATE, ref.path);
    }
  },

  async saveAttendance({
    messId,
    date,
    memberId,
    memberName,
    attendance,
    isFriday,
    expectedVersion,
  }) {
    const user = requireUser();
    const ref = doc(db, 'messes', messId, 'daily_meals', date);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const nextVersion = assertAndNextVersion({
          exists: snap.exists(),
          currentVersion: snap.data()?.version,
          expectedVersion,
          recordLabel: `daily meal record (${date})`,
        });

        if (!snap.exists()) {
          tx.set(ref, {
            date,
            isFriday,
            lunchServiceStatus: 'ACTIVE',
            nightServiceStatus: isFriday ? 'CANCELLED' : 'ACTIVE',
            attendances: { [memberId]: attendance },
            version: nextVersion,
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.update(ref, {
            [`attendances.${memberId}`]: attendance,
            version: nextVersion,
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
          });
        }
      });
      await recordAuditLog(messId, {
        action: 'ATTENDANCE_CONFIRMED',
        performedByUid: user.uid,
        performedByName: user.displayName || 'Manager',
        targetMemberId: memberId,
        targetMemberName: memberName,
        details: `Date: ${date} | Units: ${attendance.calculatedUnits} (Lunch: ${attendance.attendedLunch}, Night: ${attendance.attendedNight})`,
      });
    } catch (e) {
      if (isConcurrencyConflictError(e)) throw e;
      handleFirestoreError(e, OperationType.UPDATE, ref.path);
    }
  },

  async addBazaarExpense(messId, expense) {
    requireUser();
    const ref = doc(collection(db, 'messes', messId, 'bazaar_expenses'));
    try {
      await setDoc(ref, {
        buyerMemberId: expense.buyerMemberId.slice(0, 128),
        buyerName: expense.buyerName.slice(0, 120),
        amount: expense.amount,
        itemsDescription: expense.itemsDescription.slice(0, 500),
        category: expense.category.slice(0, 60),
        date: expense.date.slice(0, 10),
        version: 1,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, ref.path);
    }
  },

  async updateBazaarExpense(messId, expense) {
    requireUser();
    const ref = doc(db, 'messes', messId, 'bazaar_expenses', expense.id);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const nextVersion = assertAndNextVersion({
          exists: snap.exists(),
          currentVersion: snap.data()?.version,
          expectedVersion: normalizeVersion(expense.version),
          recordLabel: 'bazaar expense',
        });
        tx.update(ref, {
          buyerMemberId: expense.buyerMemberId.slice(0, 128),
          buyerName: expense.buyerName.slice(0, 120),
          amount: expense.amount,
          itemsDescription: expense.itemsDescription.slice(0, 500),
          category: expense.category.slice(0, 60),
          date: expense.date.slice(0, 10),
          version: nextVersion,
        });
      });
    } catch (e) {
      if (isConcurrencyConflictError(e)) throw e;
      handleFirestoreError(e, OperationType.UPDATE, ref.path);
    }
  },

  async deleteBazaarExpense(messId, expenseId) {
    requireUser();
    const ref = doc(db, 'messes', messId, 'bazaar_expenses', expenseId);
    try {
      await deleteDoc(ref);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, ref.path);
    }
  },

  async addDeposit(messId, deposit) {
    const user = requireUser();
    const ref = doc(collection(db, 'messes', messId, 'deposits'));
    try {
      await setDoc(ref, {
        memberId: deposit.memberId.slice(0, 128),
        memberName: deposit.memberName.slice(0, 120),
        amount: deposit.amount,
        date: deposit.date.slice(0, 10),
        paymentMethod: deposit.paymentMethod.slice(0, 40),
        notes: (deposit.notes || '').slice(0, 300),
        recordedBy: user.uid,
        version: 1,
        createdAt: serverTimestamp(),
      });
      await recordAuditLog(messId, {
        action: 'DEPOSIT_ADDED',
        performedByUid: user.uid,
        performedByName: user.displayName || 'Manager',
        targetMemberId: deposit.memberId,
        targetMemberName: deposit.memberName,
        details: `Added deposit of ৳${deposit.amount} via ${deposit.paymentMethod} on ${deposit.date}`,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, ref.path);
    }
  },

  async updateDeposit(messId, deposit) {
    const user = requireUser();
    const ref = doc(db, 'messes', messId, 'deposits', deposit.id);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const nextVersion = assertAndNextVersion({
          exists: snap.exists(),
          currentVersion: snap.data()?.version,
          expectedVersion: normalizeVersion(deposit.version),
          recordLabel: 'deposit record',
        });
        tx.update(ref, {
          memberId: deposit.memberId.slice(0, 128),
          memberName: deposit.memberName.slice(0, 120),
          amount: deposit.amount,
          date: deposit.date.slice(0, 10),
          paymentMethod: deposit.paymentMethod.slice(0, 40),
          notes: (deposit.notes || '').slice(0, 300),
          version: nextVersion,
        });
      });
      await recordAuditLog(messId, {
        action: 'DEPOSIT_UPDATED',
        performedByUid: user.uid,
        performedByName: user.displayName || 'Manager',
        targetMemberId: deposit.memberId,
        targetMemberName: deposit.memberName,
        details: `Updated deposit to ৳${deposit.amount} (${deposit.paymentMethod}) on ${deposit.date}`,
      });
    } catch (e) {
      if (isConcurrencyConflictError(e)) throw e;
      handleFirestoreError(e, OperationType.UPDATE, ref.path);
    }
  },

  async deleteDeposit(messId, deposit) {
    const user = requireUser();
    const ref = doc(db, 'messes', messId, 'deposits', deposit.id);
    try {
      await deleteDoc(ref);
      await recordAuditLog(messId, {
        action: 'DEPOSIT_DELETED',
        performedByUid: user.uid,
        performedByName: user.displayName || 'Manager',
        targetMemberId: deposit.memberId,
        targetMemberName: deposit.memberName,
        details: `Deleted deposit of ৳${deposit.amount} (${deposit.date})`,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, ref.path);
    }
  },

  async addUtilityBill(messId, bill) {
    const user = requireUser();
    const ref = doc(collection(db, 'messes', messId, 'utility_bills'));
    try {
      await setDoc(ref, {
        title: bill.title.slice(0, 120),
        amount: bill.amount,
        month: bill.month.slice(0, 10),
        version: 1,
        createdAt: serverTimestamp(),
      });
      await recordAuditLog(messId, {
        action: 'UTILITY_BILL_ADDED',
        performedByUid: user.uid,
        performedByName: user.displayName || 'Manager',
        details: `Added utility bill '${bill.title}': ৳${bill.amount}`,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, ref.path);
    }
  },

  async updateUtilityBill(messId, bill) {
    const user = requireUser();
    const ref = doc(db, 'messes', messId, 'utility_bills', bill.id);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const nextVersion = assertAndNextVersion({
          exists: snap.exists(),
          currentVersion: snap.data()?.version,
          expectedVersion: normalizeVersion(bill.version),
          recordLabel: `utility bill (${bill.title})`,
        });
        tx.update(ref, {
          title: bill.title.slice(0, 120),
          amount: bill.amount,
          month: bill.month.slice(0, 10),
          version: nextVersion,
        });
      });
      await recordAuditLog(messId, {
        action: 'UTILITY_BILL_UPDATED',
        performedByUid: user.uid,
        performedByName: user.displayName || 'Manager',
        details: `Updated utility bill '${bill.title}': ৳${bill.amount}`,
      });
    } catch (e) {
      if (isConcurrencyConflictError(e)) throw e;
      handleFirestoreError(e, OperationType.UPDATE, ref.path);
    }
  },

  async deleteUtilityBill(messId, billId, title, amount) {
    const user = requireUser();
    const ref = doc(db, 'messes', messId, 'utility_bills', billId);
    try {
      await deleteDoc(ref);
      await recordAuditLog(messId, {
        action: 'UTILITY_BILL_DELETED',
        performedByUid: user.uid,
        performedByName: user.displayName || 'Manager',
        details: `Deleted utility bill '${title}' (৳${amount})`,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, ref.path);
    }
  },

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
  }) {
    const user = requireUser();
    const billRef = doc(collection(db, 'messes', messId, 'shared_bills'));
    const billId = billRef.id;
    const memberCount = activeMembers.length;

    const assignedMemberIds = activeMembers.map((m) => m.id);
    const memberNames: Record<string, string> = {};
    const memberShares: Record<string, number> = {};

    for (const m of activeMembers) {
      memberNames[m.id] = m.displayName || 'Member';
    }

    let totalAmount = 0;
    let perMemberAmount = 0;

    if (allocationType === BillAllocationType.FIXED_PER_MEMBER) {
      perMemberAmount = roundTwoDecimals(amountInput);
      totalAmount = roundTwoDecimals(perMemberAmount * memberCount);
      for (const m of activeMembers) memberShares[m.id] = perMemberAmount;
    } else if (allocationType === BillAllocationType.DIVIDED_EQUALLY) {
      totalAmount = roundTwoDecimals(amountInput);
      perMemberAmount = memberCount > 0 ? roundTwoDecimals(totalAmount / memberCount) : 0;
      for (const m of activeMembers) memberShares[m.id] = perMemberAmount;
    } else {
      for (const m of activeMembers) {
        memberShares[m.id] = roundTwoDecimals(Math.max(0, customShares[m.id] ?? 0));
      }
      totalAmount = roundTwoDecimals(
        Object.values(memberShares).reduce((sum, v) => sum + v, 0)
      );
      perMemberAmount = memberCount > 0 ? roundTwoDecimals(totalAmount / memberCount) : 0;
    }

    const creatorName = (user.displayName || 'Manager').slice(0, 120);

    try {
      const batch = writeBatch(db);
      batch.set(billRef, {
        title: title.trim().slice(0, 120),
        allocationType,
        totalAmount,
        perMemberAmount,
        month: month.slice(0, 10),
        deadline: deadline.trim().slice(0, 16),
        notes: notes.trim().slice(0, 400),
        assignedMemberIds,
        memberShares,
        memberNames,
        payments: {},
        createdByUid: user.uid,
        createdByName: creatorName,
        version: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      for (const m of activeMembers) {
        const share = memberShares[m.id] ?? perMemberAmount;
        const notifRef = doc(collection(db, 'messes', messId, 'notifications'));
        batch.set(notifRef, {
          messId,
          targetMemberId: m.id,
          targetMemberName: (m.displayName || 'Member').slice(0, 120),
          title: `New Bill: ${title.trim()}`.slice(0, 160),
          message: `Your share is ৳${share.toFixed(0)}. Deadline: ${deadline}.`.slice(0, 500),
          billId,
          amount: share,
          deadline: deadline.slice(0, 16),
          isRead: false,
          createdAt: serverTimestamp(),
        });
      }

      await batch.commit();
      await recordAuditLog(messId, {
        action: 'SHARED_BILL_PUBLISHED',
        performedByUid: user.uid,
        performedByName: creatorName,
        details: `Published '${title}': ৳${totalAmount} total (${allocationType}) for ${memberCount} members. Deadline: ${deadline}`,
      });
      return billId;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, billRef.path);
    }
  },

  async updateSharedBill(messId, bill, updatedShares) {
    const user = requireUser();
    const ref = doc(db, 'messes', messId, 'shared_bills', bill.id);
    const finalShares = updatedShares ?? bill.memberShares;
    const finalTotal = updatedShares
      ? roundTwoDecimals(Object.values(finalShares).reduce((s, v) => s + v, 0))
      : bill.totalAmount;
    const finalPerMem =
      bill.assignedMemberIds.length > 0
        ? roundTwoDecimals(finalTotal / bill.assignedMemberIds.length)
        : bill.perMemberAmount;

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const nextVersion = assertAndNextVersion({
          exists: snap.exists(),
          currentVersion: snap.data()?.version,
          expectedVersion: normalizeVersion(bill.version),
          recordLabel: `shared bill (${bill.title})`,
        });

        const updatedPayments: Record<string, unknown> = {};
        for (const [memId, rec] of Object.entries(bill.payments)) {
          const share = finalShares[memId] ?? finalPerMem;
          const status =
            rec.amountPaid >= share && share > 0
              ? BillPaymentStatus.PAID
              : rec.amountPaid > 0
                ? BillPaymentStatus.PARTIALLY_PAID
                : BillPaymentStatus.UNPAID;
          updatedPayments[memId] = {
            ...rec,
            status,
          };
        }

        tx.update(ref, {
          title: bill.title.slice(0, 120),
          deadline: bill.deadline.slice(0, 16),
          notes: (bill.notes || '').slice(0, 400),
          totalAmount: finalTotal,
          perMemberAmount: finalPerMem,
          memberShares: finalShares,
          payments: updatedPayments,
          version: nextVersion,
          updatedAt: serverTimestamp(),
        });
      });
      await recordAuditLog(messId, {
        action: 'SHARED_BILL_UPDATED',
        performedByUid: user.uid,
        performedByName: user.displayName || 'Manager',
        details: `Updated bill '${bill.title}' (Total: ৳${finalTotal}, Deadline: ${bill.deadline})`,
      });
    } catch (e) {
      if (isConcurrencyConflictError(e)) throw e;
      handleFirestoreError(e, OperationType.UPDATE, ref.path);
    }
  },

  async deleteSharedBill(messId, billId, billTitle, totalAmount, expectedVersion) {
    const user = requireUser();
    const ref = doc(db, 'messes', messId, 'shared_bills', billId);
    try {
      if (expectedVersion !== undefined) {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          assertAndNextVersion({
            exists: snap.exists(),
            currentVersion: snap.data()?.version,
            expectedVersion,
            recordLabel: `shared bill (${billTitle})`,
          });
          tx.delete(ref);
        });
      } else {
        await deleteDoc(ref);
      }
      await recordAuditLog(messId, {
        action: 'SHARED_BILL_DELETED',
        performedByUid: user.uid,
        performedByName: user.displayName || 'Manager',
        details: `Deleted shared bill '${billTitle}' (Total: ৳${totalAmount})`,
      });
    } catch (e) {
      if (isConcurrencyConflictError(e)) throw e;
      handleFirestoreError(e, OperationType.DELETE, ref.path);
    }
  },

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
  }) {
    const user = requireUser();
    const ref = doc(db, 'messes', messId, 'shared_bills', billId);

    try {
      let computedStatus: string = BillPaymentStatus.UNPAID;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const nextVersion = assertAndNextVersion({
          exists: snap.exists(),
          currentVersion: snap.data()?.version,
          expectedVersion,
          recordLabel: 'shared bill',
        });

        const data = snap.data() || {};
        const liveShare =
          typeof data.memberShares?.[memberId] === 'number'
            ? data.memberShares[memberId]
            : typeof data.perMemberAmount === 'number'
              ? data.perMemberAmount
              : assignedShare;

        computedStatus =
          amountPaid >= liveShare && liveShare > 0
            ? BillPaymentStatus.PAID
            : amountPaid > 0
              ? BillPaymentStatus.PARTIALLY_PAID
              : BillPaymentStatus.UNPAID;

        tx.update(ref, {
          [`payments.${memberId}`]: {
            memberId,
            memberName,
            amountPaid,
            status: computedStatus,
            paymentDate,
            paymentMethod,
            notes,
            recordedByUid: user.uid,
            recordedByName: user.displayName || 'Manager',
          },
          version: nextVersion,
          updatedAt: serverTimestamp(),
        });
      });
      await recordAuditLog(messId, {
        action: 'BILL_PAYMENT_RECORDED',
        performedByUid: user.uid,
        performedByName: user.displayName || 'Manager',
        targetMemberId: memberId,
        targetMemberName: memberName,
        details: `Recorded payment of ৳${amountPaid} for ${memberName} (Status: ${computedStatus}, Method: ${paymentMethod})`,
      });
    } catch (e) {
      if (isConcurrencyConflictError(e)) throw e;
      handleFirestoreError(e, OperationType.UPDATE, ref.path);
    }
  },

  async markNotificationAsRead(messId, notificationId) {
    const ref = doc(db, 'messes', messId, 'notifications', notificationId);
    try {
      await updateDoc(ref, { isRead: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, ref.path);
    }
  },

  async markAllNotificationsAsRead(messId, notificationIds) {
    if (notificationIds.length === 0) return;
    try {
      const batch = writeBatch(db);
      for (const id of notificationIds) {
        batch.update(doc(db, 'messes', messId, 'notifications', id), { isRead: true });
      }
      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `messes/${messId}/notifications`);
    }
  },
};
