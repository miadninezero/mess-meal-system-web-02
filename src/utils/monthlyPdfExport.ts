import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  MonthlyExportReport,
  formatPdfCurrency,
  getExportFilename,
} from './monthlyExport';

function formatUnits(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function downloadMonthlyCsv(report: MonthlyExportReport, csvContent: string): void {
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = getExportFilename(report.activeMonth, 'csv');
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadMonthlyPdf(report: MonthlyExportReport): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 36;

  // Header Banner
  doc.setFillColor(192, 86, 33); // Warm terracotta #C05621
  doc.rect(0, 0, pageWidth, 74, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`${report.messName} — Monthly Meal & Expense Report`, margin, 32);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `Month: ${report.activeMonth}   |   Mess ID: ${report.messId || 'N/A'}   |   Generated: ${report.generatedReadableDate}`,
    margin,
    52
  );

  // Overview Summary Table
  autoTable(doc, {
    startY: 90,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [244, 223, 215],
      textColor: [56, 20, 0],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      textColor: [32, 26, 23],
      fontSize: 9,
    },
    head: [
      [
        'Meal Rate',
        'Total Meals',
        'Bazaar Expenses',
        'Fixed Utilities',
        'Shared Bills',
        'Total Deposits',
      ],
    ],
    body: [
      [
        `${formatPdfCurrency(report.summary.mealRate)} / u`,
        `${formatUnits(report.totals.totalUnits)} u`,
        formatPdfCurrency(report.totals.totalBazaar),
        formatPdfCurrency(report.totals.totalUtilities),
        formatPdfCurrency(report.totals.totalSharedBills),
        formatPdfCurrency(report.totals.totalDeposits),
      ],
    ],
  });

  // Member Meal & Balance Summary
  const afterOverviewY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? 145;

  doc.setTextColor(32, 26, 23);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Member Meal Summary & Balance', margin, afterOverviewY + 22);

  autoTable(doc, {
    startY: afterOverviewY + 30,
    margin: { left: margin, right: margin },
    theme: 'striped',
    headStyles: {
      fillColor: [192, 86, 33],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: {
      textColor: [32, 26, 23],
      fontSize: 8.5,
    },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold' },
    },
    head: [
      [
        'Member',
        'Meals (u)',
        'Meal Cost',
        'Utilities',
        'Unpaid Bills',
        'Total Cost',
        'Deposited',
        'Balance Status',
      ],
    ],
    body:
      report.memberRows.length === 0
        ? [['No members recorded for this month', '-', '-', '-', '-', '-', '-', '-']]
        : report.memberRows.map((row) => {
            const statusText =
              row.status === 'SETTLED'
                ? 'Settled (Tk 0.00)'
                : row.status === 'REFUNDABLE'
                  ? `Refund +${formatPdfCurrency(row.netBalance)}`
                  : `Payable ${formatPdfCurrency(row.netBalance)}`;
            return [
              `${row.memberName}${row.room ? ` (${row.room})` : ''}${!row.isActive ? ' [Inactive]' : ''}`,
              row.guestUnits > 0
                ? `${formatUnits(row.totalUnits)} (${formatUnits(row.memberUnits)}+${formatUnits(row.guestUnits)}G)`
                : formatUnits(row.totalUnits),
              formatPdfCurrency(row.mealCost),
              formatPdfCurrency(row.utilityCost),
              formatPdfCurrency(row.sharedBillsUnpaid),
              formatPdfCurrency(row.totalCost),
              formatPdfCurrency(row.totalDeposit),
              statusText,
            ];
          }),
  });

  // Bazaar Expenses Section
  const afterMembersY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? 260;

  doc.setTextColor(32, 26, 23);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Monthly Bazaar Expenses (${report.bazaarExpenses.length})`, margin, afterMembersY + 22);

  autoTable(doc, {
    startY: afterMembersY + 30,
    margin: { left: margin, right: margin },
    theme: 'striped',
    headStyles: {
      fillColor: [13, 115, 81],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: {
      textColor: [32, 26, 23],
      fontSize: 8.5,
    },
    columnStyles: {
      4: { halign: 'right', fontStyle: 'bold' },
    },
    head: [['Date', 'Buyer', 'Category', 'Items Description', 'Amount']],
    body:
      report.bazaarExpenses.length === 0
        ? [['-', '-', '-', 'No bazaar expenses recorded this month', 'Tk 0.00']]
        : [
            ...report.bazaarExpenses.map((exp) => [
              exp.date,
              exp.buyerName,
              exp.category,
              exp.itemsDescription,
              formatPdfCurrency(exp.amount),
            ]),
            ['', '', '', 'Total Bazaar Expenses', formatPdfCurrency(report.totals.totalBazaar)],
          ],
  });

  // Utilities & Shared Bills Section
  const afterBazaarY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    ?.finalY ?? 380;

  doc.setTextColor(32, 26, 23);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Fixed Utilities & Shared Bills', margin, afterBazaarY + 22);

  const billRows: string[][] = [
    ...report.utilityBills.map((u) => [
      'Fixed Utility',
      u.title,
      `Equal split (${u.month || report.activeMonth})`,
      formatPdfCurrency(u.amount),
      'Central Fund',
    ]),
    ...report.sharedBills.map((sb) => [
      'Shared Bill',
      sb.title,
      `${sb.allocationType}${sb.deadline ? ` · Due ${sb.deadline}` : ''}`,
      formatPdfCurrency(sb.totalAmount),
      `Collected ${formatPdfCurrency(sb.collected)} / Due ${formatPdfCurrency(sb.outstanding)}`,
    ]),
  ];

  autoTable(doc, {
    startY: afterBazaarY + 30,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [44, 94, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: {
      textColor: [32, 26, 23],
      fontSize: 8.5,
    },
    columnStyles: {
      3: { halign: 'right', fontStyle: 'bold' },
    },
    head: [['Type', 'Title', 'Details', 'Total Amount', 'Collection / Fund']],
    body:
      billRows.length === 0
        ? [['-', 'No utilities or shared bills recorded this month', '-', 'Tk 0.00', '-']]
        : billRows,
  });

  // Footer page numbering
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(133, 115, 109);
    doc.text(
      `Page ${i} of ${pageCount} · Mess Meal Record-Keeping Export (${report.activeMonth})`,
      margin,
      pageHeight - 20
    );
  }

  doc.save(getExportFilename(report.activeMonth, 'pdf'));
}
