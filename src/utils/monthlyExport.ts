import {
  BazaarExpense,
  DailyMealRecord,
  Deposit,
  Member,
  MemberSettlement,
  MessSummary,
  SharedBill,
  UtilityBill,
  getSharedBillStats,
} from '../types/mess';
import { formatReadableDate } from './dhakaTime';
import {
  MemberBalanceStatus,
  calculateSummary,
  getMemberBalanceStatus,
  roundTwoDecimals,
} from './messCalculations';

export interface MonthlyExportMemberRow extends MemberSettlement {
  room: string;
  isActive: boolean;
  status: MemberBalanceStatus;
}

export interface MonthlyExportSharedBillRow {
  id: string;
  title: string;
  allocationType: string;
  totalAmount: number;
  collected: number;
  outstanding: number;
  deadline: string;
}

export interface MonthlyExportCategoryRow {
  category: string;
  count: number;
  total: number;
}

export interface MonthlyExportReport {
  messName: string;
  messId: string;
  activeMonth: string;
  generatedDate: string;
  generatedReadableDate: string;
  summary: MessSummary;
  memberRows: MonthlyExportMemberRow[];
  bazaarExpenses: BazaarExpense[];
  utilityBills: UtilityBill[];
  sharedBills: MonthlyExportSharedBillRow[];
  categoryBreakdown: MonthlyExportCategoryRow[];
  totals: {
    totalUnits: number;
    totalBazaar: number;
    totalUtilities: number;
    totalSharedBills: number;
    totalSharedBillsCollected: number;
    totalSharedBillsOutstanding: number;
    totalDeposits: number;
    grandTotalExpenses: number;
    remainingFund: number;
  };
}

function matchesMonthPrefix(dateStr: string | undefined, monthPrefix: string): boolean {
  if (!monthPrefix) return true;
  return (dateStr || '').trim().startsWith(monthPrefix);
}

export function buildMonthlyExportReport(params: {
  messName: string;
  messId: string;
  activeMonth: string;
  todayDhakaDate: string;
  members: Member[];
  dailyMeals: DailyMealRecord[];
  bazaarExpenses: BazaarExpense[];
  deposits: Deposit[];
  utilityBills: UtilityBill[];
  sharedBills: SharedBill[];
  lunchDeadline?: string;
  nightDeadline?: string;
  now?: Date;
}): MonthlyExportReport {
  const {
    messName,
    messId,
    activeMonth,
    todayDhakaDate,
    members,
    dailyMeals,
    bazaarExpenses,
    deposits,
    utilityBills,
    sharedBills,
    lunchDeadline = '09:00',
    nightDeadline = '17:00',
    now,
  } = params;

  const targetMonth = (activeMonth || todayDhakaDate.slice(0, 7)).trim();

  const monthMeals = dailyMeals.filter((r) => matchesMonthPrefix(r.date || r.id, targetMonth));
  const monthBazaar = [...bazaarExpenses]
    .filter((b) => matchesMonthPrefix(b.date, targetMonth))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const monthDeposits = deposits.filter((d) => matchesMonthPrefix(d.date, targetMonth));
  const monthUtilities = utilityBills.filter((u) => !u.month || u.month === targetMonth);
  const monthSharedBillsRaw = sharedBills.filter((sb) => !sb.month || sb.month === targetMonth);

  const summary = calculateSummary({
    members,
    dailyMeals: monthMeals,
    bazaarExpenses: monthBazaar,
    deposits: monthDeposits,
    utilityBills: monthUtilities,
    sharedBills: monthSharedBillsRaw,
    lunchDeadline,
    nightDeadline,
    now,
  });

  const memberMap = new Map<string, Member>();
  for (const m of members) {
    memberMap.set(m.id, m);
  }

  const memberRows: MonthlyExportMemberRow[] = summary.memberSettlements
    .map((s) => {
      const m = memberMap.get(s.memberId);
      return {
        ...s,
        room: m?.room?.trim() || '',
        isActive: m?.isActive !== false,
        status: getMemberBalanceStatus(s.netBalance),
      };
    })
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.memberName.localeCompare(b.memberName);
    });

  const sharedBillsRows: MonthlyExportSharedBillRow[] = monthSharedBillsRaw.map((bill) => {
    const stats = getSharedBillStats(bill);
    return {
      id: bill.id,
      title: bill.title,
      allocationType: bill.allocationType,
      totalAmount: roundTwoDecimals(bill.totalAmount),
      collected: roundTwoDecimals(stats.totalCollected),
      outstanding: roundTwoDecimals(stats.outstandingBalance),
      deadline: bill.deadline || '',
    };
  });

  const categoryTotals = new Map<string, { count: number; total: number }>();
  for (const exp of monthBazaar) {
    const cat = exp.category?.trim() || 'Uncategorized';
    const current = categoryTotals.get(cat) ?? { count: 0, total: 0 };
    categoryTotals.set(cat, {
      count: current.count + 1,
      total: roundTwoDecimals(current.total + (exp.amount || 0)),
    });
  }

  const categoryBreakdown: MonthlyExportCategoryRow[] = Array.from(categoryTotals.entries())
    .map(([category, info]) => ({
      category,
      count: info.count,
      total: info.total,
    }))
    .sort((a, b) => b.total - a.total);

  const totalBazaar = roundTwoDecimals(summary.totalBazaarCost);
  const totalUtilities = roundTwoDecimals(summary.totalUtilities);
  const totalSharedBills = roundTwoDecimals(summary.totalSharedBills);
  const grandTotalExpenses = roundTwoDecimals(totalBazaar + totalUtilities + totalSharedBills);

  return {
    messName: messName || 'Mess Meal',
    messId: messId || '',
    activeMonth: targetMonth,
    generatedDate: todayDhakaDate,
    generatedReadableDate: formatReadableDate(todayDhakaDate),
    summary,
    memberRows,
    bazaarExpenses: monthBazaar,
    utilityBills: monthUtilities,
    sharedBills: sharedBillsRows,
    categoryBreakdown,
    totals: {
      totalUnits: summary.totalUnits,
      totalBazaar,
      totalUtilities,
      totalSharedBills,
      totalSharedBillsCollected: summary.totalSharedBillsCollected,
      totalSharedBillsOutstanding: summary.totalSharedBillsUnpaid,
      totalDeposits: summary.totalDeposits,
      grandTotalExpenses,
      remainingFund: summary.remainingFund,
    },
  };
}

export function sanitizeCsvCell(value: string | number): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '0';
  }
  const str = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function csvRow(cells: Array<string | number>): string {
  return cells.map((c) => sanitizeCsvCell(c)).join(',');
}

function formatStatusLabel(status: MonthlyExportMemberRow['status']): string {
  if (status === 'REFUNDABLE') return 'Refundable';
  if (status === 'PAYABLE') return 'Payable';
  return 'Settled';
}

export function formatMonthlyReportCsv(report: MonthlyExportReport): string {
  const lines: string[] = [];

  lines.push(csvRow(['Mess Monthly Meal Summary & Expenses Report']));
  lines.push(csvRow(['Mess Name', report.messName, 'Mess ID', report.messId]));
  lines.push(
    csvRow([
      'Billing Month',
      report.activeMonth,
      'Generated Date',
      report.generatedReadableDate,
    ])
  );
  lines.push('');

  lines.push(csvRow(['MONTHLY OVERVIEW']));
  lines.push(
    csvRow([
      'Meal Rate (BDT / unit)',
      report.summary.mealRate.toFixed(2),
      'Total Meal Units',
      report.totals.totalUnits,
    ])
  );
  lines.push(
    csvRow([
      'Total Bazaar Expenses (BDT)',
      report.totals.totalBazaar.toFixed(2),
      'Total Fixed Utilities (BDT)',
      report.totals.totalUtilities.toFixed(2),
    ])
  );
  lines.push(
    csvRow([
      'Total Shared Bills (BDT)',
      report.totals.totalSharedBills.toFixed(2),
      'Total Deposits (BDT)',
      report.totals.totalDeposits.toFixed(2),
    ])
  );
  lines.push(
    csvRow([
      'Grand Total Expenses (BDT)',
      report.totals.grandTotalExpenses.toFixed(2),
      'Central Fund Reserve (BDT)',
      report.totals.remainingFund.toFixed(2),
    ])
  );
  lines.push('');

  lines.push(csvRow(['MEMBER MEAL & BALANCE SUMMARY']));
  lines.push(
    csvRow([
      'Member',
      'Room',
      'Active',
      'Total Units',
      'Member Units',
      'Guest Units',
      'Meal Cost (BDT)',
      'Utility Share (BDT)',
      'Unpaid Shared Bills (BDT)',
      'Total Cost (BDT)',
      'Total Deposit (BDT)',
      'Net Balance (BDT)',
      'Status',
    ])
  );

  for (const row of report.memberRows) {
    lines.push(
      csvRow([
        row.memberName,
        row.room,
        row.isActive ? 'Yes' : 'No',
        row.totalUnits,
        row.memberUnits,
        row.guestUnits,
        row.mealCost.toFixed(2),
        row.utilityCost.toFixed(2),
        row.sharedBillsUnpaid.toFixed(2),
        row.totalCost.toFixed(2),
        row.totalDeposit.toFixed(2),
        row.netBalance.toFixed(2),
        formatStatusLabel(row.status),
      ])
    );
  }
  lines.push('');

  lines.push(csvRow(['MONTHLY BAZAAR EXPENSES']));
  lines.push(csvRow(['Date', 'Buyer', 'Category', 'Items Description', 'Amount (BDT)']));
  if (report.bazaarExpenses.length === 0) {
    lines.push(csvRow(['No bazaar expenses recorded for this month']));
  } else {
    for (const exp of report.bazaarExpenses) {
      lines.push(
        csvRow([
          exp.date,
          exp.buyerName,
          exp.category,
          exp.itemsDescription,
          exp.amount.toFixed(2),
        ])
      );
    }
    lines.push(csvRow(['Total Bazaar Expenses', '', '', '', report.totals.totalBazaar.toFixed(2)]));
  }
  lines.push('');

  lines.push(csvRow(['FIXED UTILITIES & SHARED BILLS']));
  lines.push(
    csvRow([
      'Type',
      'Title',
      'Details / Allocation',
      'Total Amount (BDT)',
      'Collected (BDT)',
      'Outstanding (BDT)',
    ])
  );
  if (report.utilityBills.length === 0 && report.sharedBills.length === 0) {
    lines.push(csvRow(['No fixed utilities or shared bills recorded for this month']));
  } else {
    for (const util of report.utilityBills) {
      lines.push(
        csvRow([
          'Fixed Utility',
          util.title,
          `Split equally (${util.month || report.activeMonth})`,
          util.amount.toFixed(2),
          'From Central Fund',
          '0.00',
        ])
      );
    }
    for (const sb of report.sharedBills) {
      lines.push(
        csvRow([
          'Shared Bill',
          sb.title,
          `${sb.allocationType}${sb.deadline ? ` | Due ${sb.deadline}` : ''}`,
          sb.totalAmount.toFixed(2),
          sb.collected.toFixed(2),
          sb.outstanding.toFixed(2),
        ])
      );
    }
  }

  return lines.join('\n');
}

export function formatPdfCurrency(amount: number): string {
  const num = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return num < 0 ? `-Tk ${formatted}` : `Tk ${formatted}`;
}

export function getExportFilename(activeMonth: string, ext: 'csv' | 'pdf'): string {
  const cleanMonth = (activeMonth || 'current-month').replace(/[^0-9A-Za-z_-]/g, '-');
  return `mess-meal-summary-${cleanMonth}.${ext}`;
}
