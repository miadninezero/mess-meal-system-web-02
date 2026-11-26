import React, { useState } from 'react';
import { Copy, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useAsyncAction } from '../../hooks/useAsyncAction';
import { useMess } from '../../context/MessContext';
import { UtilityBill } from '../../types/mess';
import { formatCurrency, formatTimestampDhaka } from '../../utils/dhakaTime';
import { generateSettlementReportText } from '../../utils/messCalculations';
import { ExportReportButtons } from '../ExportReportButtons';

export function SettlementView() {
  const {
    currentMess,
    members,
    utilityBills,
    auditLogs,
    summary,
    todayDhakaDate,
    isManager,
    addUtilityBill,
    updateUtilityBill,
    deleteUtilityBill,
    updateMemberStatus,
    setActiveNav,
    showUiMessage,
  } = useMess();

  const [showAddBillModal, setShowAddBillModal] = useState(false);
  const [editingBill, setEditingBill] = useState<UtilityBill | null>(null);
  const [billTitle, setBillTitle] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billError, setBillError] = useState('');
  const { run: runBillAction, isPending: isBillActionPending } = useAsyncAction();

  const handleCopyReport = async () => {
    const text = generateSettlementReportText({
      messName: currentMess?.name || 'Mess',
      activeMonth: currentMess?.activeMonth || '',
      summary,
      todayDhakaDate,
    });
    try {
      await navigator.clipboard.writeText(text);
      showUiMessage('Settlement report copied to clipboard.');
    } catch {
      showUiMessage('Unable to access clipboard.', 'error');
    }
  };

  const openAddBill = () => {
    setBillTitle('');
    setBillAmount('');
    setBillError('');
    setShowAddBillModal(true);
  };

  const openEditBill = (bill: UtilityBill) => {
    setBillTitle(bill.title);
    setBillAmount(String(bill.amount));
    setBillError('');
    setEditingBill(bill);
  };

  const handleSaveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBillActionPending('saveBill')) return;
    setBillError('');
    const num = Number.parseFloat(billAmount);
    if (!billTitle.trim() || Number.isNaN(num) || num < 0) {
      setBillError('Please enter a valid title and amount.');
      return;
    }
    const result = await runBillAction('saveBill', async () => {
      if (editingBill) {
        await updateUtilityBill({ ...editingBill, title: billTitle.trim(), amount: num });
        setEditingBill(null);
      } else {
        await addUtilityBill(billTitle.trim(), num);
        setShowAddBillModal(false);
      }
    });
    void result;
  };

  return (
    <div className="space-y-6">
      {/* Financial Overview Banner */}
      <div className="bg-[#FFDBCF] dark:bg-[#842B00] border border-[#F2C3B2] dark:border-[#A3471B] text-[#381400] dark:text-[#FFDBCF] rounded-2xl p-4 sm:p-6 space-y-5 sm:space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-medium text-[#52443E] dark:text-[#FFDBCF]/80">
              Monthly Reconciliation · {currentMess?.name} ({currentMess?.activeMonth})
            </div>
            <h2 className="mt-1 font-display text-xl sm:text-2xl font-bold text-[#381400] dark:text-[#FFDBCF]">
              Mess Balance &amp; Final Settlement
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto max-w-full">
            <button
              type="button"
              onClick={handleCopyReport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Copy Report</span>
            </button>
            <ExportReportButtons variant="banner" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t border-[#F2C3B2] dark:border-[#A3471B]/60">
          <div>
            <div className="text-xs text-[#52443E] dark:text-[#FFDBCF]/80">Final Meal Rate</div>
            <div className="mt-1 font-mono tabular-nums text-lg font-bold text-[#C05621] dark:text-[#FFB59A]">
              {formatCurrency(summary.mealRate)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#52443E] dark:text-[#FFDBCF]/80">Confirmed Units</div>
            <div className="mt-1 font-mono tabular-nums text-lg font-bold text-[#201A17] dark:text-[#EDE0DB]">
              {summary.totalUnits}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#52443E] dark:text-[#FFDBCF]/80">Total Bazaar</div>
            <div className="mt-1 font-mono tabular-nums text-lg font-bold text-[#201A17] dark:text-[#EDE0DB]">
              {formatCurrency(summary.totalBazaarCost)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#52443E] dark:text-[#FFDBCF]/80">Fixed Utilities</div>
            <div className="mt-1 font-mono tabular-nums text-lg font-bold text-[#201A17] dark:text-[#EDE0DB]">
              {formatCurrency(summary.totalUtilities)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#52443E] dark:text-[#FFDBCF]/80">Total Deposits</div>
            <div className="mt-1 font-mono tabular-nums text-lg font-bold text-[#201A17] dark:text-[#EDE0DB]">
              {formatCurrency(summary.totalDeposits)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#52443E] dark:text-[#FFDBCF]/80">Central Fund Left</div>
            <div
              className={`mt-1 font-mono tabular-nums text-lg font-bold ${
                summary.remainingFund >= 0
                  ? 'text-[#0D7351] dark:text-[#89D6B7]'
                  : 'text-[#BA1A1A] dark:text-[#FFB4AB]'
              }`}
            >
              {formatCurrency(summary.remainingFund)}
            </div>
          </div>
        </div>
      </div>

      {/* Member-by-Member Settlement Table */}
      <section className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl overflow-hidden">
        <div className="p-6 border-b border-[#E8D9D3] dark:border-[#3E322D] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-[#201A17] dark:text-[#EDE0DB]">
              Member-by-Member Settlement
            </h3>
            <p className="text-xs text-[#85736D] dark:text-[#A08C86]">
              Net Balance = Deposit − (Meal Cost + Equal Utility Share + Unpaid Shared Bills)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveNav('bills')}
            className="text-xs font-semibold text-[#C05621] dark:text-[#FFB59A] hover:text-[#A3471B] dark:hover:text-[#FFDBCF] cursor-pointer"
          >
            Manage Shared Bills &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E8D9D3] dark:border-[#3E322D] bg-[#F4DFD7]/35 dark:bg-[#352A25]/60 text-xs font-medium text-[#85736D] dark:text-[#A08C86]">
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4 text-right">Units</th>
                <th className="py-3 px-4 text-right">Meal Cost</th>
                <th className="py-3 px-4 text-right">Utilities</th>
                <th className="py-3 px-4 text-right">Unpaid Bills</th>
                <th className="py-3 px-4 text-right">Total Cost</th>
                <th className="py-3 px-4 text-right">Deposited</th>
                <th className="py-3 px-4 text-right">Net Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8D9D3] dark:divide-[#3E322D]">
              {summary.memberSettlements.map((s) => {
                const memObj = members.find((m) => m.id === s.memberId);
                const isActive = memObj?.isActive !== false;
                return (
                  <tr key={s.memberId} className="hover:bg-[#F4DFD7]/35 dark:hover:bg-[#352A25]/50">
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-[#201A17] dark:text-[#EDE0DB]">{s.memberName}</div>
                      <div className="text-xs text-[#85736D] dark:text-[#A08C86] flex items-center gap-2">
                        <span>{isActive ? 'Active' : 'Inactive (No utility split)'}</span>
                        {isManager && memObj && (
                          <button
                            type="button"
                            onClick={() => updateMemberStatus(memObj.id, !isActive)}
                            className="text-[#C05621] dark:text-[#FFB59A] hover:underline cursor-pointer"
                          >
                            {isActive ? 'Set Inactive' : 'Set Active'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#52443E] dark:text-[#D7C3BC]">
                      <div>{s.totalUnits}</div>
                      {s.guestUnits > 0 && (
                        <div className="text-[11px] text-[#85736D] dark:text-[#A08C86]">
                          {s.memberUnits}M + {s.guestUnits}G
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#52443E] dark:text-[#D7C3BC]">
                      {formatCurrency(s.mealCost)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#52443E] dark:text-[#D7C3BC]">
                      {formatCurrency(s.utilityCost)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#52443E] dark:text-[#D7C3BC]">
                      {formatCurrency(s.sharedBillsUnpaid)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-[#201A17] dark:text-[#EDE0DB]">
                      {formatCurrency(s.totalCost)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#52443E] dark:text-[#D7C3BC]">
                      {formatCurrency(s.totalDeposit)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                      <span
                        className={
                          s.netBalance >= 0
                            ? 'text-[#0D7351] dark:text-[#89D6B7]'
                            : 'text-rose-700 dark:text-[#FFB4AB]'
                        }
                      >
                        {s.netBalance >= 0 ? 'Refund +' : 'Payable -'}
                        {formatCurrency(Math.abs(s.netBalance))}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Fixed Monthly Utility Bills */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-bold text-[#201A17] dark:text-[#EDE0DB]">
                Fixed Utility Bills
              </h3>
              <p className="text-xs text-[#85736D] dark:text-[#A08C86]">
                Cook salary, gas, and fixed bills split equally among active members
              </p>
            </div>
            {isManager && (
              <button
                type="button"
                onClick={openAddBill}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Bill</span>
              </button>
            )}
          </div>

          {utilityBills.length === 0 ? (
            <p className="text-sm text-[#85736D] dark:text-[#A08C86] py-4 text-center">No utility bills added yet.</p>
          ) : (
            <div className="divide-y divide-[#E8D9D3] dark:divide-[#3E322D]">
              {utilityBills.map((u) => (
                <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#201A17] dark:text-[#EDE0DB] truncate">{u.title}</div>
                    <div className="text-xs text-[#85736D] dark:text-[#A08C86] font-mono">{u.month}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono tabular-nums font-semibold text-[#201A17] dark:text-[#EDE0DB]">
                      {formatCurrency(u.amount)}
                    </span>
                    {isManager && (
                      <>
                        <button
                          type="button"
                          aria-label={`Edit utility bill ${u.title}`}
                          onClick={() => openEditBill(u)}
                          className="p-1 text-[#85736D] dark:text-[#A08C86] hover:text-[#201A17] dark:hover:text-[#EDE0DB] rounded cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete utility bill ${u.title}`}
                          onClick={() => deleteUtilityBill(u)}
                          className="p-1 text-[#85736D] dark:text-[#A08C86] hover:text-rose-700 dark:hover:text-[#FFB4AB] rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Immutable Audit Log */}
        <div className="lg:col-span-7 bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl p-6 space-y-4">
          <div>
            <h3 className="font-display text-base font-bold text-[#201A17] dark:text-[#EDE0DB]">
              Financial &amp; Operations Audit Trail
            </h3>
            <p className="text-xs text-[#85736D] dark:text-[#A08C86]">
              Immutable ledger history of overrides, deposits, bill updates, and role changes
            </p>
          </div>

          {auditLogs.length === 0 ? (
            <p className="text-sm text-[#85736D] dark:text-[#A08C86] py-4 text-center">No audit events recorded yet.</p>
          ) : (
            <div className="divide-y divide-[#E8D9D3] dark:divide-[#3E322D] max-h-80 overflow-y-auto pr-1">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-3 space-y-1 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-[#201A17] dark:text-[#EDE0DB]">
                      {log.action}
                    </span>
                    <span className="font-mono text-xs text-[#85736D] dark:text-[#A08C86] tabular-nums">
                      {formatTimestampDhaka(log.timestampMs)}
                    </span>
                  </div>
                  <p className="text-xs text-[#52443E] dark:text-[#D7C3BC]">{log.details}</p>
                  <div className="text-xs text-[#85736D] dark:text-[#A08C86]">
                    By {log.performedByName}
                    {log.reason ? ` · Reason: ${log.reason}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Add / Edit Utility Bill Modal */}
      {(showAddBillModal || editingBill) && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-[#201A17]/40 dark:bg-black/65 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveBill}
            className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-[#201A17] dark:text-[#EDE0DB]">
                {editingBill ? 'Edit Utility Bill' : 'Add Fixed Utility Bill'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddBillModal(false);
                  setEditingBill(null);
                }}
                aria-label="Close utility bill modal"
                className="p-1 text-[#85736D] dark:text-[#A08C86] hover:text-[#201A17] dark:hover:text-[#EDE0DB] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {billError && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-[#93000A]/40 border border-rose-200 dark:border-[#93000A] text-xs text-rose-800 dark:text-[#FFDAD6]">
                {billError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label htmlFor="ub-title" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Bill Title
                </label>
                <input
                  id="ub-title"
                  type="text"
                  value={billTitle}
                  onChange={(e) => setBillTitle(e.target.value)}
                  placeholder="e.g. Cook Salary, Gas, Water"
                  className="w-full px-3 py-2 text-sm border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                  required
                />
              </div>
              <div>
                <label htmlFor="ub-amount" className="block text-xs font-medium text-[#52443E] dark:text-[#D7C3BC] mb-1">
                  Total Amount (৳)
                </label>
                <input
                  id="ub-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  placeholder="e.g. 3500"
                  className="w-full px-3 py-2 text-sm font-mono border border-[#85736D]/50 dark:border-[#52443E] rounded-lg"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isBillActionPending('saveBill')}
                onClick={() => {
                  setShowAddBillModal(false);
                  setEditingBill(null);
                }}
                className="px-4 py-2 text-sm font-medium text-[#52443E] dark:text-[#D7C3BC] border border-[#85736D]/50 dark:border-[#52443E] rounded-lg hover:bg-[#F4DFD7]/40 dark:hover:bg-[#352A25] disabled:opacity-60 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isBillActionPending('saveBill')}
                aria-busy={isBillActionPending('saveBill')}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:hover:bg-[#F2A386] dark:text-[#5F1B00] disabled:opacity-60 disabled:cursor-not-allowed rounded-lg cursor-pointer"
              >
                {isBillActionPending('saveBill')
                  ? 'Saving...'
                  : editingBill
                    ? 'Save Changes'
                    : 'Add Utility Bill'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
