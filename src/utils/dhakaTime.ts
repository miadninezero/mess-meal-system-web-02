const DHAKA_TIMEZONE = 'Asia/Dhaka';

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function getDhakaParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: DHAKA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  const hourRaw = Number.parseInt(get('hour'), 10);
  const hour = hourRaw === 24 ? 0 : hourRaw;

  return {
    year: Number.parseInt(get('year'), 10),
    month: Number.parseInt(get('month'), 10),
    day: Number.parseInt(get('day'), 10),
    hour,
    minute: Number.parseInt(get('minute'), 10),
    second: Number.parseInt(get('second'), 10),
    weekday: get('weekday'),
  };
}

export function getTodayDhakaDate(now: Date = new Date()): string {
  const p = getDhakaParts(now);
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function getCurrentDhakaMonth(now: Date = new Date()): string {
  return getTodayDhakaDate(now).slice(0, 7);
}

export function getCurrentDhakaClock12Hour(now: Date = new Date()): string {
  const p = getDhakaParts(now);
  return format12Hour(`${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`);
}

export function getDhakaTimeHHmm(now: Date = new Date()): string {
  const p = getDhakaParts(now);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

export function getDhakaDateTime(now: Date = new Date()): string {
  return `${getTodayDhakaDate(now)}T${getDhakaTimeHHmm(now)}`;
}

export function isFriday(dateString: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) return false;
  const [y, m, d] = dateString.trim().split('-').map(Number);
  // Asia/Dhaka is permanently UTC+6:00. Noon Dhaka is 06:00 UTC.
  const utcDate = new Date(Date.UTC(y, m - 1, d, 6, 0, 0));
  if (Number.isNaN(utcDate.getTime())) return false;
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: DHAKA_TIMEZONE,
    weekday: 'short',
  }).format(utcDate);
  return weekday === 'Fri';
}

export function getWeekdayName(dateString: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) return '';
  const [y, m, d] = dateString.trim().split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d, 6, 0, 0));
  if (Number.isNaN(utcDate.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: DHAKA_TIMEZONE,
    weekday: 'long',
  }).format(utcDate);
}

/**
 * Checks whether the booking deadline has passed for a specific date and HH:mm deadline in Asia/Dhaka.
 */
export function isDeadlinePassed(
  dateString: string,
  deadlineHHmm: string,
  now: Date = new Date()
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) return true;
  const [y, m, d] = dateString.trim().split('-').map(Number);
  const parts = deadlineHHmm.split(':');
  const hour = Number.parseInt(parts[0] ?? '9', 10);
  const minute = Number.parseInt(parts[1] ?? '0', 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return true;

  // Target deadline in UTC: Dhaka local time minus 6 hours
  const targetUtcMs = Date.UTC(y, m - 1, d, hour - 6, minute, 0, 0);
  return now.getTime() > targetUtcMs;
}

export function format12Hour(deadlineHHmm: string): string {
  const parts = deadlineHHmm.split(':');
  const hour = Number.parseInt(parts[0] ?? '', 10);
  const minute = Number.parseInt(parts[1] ?? '', 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return deadlineHHmm;

  const amPm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${amPm}`;
}

export function formatReadableDate(dateString: string): string {
  if (!dateString || !dateString.trim()) return '';
  const trimmed = dateString.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return dateString;
  const [y, m, d] = trimmed.split('-').map(Number);
  const monthLabel = MONTHS_SHORT[m - 1];
  if (!monthLabel) return dateString;
  return `${String(d).padStart(2, '0')} ${monthLabel} ${y}`;
}

export function shiftDate(dateString: string, days: number): string {
  const trimmed = dateString.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return dateString;
  const [y, m, d] = trimmed.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 6, 0, 0));
  if (Number.isNaN(dt.getTime())) return dateString;
  return getTodayDhakaDate(dt);
}

export function formatTimestampDhaka(timestampMs?: number): string {
  if (!timestampMs) return 'Just now';
  const p = getDhakaParts(new Date(timestampMs));
  const monthLabel = MONTHS_SHORT[p.month - 1] ?? '';
  const amPm = p.hour >= 12 ? 'PM' : 'AM';
  const displayHour = p.hour === 0 ? 12 : p.hour > 12 ? p.hour - 12 : p.hour;
  return `${String(p.day).padStart(2, '0')} ${monthLabel}, ${String(displayHour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')} ${amPm}`;
}

export function formatCurrency(amount: number): string {
  const rounded = Math.round((amount + (amount >= 0 ? 1e-9 : -1e-9)) * 100) / 100;
  return `৳${rounded.toLocaleString('en-US', {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
