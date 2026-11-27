import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { useMess } from '../../context/MessContext';
import { BAZAAR_CATEGORIES, BazaarExpense } from '../../types/mess';
import { formatCurrency, formatReadableDate, shiftDate } from '../../utils/dhakaTime';
import { ConflictAlert } from '../ConflictAlert';

export function BazaarLogView() {
  const {
    authUser,
    members,
    bazaarExpenses,
    summary,
    todayDhakaDate,
    isManager,
    currentMember,
    syncRevision,
    addBazaarExpense,
    updateBazaarExpense,
    deleteBazaarExpense,
  } = useMess();

  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<BazaarExpense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<BazaarExpense | null>(null);

  // Add/Edit form fields
  const [buyerMemberId, setBuyerMemberId] = useState(
    currentMember?.id || members[0]?.id || authUser?.uid || ''
  );
  const [amount, setAmount] = useState('');
  const [itemsDescription, setItemsDescription] = useState('');
  const [category, setCategory] = useState<string>('Groceries');
  const [date, setDate] = useState(todayDhakaDate);
  const [formError, setFormError] = useState('');
  const { run: runBazaarAction, isPending: isBazaarActionPending } = useAsyncAction();

  const openAddModal = () => {
    setBuyerMemberId(currentMember?.id || members[0]?.id || authUser?.uid || '');
    setAmount('');
    setItemsDescription('');
    setCategory('Groceries');
    setDate(todayDhakaDate);
    setFormError('');
    setShowAddModal(true);
  };

  const openEditModal = (exp: BazaarExpense) => {
    setBuyerMemberId(exp.buyerMemberId);
    setAmount(String(exp.amount));
    setItemsDescription(exp.itemsDescription);
    setCategory(exp.category || 'Groceries');
    setDate(exp.date || todayDhakaDate);
    setFormError('');
    setEditingExpense(exp);
  };

  useEffect(() => {
    if (!editingExpense) return;
    const latest = bazaarExpenses.find((exp) => exp.id === editingExpense.id);
    if (!latest) {
      setEditingExpense(null);
      return;
    }
    setEditingExpense(latest);
    setBuyerMemberId(latest.buyerMemberId);
    setAmount(String(latest.amount));
    setItemsDescription(latest.itemsDescription);
    setCategory(latest.category || 'Groceries');
    setDate(latest.date || todayDhakaDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncRevision]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBazaarActionPending('saveBazaar')) return;
    setFormError('');
    const numAmount = Number.parseFloat(amount);
    if (Number.isNaN(numAmount) || numAmount <= 0) {
      setFormError('Please enter a valid positive amount.');
      return;
    }
    if (!itemsDescription.trim()) {
      setFormError('Please describe the purchased items.');
      return;
    }
    const resolvedBuyerId = buyerMemberId || currentMember?.id || members[0]?.id || authUser?.uid || '';
    const buyerObj = members.find((m) => m.id === resolvedBuyerId);
    const buyerName = buyerObj?.displayName || authUser?.displayName || 'Member';

    const res = await runBazaarAction('saveBazaar', async () => {
      if (editingExpense) {
        return updateBazaarExpense({
          ...editingExpense,
          buyerMemberId: resolvedBuyerId,
          buyerName,
          amount: numAmount,
          itemsDescription: itemsDescription.trim(),
          category,
          date,
        });
      }
      return addBazaarExpense({
        buyerMemberId: resolvedBuyerId,
        buyerName,
        amount: numAmount,
        itemsDescription: itemsDescription.trim(),
        category,
        date,
      });
    });

    if (res.value) {
      if (editingExpense) {
        setEditingExpense(null);
      } else {
        setShowAddModal(false);
      }
    }
  };

  const filteredExpenses =
    categoryFilter === 'All'
      ? bazaarExpenses
      : bazaarExpenses.filter((e) => e.category === categoryFilter);

  const filteredTotal = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header Summary Bar */}
      <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-8">
          <div>
            <div className="text-xs font-medium text-[#85736D] dark:text-[#A08C86]">Total Bazaar Cost</div>
            <div className="mt-1 font-display text-2xl font-bold font-mono tabular-nums text-[#201A17] dark:text-[#EDE0DB]">
              {formatCurrency(summary.totalBazaarCost)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-[#85736D] dark:text-[#A08C86]">Filtered Subtotal</div>
            <div className="mt-1 font-display text-2xl font-bold font-mono tabular-nums text-[#C05621] dark:text-[#FFB59A]">
              {formatCurrency(filteredTotal)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-[#85736D] dark:text-[#A08C86]">Entries</div>
            <div className="mt-1 font-display text-2xl font-bold font-mono tabular-nums text-[#201A17] dark:text-[#EDE0DB]">
              {filteredExpenses.length}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Log Bazaar Expense</span>
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F4DFD7]/60 dark:bg-[#352A25] rounded-lg w-fit">
        {['All', ...BAZAAR_CATEGORIES].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              categoryFilter === cat
                ? 'bg-white dark:bg-[#221B18] text-[#201A17] dark:text-[#EDE0DB] shadow-sm'
                : 'text-[#52443E] dark:text-[#D7C3BC] hover:text-[#201A17] dark:hover:text-[#EDE0DB]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Expenses Table */}
      <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-[#52443E] dark:text-[#D7C3BC]">
              No bazaar expenses recorded{categoryFilter !== 'All' ? ` under ${categoryFilter}` : ''}.
            </p>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log First Expense</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E8D9D3] dark:border-[#3E322D] bg-[#F4DFD7]/35 dark:bg-[#352A25]/60 text-xs font-medium text-[#85736D] dark:text-[#A08C86]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Buyer</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Items Description</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8D9D3] dark:divide-[#3E322D]">
                {filteredExpenses.map((exp) => {
                  const canModify =
                    isManager ||
                    exp.buyerMemberId === authUser?.uid ||
                    exp.buyerMemberId === currentMember?.id;

                  return (
                    <tr key={exp.id} className="hover:bg-[#F4DFD7]/35 dark:hover:bg-[#352A25]/50">
                      <td className="py-3.5 px-4 font-mono tabular-nums text-[#52443E] dark:text-[#D7C3BC] whitespace-nowrap">
                        {formatReadableDate(exp.date)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#201A17] dark:text-[#EDE0DB] whitespace-nowrap">
                        {exp.buyerName}
                      </td>
                      <td className="py-3.5 px-4 text-[#52443E] dark:text-[#D7C3BC] whitespace-nowrap">
                        {exp.category}
                      </td>
                      <td className="py-3.5 px-4 text-[#52443E] dark:text-[#D7C3BC] max-w-md">
                        {exp.itemsDescription}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-[#201A17] dark:text-[#EDE0DB] whitespace-nowrap">
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {canModify ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Edit bazaar expense ${exp.itemsDescription}`}
                              onClick={() => openEditModal(exp)}
                              className="p-1.5 text-[#85736D] dark:text-[#A08C86] hover:text-[#201A17] dark:hover:text-[#EDE0DB] rounded hover:bg-[#F4DFD7]/50 dark:hover:bg-[#352A25] cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete bazaar expense ${exp.itemsDescription}`}
                              onClick={() => setDeletingExpense(exp)}
                              className="p-1.5 text-[#85736D] dark:text-[#A08C86] hover:text-rose-700 dark:hover:text-[#FFB4AB] rounded hover:bg-rose-50 dark:hover:bg-[#93000A]/30 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-[#85736D] dark:text-[#A08C86]">Locked</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {(showAddModal || editingExpense) && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-[#201A17]/40 dark:bg-black/65 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-[#201A17] dark:text-[#EDE0DB]">
                {editingExpense ? 'Edit Bazaar Expense' : 'Log Bazaar Expense'}
              </h3>
              <button
                type="button"
                disabled={isBazaarActionPending('saveBazaar')}
                onClick={() => {
                  setShowAddModal(false);
                  setEditingExpense(null);
                }}
                aria-label="Close bazaar modal"
                className="p-1 text-[#85736D] dark:text-[#A08C86] hover:text-[#201A17] dark:hover:text-[#EDE0DB] disabled:opacity-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editingExpense && <ConflictAlert compact />}

            {formError && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-[#93000A]/40 border border-rose-200 dark:border-[#93000A] text-xs text-rose-800 dark:text-[#FFDAD6]">
                {formError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label htmlFor="baz-buyer" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Shopper / Buyer
                </label>
                <select
                  id="baz-buyer"
                  value={buyerMemberId}
                  onChange={(e) => setBuyerMemberId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="baz-amount" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                    Amount (৳)
                  </label>
                  <input
                    id="baz-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 1250"
                    className="w-full px-3 py-2 text-sm font-mono border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="baz-cat" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                    Category
                  </label>
                  <select
                    id="baz-cat"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                  >
                    {BAZAAR_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="baz-date" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Purchase Date
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="baz-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="flex-1 min-w-[140px] px-3 py-2 text-sm font-mono border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
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
                <label htmlFor="baz-items" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Items Description
                </label>
                <textarea
                  id="baz-items"
                  rows={3}
                  value={itemsDescription}
                  onChange={(e) => setItemsDescription(e.target.value)}
                  placeholder="e.g. Rohu fish 2kg, potatoes 3kg, oil 1L"
                  className="w-full px-3 py-2 text-sm border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isBazaarActionPending('saveBazaar')}
                onClick={() => {
                  setShowAddModal(false);
                  setEditingExpense(null);
                }}
                className="px-4 py-2 text-sm font-medium text-[#52443E] dark:text-[#D7C3BC] border border-[#85736D]/50 dark:border-[#52443E] rounded-lg hover:bg-[#F4DFD7]/40 dark:hover:bg-[#352A25] disabled:opacity-60 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isBazaarActionPending('saveBazaar')}
                aria-busy={isBazaarActionPending('saveBazaar')}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] disabled:opacity-60 disabled:cursor-not-allowed rounded-lg cursor-pointer"
              >
                {isBazaarActionPending('saveBazaar')
                  ? 'Saving...'
                  : editingExpense
                    ? 'Save Changes'
                    : 'Save Expense'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingExpense && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-[#201A17]/40 dark:bg-black/65 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display font-bold text-[#201A17] dark:text-[#EDE0DB]">Delete Bazaar Expense?</h3>
            <p className="text-sm text-[#52443E] dark:text-[#D7C3BC]">
              Remove <strong>{deletingExpense.itemsDescription}</strong> (
              {formatCurrency(deletingExpense.amount)})? This will immediately recalculate the
              mess meal rate.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isBazaarActionPending('deleteBazaar')}
                onClick={() => setDeletingExpense(null)}
                className="px-4 py-2 text-sm font-medium text-[#52443E] dark:text-[#D7C3BC] border border-[#85736D]/50 dark:border-[#52443E] rounded-lg hover:bg-[#F4DFD7]/40 dark:hover:bg-[#352A25] disabled:opacity-60 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBazaarActionPending('deleteBazaar')}
                aria-busy={isBazaarActionPending('deleteBazaar')}
                onClick={async () => {
                  const id = deletingExpense.id;
                  const res = await runBazaarAction('deleteBazaar', () => deleteBazaarExpense(id));
                  if (res.value) {
                    setDeletingExpense(null);
                  }
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg cursor-pointer"
              >
                {isBazaarActionPending('deleteBazaar') ? 'Deleting...' : 'Delete Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
