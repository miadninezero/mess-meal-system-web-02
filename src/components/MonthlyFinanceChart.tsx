import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { BazaarExpense, Deposit } from '../types/mess';
import { formatCurrency } from '../utils/dhakaTime';
import {
  MonthlyFinanceComparison,
  computeMonthlyBazaarVsDeposits,
} from '../utils/messCalculations';

interface MonthlyFinanceChartProps {
  bazaarExpenses: BazaarExpense[];
  deposits: Deposit[];
  referenceDate: string;
}

function formatAxisCurrency(value: number): string {
  if (value === 0) return '৳0';
  if (Math.abs(value) >= 1000) {
    const k = value / 1000;
    return `৳${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return `৳${value}`;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    payload?: MonthlyFinanceComparison;
  }>;
}

function CustomFinanceTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  const isPositiveNet = item.netBalance >= 0;

  return (
    <div className="rounded-xl border border-[#E8D9D3] dark:border-[#3E322D] bg-white dark:bg-[#221B18] px-3.5 py-2.5 shadow-md text-xs space-y-1.5 min-w-[180px]">
      <div className="font-display font-bold text-[#201A17] dark:text-[#EDE0DB]">
        {item.fullLabel}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-[#52443E] dark:text-[#D7C3BC]">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#C05621] dark:bg-[#FFB59A]" />
            Bazaar Expenses
          </span>
          <span className="font-mono tabular-nums font-semibold text-[#201A17] dark:text-[#EDE0DB]">
            {formatCurrency(item.bazaarExpenses)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-[#52443E] dark:text-[#D7C3BC]">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#0D7351] dark:bg-[#89D6B7]" />
            Member Deposits
          </span>
          <span className="font-mono tabular-nums font-semibold text-[#201A17] dark:text-[#EDE0DB]">
            {formatCurrency(item.memberDeposits)}
          </span>
        </div>
      </div>
      <div className="pt-1 border-t border-[#E8D9D3] dark:border-[#3E322D] flex items-center justify-between gap-4">
        <span className="text-[#85736D] dark:text-[#A08C86]">Monthly Net</span>
        <span
          className={`font-mono tabular-nums font-bold ${
            isPositiveNet
              ? 'text-[#0D7351] dark:text-[#89D6B7]'
              : 'text-[#BA1A1A] dark:text-[#FFB4AB]'
          }`}
        >
          {isPositiveNet ? '+' : '-'}
          {formatCurrency(Math.abs(item.netBalance))}
        </span>
      </div>
    </div>
  );
}

export function MonthlyFinanceChart({
  bazaarExpenses,
  deposits,
  referenceDate,
}: MonthlyFinanceChartProps) {
  const { isDark } = useTheme();

  const data = useMemo(
    () =>
      computeMonthlyBazaarVsDeposits({
        bazaarExpenses,
        deposits,
        referenceDate,
        monthCount: 6,
      }),
    [bazaarExpenses, deposits, referenceDate]
  );

  const sixMonthBazaar = useMemo(
    () => data.reduce((sum, item) => sum + item.bazaarExpenses, 0),
    [data]
  );
  const sixMonthDeposits = useMemo(
    () => data.reduce((sum, item) => sum + item.memberDeposits, 0),
    [data]
  );

  const hasAnyData = sixMonthBazaar > 0 || sixMonthDeposits > 0;

  const bazaarColor = isDark ? '#FFB59A' : '#C05621';
  const depositColor = isDark ? '#89D6B7' : '#0D7351';
  const gridColor = isDark ? '#3E322D' : '#E8D9D3';
  const axisTextColor = isDark ? '#A08C86' : '#85736D';

  return (
    <section
      aria-label="6-Month Bazaar Expenses vs Member Deposits Chart"
      className="bg-white dark:bg-[#221B18] border border-[#E8D9D3] dark:border-[#3E322D] rounded-2xl p-5 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold text-[#201A17] dark:text-[#EDE0DB]">
            6-Month Bazaar vs Deposits
          </h3>
          <p className="text-xs text-[#85736D] dark:text-[#A08C86]">
            Monthly comparison of total bazaar expenses versus member deposits ({data[0]?.fullLabel}{' '}
            – {data[data.length - 1]?.fullLabel})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div>
            <span className="text-[#85736D] dark:text-[#A08C86]">6M Bazaar: </span>
            <span className="font-mono tabular-nums font-bold text-[#C05621] dark:text-[#FFB59A]">
              {formatCurrency(sixMonthBazaar)}
            </span>
          </div>
          <div>
            <span className="text-[#85736D] dark:text-[#A08C86]">6M Deposits: </span>
            <span className="font-mono tabular-nums font-bold text-[#0D7351] dark:text-[#89D6B7]">
              {formatCurrency(sixMonthDeposits)}
            </span>
          </div>
        </div>
      </div>

      <div className="h-64 sm:h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: -4, bottom: 0 }}
            barGap={6}
            barCategoryGap="24%"
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: axisTextColor, fontSize: 12 }}
              dy={6}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={formatAxisCurrency}
              tick={{ fill: axisTextColor, fontSize: 11 }}
              width={56}
            />
            <Tooltip
              cursor={{ fill: isDark ? 'rgba(255, 181, 154, 0.08)' : 'rgba(192, 86, 33, 0.06)' }}
              content={<CustomFinanceTooltip />}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="square"
              iconSize={10}
              wrapperStyle={{
                paddingBottom: 12,
                fontSize: '12px',
                color: isDark ? '#D7C3BC' : '#52443E',
              }}
            />
            <Bar
              dataKey="bazaarExpenses"
              name="Bazaar Expenses"
              fill={bazaarColor}
              radius={[6, 6, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              dataKey="memberDeposits"
              name="Member Deposits"
              fill={depositColor}
              radius={[6, 6, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {!hasAnyData && (
        <p className="text-xs text-center text-[#85736D] dark:text-[#A08C86]">
          No bazaar expenses or deposits logged across the last 6 months yet.
        </p>
      )}
    </section>
  );
}
