// Quantity units used on AgriLink. Indian mandis usually quote per quintal (100 kg).

export const UNITS = ['kg', 'quintal', 'tonne'] as const;
export type Unit = (typeof UNITS)[number];

export const KG_PER_UNIT: Record<Unit, number> = { kg: 1, quintal: 100, tonne: 1000 };

export const UNIT_LABEL: Record<Unit, { singular: string; plural: string; short: string }> = {
  kg: { singular: 'kg', plural: 'kg', short: 'kg' },
  quintal: { singular: 'quintal', plural: 'quintals', short: 'q' },
  tonne: { singular: 'tonne', plural: 'tonnes', short: 't' },
};

export const UNIT_HELP: Record<Unit, string> = {
  kg: 'Kilogram.',
  quintal: '1 quintal = 100 kg. Most mandis in Punjab quote prices per quintal.',
  tonne: '1 tonne = 1,000 kg = 10 quintals.',
};

const qtyFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export function formatQuantity(quantity: number, unit: Unit): string {
  const label = quantity === 1 ? UNIT_LABEL[unit].singular : UNIT_LABEL[unit].plural;
  return `${qtyFormatter.format(quantity)} ${label}`;
}

/** Convert a quantity between units (exact for the supported units). */
export function convertQuantity(quantity: number, from: Unit, to: Unit): number {
  return (quantity * KG_PER_UNIT[from]) / KG_PER_UNIT[to];
}

/** Price per kg in paise, rounded to the nearest paisa — used for "≈ ₹x/kg" hints. */
export function pricePerKgPaise(pricePerUnitPaise: number, unit: Unit): number {
  return Math.round(pricePerUnitPaise / KG_PER_UNIT[unit]);
}

export function isUnit(value: unknown): value is Unit {
  return typeof value === 'string' && (UNITS as readonly string[]).includes(value);
}
