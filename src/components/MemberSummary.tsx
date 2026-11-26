import React, { useMemo } from 'react';
import { Users } from 'lucide-react';
import { Member, MemberSettlement } from '../types/mess';
import { formatCurrency } from '../utils/dhakaTime';
import { buildMemberSummaryRows, roundTwoDecimals } from '../utils/messCalculations';

interface MemberSummaryProps {
  settlements: MemberSettlement[];
  members: Member[];
  mealRate: number;
  currentMemberId?: string;
  onOpenSettlement: () => void;
}

function formatUnits(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function MemberSummary({
  settlements,
  members,
  mealRate,
  currentMemberId,
  onOpenSettlement,
}: MemberSummaryProps) {
  const rows = useMemo(
    () =>
      buildMemberSummaryRows({
        settlements,
        members,
        currentMemberId,
      }),
    [settlements, members, currentMemberId]
  );

  const totals = useMemo(() => {
    let deposits = 0;
    let units = 0;
    let balance = 0;
    for (const row of rows) {
      deposits += row.totalDeposit;
      units += row.totalUnits;
      balance += row.netBalance;
    }
    return {
      deposits: roundTwoDecimals(deposits),
      units: roundTwoDecimals(units),
      balance: roundTwoDecimals(balance),
    };
  }, [rows]);

  const activeCount = rows.filter((r) => r.isActive).length;

  return (
    <section
      aria-label="Member Summary"
      className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-2xl overflow-hidden min-w-0"
    >
      <div className="px-5 py-4 border-b border-[#E8D9D3] dark:border-[#3E322D] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#FFDBCF]/70 dark:bg-[#842B00]/60 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-[#C05621] dark:text-[#FFB59A]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-base font-bold text-[#201A17] dark:text-[#EDE0DB]">
              Member Summary
            </h3>
            <p className="text-xs text-[#85736D] dark:text-[#A08C86] font-mono tabular-nums">
              {activeCount} active member{activeCount === 1 ? '' : 's'} · Rate:{' '}
              {formatCurrency(mealRate)} / meal
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenSettlement}
          className="text-xs font-semibold text-[#C05621] hover:text-[#A3471B] dark:text-[#FFB59A] dark:hover:text-[#FFDBCF] whitespace-nowrap shrink-0 cursor-pointer"
        >
          Full Settlement &rarr;
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-[#85736D] dark:text-[#A08C86]">
          No members in this mess yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table aria-label="Member summary table" className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E8D9D3] dark:border-[#3E322D] bg-[#F4DFD7]/35 dark:bg-[#352A25]/60 text-xs font-medium text-[#85736D] dark:text-[#A08C86]">
                <th className="py-3 px-4 sm:px-5">Member</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Total Deposits</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Meals Eaten</th>
                <th className="py-3 px-4 sm:px-5 text-right whitespace-nowrap">Balance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8D9D3] dark:divide-[#3E322D]">
              {rows.map((row) => {
                const statusColor =
                  row.status === 'REFUNDABLE'
                    ? 'text-[#0D7351] dark:text-[#89D6B7]'
                    : row.status === 'PAYABLE'
                      ? 'text-[#BA1A1A] dark:text-[#FFB4AB]'
                      : 'text-[#52443E] dark:text-[#D7C3BC]';

                const statusText =
                  row.status === 'SETTLED'
                    ? 'Settled ৳0'
                    : row.status === 'REFUNDABLE'
                      ? `Refundable +${formatCurrency(row.netBalance)}`
                      : `Payable -${formatCurrency(Math.abs(row.netBalance))}`;

                const hasExtraCharges = row.utilityCost + row.sharedBillsUnpaid > 0;

                return (
                  <tr
                    key={row.memberId}
                    className={
                      row.isCurrentUser
                        ? 'bg-[#FFDBCF]/25 dark:bg-[#842B00]/20'
                        : 'hover:bg-[#F4DFD7]/25 dark:hover:bg-[#352A25]/45'
                    }
                  >
                    <td className="py-3.5 px-4 sm:px-5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-[#201A17] dark:text-[#EDE0DB] truncate">
                          {row.memberName}
                        </span>
                        {row.isCurrentUser && (
                          <span className="text-[11px] font-bold text-[#C05621] dark:text-[#FFB59A] shrink-0">
                            (You)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#85736D] dark:text-[#A08C86]">
                        {row.room
                          ? /^room\b/i.test(row.room)
                            ? row.room
                            : `Rm ${row.room}`
                          : 'No room'}
                        {!row.isActive && ' · Inactive'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-[#2C5E8A] dark:text-[#98CBFA] whitespace-nowrap">
                      {formatCurrency(row.totalDeposit)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="font-semibold text-[#201A17] dark:text-[#EDE0DB]">
                        {formatUnits(row.totalUnits)} u
                      </div>
                      <div className="text-[11px] text-[#85736D] dark:text-[#A08C86]">
                        {row.guestUnits > 0
                          ? `${formatUnits(row.memberUnits)}M + ${formatUnits(row.guestUnits)}G · `
                          : ''}
                        {formatCurrency(row.mealCost)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 sm:px-5 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className={`font-bold ${statusColor}`}>{statusText}</div>
                      <div className="text-[11px] text-[#85736D] dark:text-[#A08C86]">
                        {hasExtraCharges
                          ? `Total cost ${formatCurrency(row.totalCost)}`
                          : `Meal cost ${formatCurrency(row.mealCost)}`}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#E8D9D3] dark:border-[#3E322D] bg-[#F4DFD7]/30 dark:bg-[#352A25]/50 text-xs font-semibold">
                <td className="py-3 px-4 sm:px-5 text-[#52443E] dark:text-[#D7C3BC]">
                  Total ({rows.length} member{rows.length === 1 ? '' : 's'})
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-[#2C5E8A] dark:text-[#98CBFA] whitespace-nowrap">
                  {formatCurrency(totals.deposits)}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-[#201A17] dark:text-[#EDE0DB] whitespace-nowrap">
                  {formatUnits(totals.units)} u
                </td>
                <td
                  className={`py-3 px-4 sm:px-5 text-right font-mono tabular-nums whitespace-nowrap ${
                    Math.abs(totals.balance) < 0.01
                      ? 'text-[#52443E] dark:text-[#D7C3BC]'
                      : totals.balance > 0
                        ? 'text-[#0D7351] dark:text-[#89D6B7]'
                        : 'text-[#BA1A1A] dark:text-[#FFB4AB]'
                  }`}
                >
                  {Math.abs(totals.balance) < 0.01
                    ? 'Net ৳0'
                    : totals.balance > 0
                      ? `Net +${formatCurrency(totals.balance)}`
                      : `Net -${formatCurrency(Math.abs(totals.balance))}`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
