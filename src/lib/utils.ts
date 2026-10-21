import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const IST = 'Asia/Kolkata';
const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: IST });
const shortDateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: IST });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: IST,
});

/** "18 Nov 2026" (Indian date order, IST). Accepts ISO dates (YYYY-MM-DD) and timestamps. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return dateFmt.format(toDate(value));
}
export function formatShortDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return shortDateFmt.format(toDate(value));
}
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return dateTimeFmt.format(toDate(value));
}

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  // A plain date is a calendar day in India; anchor it at IST midday to avoid off-by-one.
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+05:30`) : new Date(value);
}

/** Today's date in India as YYYY-MM-DD. */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Whole days from today (IST) until the given date; negative when in the past. */
export function daysUntil(isoDate: string, now: Date = new Date()): number {
  const today = new Date(`${todayIST(now)}T00:00:00Z`).getTime();
  const target = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((target - today) / 86_400_000);
}

export function harvestLabel(isoDate: string | null | undefined, now: Date = new Date()): string {
  if (!isoDate) return 'Ready now';
  const d = daysUntil(isoDate, now);
  if (d < 0) return 'Harvesting now';
  if (d === 0) return 'Harvest today';
  if (d === 1) return 'Harvest tomorrow';
  if (d < 14) return `Harvest in ${d} days`;
  const weeks = Math.round(d / 7);
  return `Harvest in about ${weeks} weeks`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/** Safe internal redirect target: only relative paths on this site. */
export function safeNextPath(next: string | null | undefined, fallback = '/dashboard'): string {
  // A single leading slash, then no second slash/backslash, no whitespace or control
  // characters anywhere (browsers drop tabs/newlines, turning "/\t/evil.com" into "//evil.com").
  if (!next || next.length > 512 || !/^\/(?![/\\])[^\s\\\u0000-\u001f\u007f]*$/.test(next)) return fallback;
  return next;
}
