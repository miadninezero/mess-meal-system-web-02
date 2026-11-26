import React, { useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useMess } from '../../context/MessContext';
import { Deposit, PAYMENT_METHODS } from '../../types/mess';
import { formatCurrency, formatReadableDate, shiftDate } from '../../utils/dhakaTime';

export function DepositsView() {
  const {
    members,
    deposits,
    summary,
    todayDhakaDate,
    isManager,
    addDeposit,
    updateDeposit,
    deleteDeposit,
  } = useMess();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDeposit, setEditingDeposit] = useState<Deposit | null>(null);
  const [deletingDeposit, setDeletingDeposit] = useState<Deposit | null>(null);

  const [memberId, setMemberId] = useState(members[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayDhakaDate);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const openAdd = () => {
    setMemberId(members[0]?.id ?? '');
    setAmount('');
    setDate(todayDhakaDate);
    setPaymentMethod('Cash');
    setNotes('');
    setFormError('');
    setShowAddModal(true);
  };

  const openEdit = (dep: Deposit) => {
    setMemberId(dep.memberId);
    setAmount(String(dep.amount));
    setDate(dep.date || todayDhakaDate);
    setPaymentMethod(dep.paymentMethod || 'Cash');
    setNotes(dep.notes || '');
    setFormError('');
    setEditingDeposit(dep);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const num = Number.parseFloat(amount);
    if (Number.isNaN(num) || num <= 0) {
      setFormError('Please enter a valid positive deposit amount.');
      return;
    }
    const memberName = members.find((m) => m.id === memberId)?.displayName || 'Member';
    if (editingDeposit) {
      await updateDeposit({
        ...editingDeposit,
        memberId,
        memberName,
        amount: num,
        date,
        paymentMethod,
        notes: notes.trim(),
      });
      setEditingDeposit(null);
    } else {
      await addDeposit({
        memberId,
        memberName,
        amount: num,
        date,
        paymentMethod,
        notes: notes.trim(),
      });
      setShowAddModal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-8">
          <div>
            <div className="text-xs font-medium text-[#85736D] dark:text-[#A08C86]">Total Central Deposits</div>
            <div className="mt-1 font-display text-2xl font-bold font-mono tabular-nums text-[#2C5E8A] dark:text-[#98CBFA]">
              {formatCurrency(summary.totalDeposits)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-[#85736D] dark:text-[#A08C86]">Central Fund Remaining</div>
            <div className="mt-1 font-display text-2xl font-bold font-mono tabular-nums text-[#201A17] dark:text-[#EDE0DB]">
              {formatCurrency(summary.remainingFund)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-[#85736D] dark:text-[#A08C86]">Transactions</div>
            <div className="mt-1 font-display text-2xl font-bold font-mono tabular-nums text-[#201A17] dark:text-[#EDE0DB]">
              {deposits.length}
            </div>
          </div>
        </div>

        {isManager && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Record Member Deposit</span>
          </button>
        )}
      </div>

      {/* Member Contributions Summary */}
      <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl p-6 space-y-4">
        <h2 className="font-display text-base font-bold text-[#201A17] dark:text-[#EDE0DB]">
          Member Deposit Totals
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {summary.memberSettlements.map((s) => (
            <div
              key={s.memberId}
              className="p-4 rounded-lg border border-[#E8D9D3] dark:border-[#3E322D] flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[#201A17] dark:text-[#EDE0DB] truncate">{s.memberName}</div>
                <div className="text-xs text-[#85736D] dark:text-[#A08C86] font-mono tabular-nums">
                  {deposits.filter((d) => d.memberId === s.memberId).length} deposit(s)
                </div>
              </div>
              <div className="font-mono tabular-nums font-bold text-[#201A17] dark:text-[#EDE0DB] shrink-0">
                {formatCurrency(s.totalDeposit)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chronological Deposit Ledger */}
      <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl overflow-hidden">
        {deposits.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-[#52443E] dark:text-[#D7C3BC]">No deposits recorded yet.</p>
            {isManager && (
              <button
                type="button"
                onClick={openAdd}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record First Deposit</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E8D9D3] dark:border-[#3E322D] bg-[#F4DFD7]/35 dark:bg-[#352A25]/60 text-xs font-medium text-[#85736D] dark:text-[#A08C86]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  {isManager && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8D9D3] dark:divide-[#3E322D]">
                {deposits.map((dep) => (
                  <tr key={dep.id} className="hover:bg-[#F4DFD7]/35 dark:hover:bg-[#352A25]/50">
                    <td className="py-3.5 px-4 font-mono tabular-nums text-[#52443E] dark:text-[#D7C3BC] whitespace-nowrap">
                      {formatReadableDate(dep.date)}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#201A17] dark:text-[#EDE0DB] whitespace-nowrap">
                      {dep.memberName}
                    </td>
                    <td className="py-3.5 px-4 text-[#52443E] dark:text-[#D7C3BC] whitespace-nowrap">
                      {dep.paymentMethod}
                    </td>
                    <td className="py-3.5 px-4 text-[#52443E] dark:text-[#D7C3BC] max-w-md truncate">
                      {dep.notes || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-[#2C5E8A] dark:text-[#98CBFA] whitespace-nowrap">
                      {formatCurrency(dep.amount)}
                    </td>
                    {isManager && (
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Edit deposit for ${dep.memberName}`}
                            onClick={() => openEdit(dep)}
                            className="p-1.5 text-[#85736D] dark:text-[#A08C86] hover:text-[#201A17] dark:hover:text-[#EDE0DB] rounded hover:bg-[#F4DFD7]/50 dark:hover:bg-[#352A25] cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete deposit for ${dep.memberName}`}
                            onClick={() => setDeletingDeposit(dep)}
                            className="p-1.5 text-[#85736D] dark:text-[#A08C86] hover:text-rose-700 dark:hover:text-[#FFB4AB] rounded hover:bg-rose-50 dark:hover:bg-[#93000A]/30 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Deposit Modal */}
      {(showAddModal || editingDeposit) && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-[#201A17]/40 dark:bg-black/65 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-[#201A17] dark:text-[#EDE0DB]">
                {editingDeposit ? 'Edit Member Deposit' : 'Record Member Deposit'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingDeposit(null);
                }}
                aria-label="Close deposit modal"
                className="p-1 text-[#85736D] dark:text-[#A08C86] hover:text-[#201A17] dark:hover:text-[#EDE0DB] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-[#93000A]/40 border border-rose-200 dark:border-[#93000A] text-xs text-rose-800 dark:text-[#FFDAD6]">
                {formError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label htmlFor="dep-member" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Member
                </label>
                <select
                  id="dep-member"
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="dep-amount" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Deposit Amount (৳)
                </label>
                <input
                  id="dep-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 3000"
                  className="w-full px-3 py-2 text-sm font-mono border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                  required
                />
              </div>

              <div>
                <label htmlFor="dep-date" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Date
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="dep-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm font-mono border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setDate(todayDhakaDate)}
                    className="px-2.5 py-2 text-xs font-medium bg-[#F4DFD7]/50 dark:bg-[#352A25] hover:bg-[#F4DFD7] dark:hover:bg-[#463832] text-[#201A17] dark:text-[#EDE0DB] rounded-lg cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setDate(shiftDate(todayDhakaDate, -1))}
                    className="px-2.5 py-2 text-xs font-medium bg-[#F4DFD7]/50 dark:bg-[#352A25] hover:bg-[#F4DFD7] dark:hover:bg-[#463832] text-[#201A17] dark:text-[#EDE0DB] rounded-lg cursor-pointer"
                  >
                    Yesterday
                  </button>
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1.5">
                  Payment Channel
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {PAYMENT_METHODS.map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-1.5 px-2 text-xs font-medium rounded-lg border cursor-pointer ${
                        paymentMethod === method
                          ? 'bg-[#C05621] text-white border-[#C05621] dark:bg-[#FFB59A] dark:text-[#5F1B00] dark:border-[#FFB59A]'
                          : 'bg-white dark:bg-[#1A1412] text-[#52443E] dark:text-[#D7C3BC] border-[#85736D]/50 dark:border-[#52443E] hover:bg-[#F4DFD7]/35 dark:hover:bg-[#352A25]'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="dep-notes" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Notes / Reference (Optional)
                </label>
                <input
                  id="dep-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Monthly advance"
                  className="w-full px-3 py-2 text-sm border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingDeposit(null);
                }}
                className="px-4 py-2 text-sm font-medium text-[#52443E] dark:text-[#D7C3BC] border border-[#85736D]/50 dark:border-[#52443E] rounded-lg hover:bg-[#F4DFD7]/40 dark:hover:bg-[#352A25] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] rounded-lg cursor-pointer"
              >
                {editingDeposit ? 'Save Changes' : 'Save Deposit'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Deposit Confirmation */}
      {deletingDeposit && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-[#201A17]/40 dark:bg-black/65 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display font-bold text-[#201A17] dark:text-[#EDE0DB]">Delete Deposit?</h3>
            <p className="text-sm text-[#52443E] dark:text-[#D7C3BC]">
              Remove deposit of <strong>{formatCurrency(deletingDeposit.amount)}</strong> for{' '}
              <strong>{deletingDeposit.memberName}</strong>? This action is recorded in the audit
              trail.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingDeposit(null)}
                className="px-4 py-2 text-sm font-medium text-[#52443E] dark:text-[#D7C3BC] border border-[#85736D]/50 dark:border-[#52443E] rounded-lg hover:bg-[#F4DFD7]/40 dark:hover:bg-[#352A25] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = deletingDeposit;
                  setDeletingDeposit(null);
                  await deleteDeposit(target);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg cursor-pointer"
              >
                Delete Deposit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
