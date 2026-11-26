import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { useMess } from '../context/MessContext';
import { getCurrentDhakaMonth } from '../utils/dhakaTime';
import { buildMonthlyExportReport, formatMonthlyReportCsv } from '../utils/monthlyExport';
import { downloadMonthlyCsv, downloadMonthlyPdf } from '../utils/monthlyPdfExport';

interface ExportReportButtonsProps {
  variant?: 'default' | 'banner';
}

export function ExportReportButtons({ variant = 'default' }: ExportReportButtonsProps) {
  const {
    currentMess,
    members,
    dailyMeals,
    bazaarExpenses,
    deposits,
    utilityBills,
    sharedBills,
    todayDhakaDate,
    showUiMessage,
  } = useMess();

  const [exportingType, setExportingType] = useState<'csv' | 'pdf' | null>(null);

  const activeMonth = currentMess?.activeMonth || getCurrentDhakaMonth();

  const report = useMemo(
    () =>
      buildMonthlyExportReport({
        messName: currentMess?.name || 'Mess Meal',
        messId: currentMess?.id || '',
        activeMonth,
        todayDhakaDate,
        members,
        dailyMeals,
        bazaarExpenses,
        deposits,
        utilityBills,
        sharedBills,
        lunchDeadline: currentMess?.lunchBookingDeadline || '09:00',
        nightDeadline: currentMess?.nightBookingDeadline || '17:00',
      }),
    [
      activeMonth,
      bazaarExpenses,
      currentMess,
      dailyMeals,
      deposits,
      members,
      sharedBills,
      todayDhakaDate,
      utilityBills,
    ]
  );

  const handleExportCsv = () => {
    try {
      setExportingType('csv');
      const csv = formatMonthlyReportCsv(report);
      downloadMonthlyCsv(report, csv);
      showUiMessage(`Exported ${report.activeMonth} meal summary & expenses as CSV.`);
    } catch (err) {
      showUiMessage(
        err instanceof Error ? err.message : 'Unable to generate CSV export.',
        'error'
      );
    } finally {
      setExportingType(null);
    }
  };

  const handleExportPdf = () => {
    try {
      setExportingType('pdf');
      downloadMonthlyPdf(report);
      showUiMessage(`Exported ${report.activeMonth} meal summary & expenses as PDF.`);
    } catch (err) {
      showUiMessage(
        err instanceof Error ? err.message : 'Unable to generate PDF export.',
        'error'
      );
    } finally {
      setExportingType(null);
    }
  };

  const secondaryBtnClass =
    variant === 'banner'
      ? 'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#381400] dark:text-[#FFDBCF] bg-[#FCFAF7]/85 dark:bg-[#221B18] hover:bg-[#FCFAF7] dark:hover:bg-[#352A25] border border-[#E8D9D3] dark:border-[#52443E] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60'
      : 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#201A17] dark:text-[#EDE0DB] bg-white dark:bg-[#221B18] hover:bg-[#F4DFD7]/50 dark:hover:bg-[#352A25] border border-[#E8D9D3] dark:border-[#3E322D] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60';

  const pdfBtnClass =
    variant === 'banner'
      ? 'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#381400] dark:text-[#FFDBCF] bg-[#FCFAF7]/85 dark:bg-[#221B18] hover:bg-[#FCFAF7] dark:hover:bg-[#352A25] border border-[#E8D9D3] dark:border-[#52443E] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60'
      : 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#C05621] hover:bg-[#A3471B] dark:bg-[#FFB59A] dark:text-[#5F1B00] dark:hover:bg-[#ffc7b2] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60';

  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={handleExportCsv}
        disabled={exportingType !== null}
        aria-label={`Export ${report.activeMonth} meal summary and expenses as CSV`}
        className={secondaryBtnClass}
      >
        <FileSpreadsheet
          className="w-3.5 h-3.5 text-[#0D7351] dark:text-[#89D6B7]"
          aria-hidden="true"
        />
        <span>{exportingType === 'csv' ? 'Exporting...' : 'Export CSV'}</span>
      </button>

      <button
        type="button"
        onClick={handleExportPdf}
        disabled={exportingType !== null}
        aria-label={`Export ${report.activeMonth} meal summary and expenses as PDF`}
        className={pdfBtnClass}
      >
        <FileText
          className={`w-3.5 h-3.5 ${
            variant === 'banner'
              ? 'text-[#C05621] dark:text-[#FFB59A]'
              : 'text-white dark:text-[#5F1B00]'
          }`}
          aria-hidden="true"
        />
        <span>{exportingType === 'pdf' ? 'Exporting...' : 'Export PDF'}</span>
      </button>
    </div>
  );
}
