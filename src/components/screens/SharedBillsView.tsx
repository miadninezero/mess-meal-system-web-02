import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useMess } from '../../context/MessContext';
import {
  BillAllocationType,
  BillAllocationTypeValue,
  BillPaymentStatus,
  PAYMENT_METHODS,
  SharedBill,
  getMemberDue,
  getMemberPaid,
  getMemberPaymentStatus,
  getMemberShare,
  getSharedBillStats,
} from '../../types/mess';
import { formatCurrency, formatReadableDate, shiftDate } from '../../utils/dhakaTime';

export function SharedBillsView() {
  const {
    authUser,
    members,
    sharedBills,
    summary,
    todayDhakaDate,
    isManager,
    currentMember,
    createSharedBill,
    updateSharedBill,
    deleteSharedBill,
    recordBillPayment,
  } = useMess();

  const [expandedBillId, setExpandedBillId] = useState<string | null>(
    sharedBills[0]?.id ?? null
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBill, setEditingBill] = useState<SharedBill | null>(null);
  const [deletingBill, setDeletingBill] = useState<SharedBill | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<{
    bill: SharedBill;
    memberId: string;
    memberName: string;
    assignedShare: number;
  } | null>(null);

  // Create form state
  const [title, setTitle] = useState('');
  const [allocationType, setAllocationType] = useState<BillAllocationTypeValue>(
    BillAllocationType.DIVIDED_EQUALLY
  );
  const [amountInput, setAmountInput] = useState('');
  const [deadline, setDeadline] = useState(shiftDate(todayDhakaDate, 5));
  const [notes, setNotes] = useState('');
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  // Edit bill state
  const [editTitle, setEditTitle] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCustomShares, setEditCustomShares] = useState<Record<string, string>>({});
  const [customizeEditShares, setCustomizeEditShares] = useState(false);

  // Payment modal state
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<string>('Cash');
  const [payDate, setPayDate] = useState(todayDhakaDate);
  const [payNotes, setPayNotes] = useState('');

  const activeMembers = members.filter((m) => m.isActive);
  const myMemberId = currentMember?.id || authUser?.uid || '';

  const openCreate = () => {
    setTitle('');
    setAllocationType(BillAllocationType.DIVIDED_EQUALLY);
    setAmountInput('');
    setDeadline(shiftDate(todayDhakaDate, 5));
    setNotes('');
    const initShares: Record<string, string> = {};
    activeMembers.forEach((m) => {
      initShares[m.id] = '';
    });
    setCustomShares(initShares);
    setFormError('');
    setShowCreateModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!title.trim()) {
      setFormError('Please enter a bill title.');
      return;
    }

    if (allocationType === BillAllocationType.CUSTOM_PER_MEMBER) {
      const parsedShares: Record<string, number> = {};
      let sum = 0;
      for (const m of activeMembers) {
        const val = Number.parseFloat(customShares[m.id] || '0');
        if (Number.isNaN(val) || val < 0) {
          setFormError(`Invalid amount for ${m.displayName}.`);
          return;
        }
        parsedShares[m.id] = val;
        sum += val;
      }
      if (sum <= 0) {
        setFormError('Total custom bill amount must be greater than 0.');
        return;
      }
      await createSharedBill({
        title: title.trim(),
        allocationType,
        amountInput: sum,
        deadline,
        notes,
        customShares: parsedShares,
      });
    } else {
      const num = Number.parseFloat(amountInput);
      if (Number.isNaN(num) || num <= 0) {
        setFormError('Please enter a valid positive amount.');
        return;
      }
      await createSharedBill({
        title: title.trim(),
        allocationType,
        amountInput: num,
        deadline,
        notes,
      });
    }
    setShowCreateModal(false);
  };

  const openEdit = (bill: SharedBill) => {
    setEditTitle(bill.title);
    setEditDeadline(bill.deadline);
    setEditNotes(bill.notes);
    const map: Record<string, string> = {};
    bill.assignedMemberIds.forEach((id) => {
      map[id] = String(getMemberShare(bill, id));
    });
    setEditCustomShares(map);
    setCustomizeEditShares(false);
    setEditingBill(bill);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBill || !editTitle.trim()) return;
    let updatedShares: Record<string, number> | undefined;
    if (customizeEditShares) {
      updatedShares = {};
      for (const id of editingBill.assignedMemberIds) {
        updatedShares[id] = Math.max(0, Number.parseFloat(editCustomShares[id] || '0') || 0);
      }
    }
    await updateSharedBill(
      {
        ...editingBill,
        title: editTitle.trim(),
        deadline: editDeadline,
        notes: editNotes.trim(),
      },
      updatedShares
    );
    setEditingBill(null);
  };

  const openPaymentModal = (bill: SharedBill, memberId: string) => {
    const share = getMemberShare(bill, memberId);
    const paid = getMemberPaid(bill, memberId);
    const name = bill.memberNames[memberId] || members.find((m) => m.id === memberId)?.displayName || 'Member';
    setPayAmount(String(paid > 0 ? paid : share));
    setPayMethod(bill.payments[memberId]?.paymentMethod || 'Cash');
    setPayDate(bill.payments[memberId]?.paymentDate || todayDhakaDate);
    setPayNotes(bill.payments[memberId]?.notes || '');
    setPaymentTarget({ bill, memberId, memberName: name, assignedShare: share });
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Bar */}
      <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-8">
          <div>
            <div className="text-xs font-medium text-[#85736D] dark:text-[#A08C86]">Total Billed</div>
            <div className="mt-1 font-display text-2xl font-bold font-mono tabular-nums text-[#201A17] dark:text-[#EDE0DB]">
              {formatCurrency(summary.totalSharedBills)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-[#85736D] dark:text-[#A08C86]">Total Collected</div>
            <div className="mt-1 font-display text-2xl font-bold font-mono tabular-nums text-[#0D7351] dark:text-[#89D6B7]">
              {formatCurrency(summary.totalSharedBillsCollected)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-[#85736D] dark:text-[#A08C86]">Outstanding</div>
            <div className="mt-1 font-display text-2xl font-bold font-mono tabular-nums text-rose-700 dark:text-[#FFB4AB]">
              {formatCurrency(summary.totalSharedBillsUnpaid)}
            </div>
          </div>
        </div>

        {isManager && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Create Shared Bill</span>
          </button>
        )}
      </div>

      {/* Bills List */}
      {sharedBills.length === 0 ? (
        <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl p-10 text-center space-y-3">
          <p className="text-sm text-[#52443E] dark:text-[#D7C3BC]">
            No shared bills published yet (e.g. Wi-Fi, Maid, Electricity, Gas).
          </p>
          {isManager && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Publish First Shared Bill</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sharedBills.map((bill) => {
            const stats = getSharedBillStats(bill);
            const pct =
              bill.totalAmount > 0
                ? Math.min(100, Math.round((stats.totalCollected / bill.totalAmount) * 100))
                : 100;
            const isExpanded = expandedBillId === bill.id;
            const myDue = getMemberDue(bill, myMemberId);
            const myStatus = getMemberPaymentStatus(bill, myMemberId);

            const allocLabel =
              bill.allocationType === BillAllocationType.FIXED_PER_MEMBER
                ? 'Fixed per Member'
                : bill.allocationType === BillAllocationType.CUSTOM_PER_MEMBER
                  ? 'Custom per Member'
                  : 'Divided Equally';

            return (
              <div key={bill.id} className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl overflow-hidden">
                <div className="p-6 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="font-display text-lg font-bold text-[#201A17] dark:text-[#EDE0DB]">
                        {bill.title}
                      </h3>
                      <div className="text-xs text-[#85736D] dark:text-[#A08C86]">
                        {allocLabel} · Due {formatReadableDate(bill.deadline)} ·{' '}
                        <span className="font-mono tabular-nums">
                          {stats.paidMembersCount} Paid / {stats.partiallyPaidMembersCount} Partial /{' '}
                          {stats.unpaidMembersCount} Unpaid
                        </span>
                      </div>
                      {bill.notes && <p className="text-sm text-[#52443E] dark:text-[#D7C3BC] pt-1">{bill.notes}</p>}
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-display text-xl font-bold font-mono tabular-nums text-[#201A17] dark:text-[#EDE0DB]">
                          {formatCurrency(bill.totalAmount)}
                        </div>
                        <div className="text-xs font-mono tabular-nums text-[#85736D] dark:text-[#A08C86]">
                          Collected {formatCurrency(stats.totalCollected)} ({pct}%)
                        </div>
                      </div>
                      {isManager && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Edit shared bill ${bill.title}`}
                            onClick={() => openEdit(bill)}
                            className="p-2 text-[#85736D] dark:text-[#A08C86] hover:text-[#201A17] dark:hover:text-[#EDE0DB] rounded-lg hover:bg-[#F4DFD7]/50 dark:hover:bg-[#352A25] cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete shared bill ${bill.title}`}
                            onClick={() => setDeletingBill(bill)}
                            className="p-2 text-[#85736D] dark:text-[#A08C86] hover:text-rose-700 dark:hover:text-[#FFB4AB] rounded-lg hover:bg-rose-50 dark:hover:bg-[#93000A]/30 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-[#F4DFD7] dark:bg-[#352A25] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0D7351] dark:bg-[#89D6B7] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="text-xs text-[#52443E] dark:text-[#D7C3BC]">
                      Your share:{' '}
                      <span className="font-mono tabular-nums font-semibold text-[#201A17] dark:text-[#EDE0DB]">
                        {formatCurrency(getMemberShare(bill, myMemberId))}
                      </span>{' '}
                      ·{' '}
                      <span
                        className={
                          myStatus === BillPaymentStatus.PAID
                            ? 'text-[#0D7351] dark:text-[#89D6B7] font-semibold'
                            : myStatus === BillPaymentStatus.PARTIALLY_PAID
                              ? 'text-amber-700 dark:text-[#FFB59A] font-semibold'
                              : 'text-rose-700 dark:text-[#FFB4AB] font-semibold'
                        }
                      >
                        {myStatus === BillPaymentStatus.PAID
                          ? 'Paid'
                          : myStatus === BillPaymentStatus.PARTIALLY_PAID
                            ? `Partial (Due ${formatCurrency(myDue)})`
                            : `Unpaid (Due ${formatCurrency(myDue)})`}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#52443E] dark:text-[#D7C3BC] hover:text-[#201A17] dark:hover:text-[#EDE0DB] cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide Member Roster' : 'Show Member Roster'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Member Payment Roster */}
                {isExpanded && (
                  <div className="border-t border-[#E8D9D3] dark:border-[#3E322D] bg-[#F4DFD7]/45 dark:bg-[#171210]/70 p-4 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-[#E8D9D3] dark:border-[#3E322D] text-xs font-medium text-[#85736D] dark:text-[#A08C86]">
                          <th className="py-2 pr-4">Member</th>
                          <th className="py-2 pr-4 text-right">Share</th>
                          <th className="py-2 pr-4 text-right">Paid</th>
                          <th className="py-2 pr-4 text-right">Due</th>
                          <th className="py-2 pr-4">Status</th>
                          {isManager && <th className="py-2 text-right">Action</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E8D9D3] dark:divide-[#3E322D]">
                        {bill.assignedMemberIds.map((memberId) => {
                          const name =
                            bill.memberNames[memberId] ||
                            members.find((m) => m.id === memberId)?.displayName ||
                            'Member';
                          const share = getMemberShare(bill, memberId);
                          const paid = getMemberPaid(bill, memberId);
                          const due = getMemberDue(bill, memberId);
                          const status = getMemberPaymentStatus(bill, memberId);
                          const payRec = bill.payments[memberId];

                          return (
                            <tr key={memberId}>
                              <td className="py-2.5 pr-4">
                                <div className="font-medium text-[#201A17] dark:text-[#EDE0DB]">{name}</div>
                                {payRec?.paymentDate && (
                                  <div className="text-xs text-[#85736D] dark:text-[#A08C86]">
                                    {payRec.paymentMethod} · {formatReadableDate(payRec.paymentDate)}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#52443E] dark:text-[#D7C3BC]">
                                {formatCurrency(share)}
                              </td>
                              <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-[#0D7351] dark:text-[#89D6B7] font-medium">
                                {formatCurrency(paid)}
                              </td>
                              <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-rose-700 dark:text-[#FFB4AB] font-medium">
                                {formatCurrency(due)}
                              </td>
                              <td className="py-2.5 pr-4">
                                <span
                                  className={`text-xs font-semibold ${
                                    status === BillPaymentStatus.PAID
                                      ? 'text-[#0D7351] dark:text-[#89D6B7]'
                                      : status === BillPaymentStatus.PARTIALLY_PAID
                                        ? 'text-amber-700 dark:text-[#FFB59A]'
                                        : 'text-rose-700 dark:text-[#FFB4AB]'
                                  }`}
                                >
                                  {status.replace('_', ' ')}
                                </span>
                              </td>
                              {isManager && (
                                <td className="py-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => openPaymentModal(bill, memberId)}
                                    className="px-3 py-1 text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] bg-white dark:bg-[#221B18] border border-[#85736D]/50 dark:border-[#52443E] hover:bg-[#F4DFD7]/50 dark:hover:bg-[#352A25] rounded-lg whitespace-nowrap cursor-pointer"
                                  >
                                    Record Payment
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Shared Bill Modal */}
      {showCreateModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-[#201A17]/40 dark:bg-black/65 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl max-w-lg w-full max-h-[90vh] flex flex-col"
          >
            <div className="px-6 py-4 border-b border-[#E8D9D3] dark:border-[#3E322D] flex items-center justify-between">
              <h3 className="font-display font-bold text-[#201A17] dark:text-[#EDE0DB]">Publish Shared Bill</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close create bill modal"
                className="p-1 text-[#85736D] dark:text-[#A08C86] hover:text-[#201A17] dark:hover:text-[#EDE0DB] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-[#93000A]/40 border border-rose-200 dark:border-[#93000A] text-xs text-rose-800 dark:text-[#FFDAD6]">
                  {formError}
                </div>
              )}

              <div>
                <label htmlFor="sb-title" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Bill Title
                </label>
                <input
                  id="sb-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Fiber Wi-Fi, Electricity, Maid Service"
                  className="w-full px-3 py-2 text-sm border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                  required
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1.5">
                  Allocation Mode ({activeMembers.length} active members)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: BillAllocationType.DIVIDED_EQUALLY, label: 'Divide Equally' },
                    { id: BillAllocationType.FIXED_PER_MEMBER, label: 'Fixed / Member' },
                    { id: BillAllocationType.CUSTOM_PER_MEMBER, label: 'Custom / Member' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAllocationType(opt.id)}
                      className={`py-2 px-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                        allocationType === opt.id
                          ? 'bg-[#C05621] text-white border-[#C05621] dark:bg-[#FFB59A] dark:text-[#5F1B00] dark:border-[#FFB59A]'
                          : 'bg-white dark:bg-[#1A1412] text-[#52443E] dark:text-[#D7C3BC] border-[#85736D]/50 dark:border-[#52443E] hover:bg-[#F4DFD7]/35 dark:hover:bg-[#352A25]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {allocationType !== BillAllocationType.CUSTOM_PER_MEMBER ? (
                <div>
                  <label htmlFor="sb-amount" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                    {allocationType === BillAllocationType.FIXED_PER_MEMBER
                      ? 'Amount Per Member (৳)'
                      : 'Total Bill Amount (৳)'}
                  </label>
                  <input
                    id="sb-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full px-3 py-2 text-sm font-mono border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                    required
                  />
                </div>
              ) : (
                <div className="space-y-2 border border-[#E8D9D3] dark:border-[#3E322D] rounded-lg p-3 bg-[#FCFAF7] dark:bg-[#171210]">
                  <div className="text-xs font-semibold text-[#52443E] dark:text-[#D7C3BC]">
                    Individual Member Shares (৳)
                  </div>
                  {activeMembers.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3">
                      <label htmlFor={`cs-${m.id}`} className="text-sm text-[#52443E] dark:text-[#D7C3BC] truncate">
                        {m.displayName}
                      </label>
                      <input
                        id={`cs-${m.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={customShares[m.id] ?? ''}
                        onChange={(e) =>
                          setCustomShares((prev) => ({ ...prev, [m.id]: e.target.value }))
                        }
                        placeholder="0"
                        className="w-28 px-2.5 py-1.5 text-sm font-mono text-right border border-[#85736D]/50 dark:border-[#52443E] rounded bg-white dark:bg-[#1A1412]"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sb-deadline" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                    Payment Deadline
                  </label>
                  <input
                    id="sb-deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="sb-notes" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                    Notes (Optional)
                  </label>
                  <input
                    id="sb-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Account / instructions"
                    className="w-full px-3 py-2 text-sm border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#E8D9D3] dark:border-[#3E322D] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-[#52443E] dark:text-[#D7C3BC] border border-[#85736D]/50 dark:border-[#52443E] rounded-lg hover:bg-[#F4DFD7]/40 dark:hover:bg-[#352A25] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] rounded-lg cursor-pointer"
              >
                Publish &amp; Notify Members
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Shared Bill Modal */}
      {editingBill && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-[#201A17]/40 dark:bg-black/65 flex items-center justify-center p-4">
          <form
            onSubmit={handleEditSave}
            className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl max-w-lg w-full max-h-[90vh] flex flex-col"
          >
            <div className="px-6 py-4 border-b border-[#E8D9D3] dark:border-[#3E322D] flex items-center justify-between">
              <h3 className="font-display font-bold text-[#201A17] dark:text-[#EDE0DB]">Edit Shared Bill</h3>
              <button
                type="button"
                onClick={() => setEditingBill(null)}
                aria-label="Close edit bill modal"
                className="p-1 text-[#85736D] dark:text-[#A08C86] hover:text-[#201A17] dark:hover:text-[#EDE0DB] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label htmlFor="eb-title" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Bill Title
                </label>
                <input
                  id="eb-title"
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                  required
                />
              </div>
              <div>
                <label htmlFor="eb-deadline" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Deadline
                </label>
                <input
                  id="eb-deadline"
                  type="date"
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                  required
                />
              </div>
              <div>
                <label htmlFor="eb-notes" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Notes
                </label>
                <input
                  id="eb-notes"
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                />
              </div>

              <button
                type="button"
                onClick={() => setCustomizeEditShares((v) => !v)}
                className="text-xs font-semibold text-[#0D7351] dark:text-[#89D6B7] hover:underline cursor-pointer"
              >
                {customizeEditShares ? 'Hide Individual Share Overrides' : 'Customize Individual Shares'}
              </button>

              {customizeEditShares && (
                <div className="space-y-2 border border-[#E8D9D3] dark:border-[#3E322D] rounded-lg p-3 bg-[#FCFAF7] dark:bg-[#171210]">
                  {editingBill.assignedMemberIds.map((id) => (
                    <div key={id} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-[#52443E] dark:text-[#D7C3BC]">
                        {editingBill.memberNames[id] || id}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editCustomShares[id] ?? '0'}
                        onChange={(e) =>
                          setEditCustomShares((prev) => ({ ...prev, [id]: e.target.value }))
                        }
                        className="w-28 px-2.5 py-1.5 text-sm font-mono text-right border border-[#85736D]/50 dark:border-[#52443E] rounded bg-white dark:bg-[#1A1412]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#E8D9D3] dark:border-[#3E322D] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingBill(null)}
                className="px-4 py-2 text-sm font-medium text-[#52443E] dark:text-[#D7C3BC] border border-[#85736D]/50 dark:border-[#52443E] rounded-lg hover:bg-[#F4DFD7]/40 dark:hover:bg-[#352A25] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] rounded-lg cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentTarget && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-[#201A17]/40 dark:bg-black/65 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-[#201A17] dark:text-[#EDE0DB]">
                  Record Payment: {paymentTarget.memberName}
                </h3>
                <p className="text-xs text-[#85736D] dark:text-[#A08C86] font-mono tabular-nums">
                  Assigned Share: {formatCurrency(paymentTarget.assignedShare)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentTarget(null)}
                aria-label="Close payment modal"
                className="p-1 text-[#85736D] dark:text-[#A08C86] hover:text-[#201A17] dark:hover:text-[#EDE0DB] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPayAmount(String(paymentTarget.assignedShare))}
                className="flex-1 py-1.5 text-xs font-semibold text-[#0D7351] dark:text-[#A5F2D2] bg-[#A5F2D2]/50 dark:bg-[#005238] hover:bg-[#A5F2D2] dark:hover:bg-[#006B49] rounded-lg cursor-pointer"
              >
                Full Share ({formatCurrency(paymentTarget.assignedShare)})
              </button>
              <button
                type="button"
                onClick={() => setPayAmount('0')}
                className="flex-1 py-1.5 text-xs font-semibold text-rose-700 dark:text-[#FFB4AB] bg-rose-50 dark:bg-[#93000A]/40 hover:bg-rose-100 dark:hover:bg-[#93000A]/60 rounded-lg cursor-pointer"
              >
                Mark Unpaid (৳0)
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="pay-amount" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Amount Paid (৳)
                </label>
                <input
                  id="pay-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pay-method" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                    Method
                  </label>
                  <select
                    id="pay-method"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="pay-date" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                    Date
                  </label>
                  <input
                    id="pay-date"
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="pay-notes" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Notes (Optional)
                </label>
                <input
                  id="pay-notes"
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Reference or receipt note"
                  className="w-full px-3 py-2 text-sm border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPaymentTarget(null)}
                className="px-4 py-2 text-sm font-medium text-[#52443E] dark:text-[#D7C3BC] border border-[#85736D]/50 dark:border-[#52443E] rounded-lg hover:bg-[#F4DFD7]/40 dark:hover:bg-[#352A25] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const num = Math.max(0, Number.parseFloat(payAmount) || 0);
                  await recordBillPayment({
                    billId: paymentTarget.bill.id,
                    memberId: paymentTarget.memberId,
                    memberName: paymentTarget.memberName,
                    assignedShare: paymentTarget.assignedShare,
                    amountPaid: num,
                    paymentMethod: payMethod,
                    paymentDate: payDate,
                    notes: payNotes.trim(),
                  });
                  setPaymentTarget(null);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] rounded-lg cursor-pointer"
              >
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Shared Bill Confirmation */}
      {deletingBill && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-[#201A17]/40 dark:bg-black/65 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display font-bold text-[#201A17] dark:text-[#EDE0DB]">Delete Shared Bill?</h3>
            <p className="text-sm text-[#52443E] dark:text-[#D7C3BC]">
              Delete <strong>{deletingBill.title}</strong> ({formatCurrency(deletingBill.totalAmount)})?
              All associated member payment records for this bill will be removed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingBill(null)}
                className="px-4 py-2 text-sm font-medium text-[#52443E] dark:text-[#D7C3BC] border border-[#85736D]/50 dark:border-[#52443E] rounded-lg hover:bg-[#F4DFD7]/40 dark:hover:bg-[#352A25] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = deletingBill;
                  setDeletingBill(null);
                  await deleteSharedBill(target);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg cursor-pointer"
              >
                Delete Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
