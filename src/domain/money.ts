// Money is handled as integer paise (1 rupee = 100 paise) end to end. No floating point
// arithmetic is used for amounts that are stored or compared.

export const MAX_PRICE_PAISE = 10_000_000_000; // ₹10 crore per unit — a sanity ceiling, matches the database check.

const inrWhole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹1,55,000 or ₹15.50 — Indian digit grouping; paise shown only when non-zero. */
export function formatINR(paise: number): string {
  if (!Number.isFinite(paise)) return '—';
  const rupees = paise / 100;
  return paise % 100 === 0 ? inrWhole.format(rupees) : inrPaise.format(rupees);
}

/**
 * Parse a rupee amount typed by a person ("15", "15.5", "1,550.00", "₹ 16") into paise.
 * Returns null when the text is not a valid non-negative amount with at most two decimals.
 * Parsing is done on the string, so "0.1 + 0.2" style floating errors cannot occur.
 */
export function parseRupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, '').replace(/^rs\.?/i, '');
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = Number((m[2] ?? '').padEnd(2, '0'));
  return whole * 100 + frac;
}

/** Paise as a plain rupee string for form inputs ("15.50", "16"). */
export function paiseToRupeeInput(paise: number): string {
  const whole = Math.trunc(paise / 100);
  const frac = Math.abs(paise % 100);
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, '0')}`;
}

/**
 * Order total in paise for a quantity with up to two decimals, computed with integers
 * (BigInt) so large quantities × prices stay exact. Rounds half away from zero, like
 * PostgreSQL round() on numeric — the database value is authoritative; this is for display.
 */
export function totalPaise(quantity: number, pricePerUnitPaise: number): number {
  const hundredths = BigInt(Math.round(quantity * 100));
  const product = hundredths * BigInt(Math.round(pricePerUnitPaise));
  const rounded = (product + 50n) / 100n; // all values are positive
  return Number(rounded);
}

/** Percentage difference of `value` against `reference`, e.g. offer vs asking price. */
export function percentDifference(value: number, reference: number): number {
  if (reference === 0) return 0;
  return ((value - reference) / reference) * 100;
}
