// Input validation shared by forms (client) and server actions (server). The database
// enforces the same rules with constraints and functions; these give friendly messages early.
import { z } from 'zod';
import { AVAILABILITY_TYPES, QUALITY_GRADES } from './listings';
import { MAX_PRICE_PAISE, parseRupeesToPaise } from './money';
import { FULFILMENT_METHODS, ORDER_ACTIONS } from './orders';
import { UNITS } from './units';

export const BUYER_TYPES = ['retailer', 'restaurant', 'hotel', 'wholesaler', 'processor', 'other'] as const;
export const BUYER_TYPE_LABEL: Record<(typeof BUYER_TYPES)[number], string> = {
  retailer: 'Vegetable retailer',
  restaurant: 'Restaurant',
  hotel: 'Hotel',
  wholesaler: 'Wholesaler',
  processor: 'Food processor',
  other: 'Other business',
};
export const REPORT_REASONS = ['misleading', 'prohibited', 'spam', 'fraud', 'abusive', 'other'] as const;
export const REPORT_REASON_LABEL: Record<(typeof REPORT_REASONS)[number], string> = {
  misleading: 'Misleading information or photos',
  prohibited: 'Not allowed on AgriLink',
  spam: 'Spam or duplicate',
  fraud: 'Suspected fraud',
  abusive: 'Abusive behaviour',
  other: 'Something else',
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .transform((v) => (v ? v : undefined));

const phone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/[\s-]/g, '') : undefined))
  .refine((v) => v === undefined || /^\+?[0-9]{10,15}$/.test(v), 'Enter a mobile number with 10 digits (country code optional).');

/** "12", "12.5", "12.50" → number. More than two decimals is rejected. */
export const decimalQuantity = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim().replace(/,/g, ''))
    .refine((v) => /^\d{1,7}(\.\d{1,2})?$/.test(v), `${label}: enter a number with up to two decimals.`)
    .transform(Number)
    .refine((n) => n > 0, `${label} must be more than zero.`)
    .refine((n) => n <= 1_000_000, `${label} is too large.`);

const optionalDecimalQuantity = (label: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || String(v).trim() === '' ? undefined : String(v).trim().replace(/,/g, '')))
    .refine((v) => v === undefined || /^\d{1,7}(\.\d{1,2})?$/.test(v), `${label}: enter a number with up to two decimals.`)
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .refine((n) => n === undefined || n > 0, `${label} must be more than zero.`);

/** Rupee amount typed by a person → integer paise. */
export const rupeesToPaise = (label: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => parseRupeesToPaise(String(v)))
    .refine((p): p is number => p !== null, `${label}: enter an amount like 15 or 15.50.`)
    .refine((p) => (p ?? 0) > 0, `${label} must be more than zero.`)
    .refine((p) => (p ?? 0) <= MAX_PRICE_PAISE, `${label} is too large.`)
    .transform((p) => p as number);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.');
const optionalIsoDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Choose a valid date.');

// Trim and lower-case BEFORE validating: phones often add a trailing space after autocomplete.
const emailField = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.'));

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use at most 72 characters.')
  .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), 'Use letters and at least one number.');

export const registerSchema = z
  .object({
    accountType: z.enum(['farmer', 'buyer'], { message: 'Choose farmer or buyer.' }),
    displayName: z.string().trim().min(2, 'Enter your name.').max(80, 'Keep your name under 80 characters.'),
    email: emailField,
    password: passwordSchema,
    phone,
    district: optionalText(80),
    organisationName: optionalText(120),
    buyerType: z.enum(BUYER_TYPES).optional().or(z.literal('').transform(() => undefined)),
    acceptTerms: z.literal('on', { message: 'Please accept the terms to continue.' }),
  })
  .superRefine((v, ctx) => {
    if (v.accountType === 'buyer' && !v.organisationName) {
      ctx.addIssue({ code: 'custom', path: ['organisationName'], message: 'Enter your business name.' });
    }
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Enter your password.'),
});

export const forgotPasswordSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'The passwords do not match.' });

export const listingSchema = z
  .object({
    categoryId: z.string().min(1, 'Choose a category.'),
    produceName: z.string().trim().min(2, 'Enter the produce name.').max(60),
    variety: optionalText(60),
    description: optionalText(2000),
    unit: z.enum(UNITS),
    quantityTotal: decimalQuantity('Expected quantity'),
    minOrderQty: decimalQuantity('Minimum order'),
    maxOrderQty: optionalDecimalQuantity('Maximum order'),
    price: rupeesToPaise('Asking price'),
    availabilityType: z.enum(AVAILABILITY_TYPES),
    expectedHarvestDate: optionalIsoDate,
    availableUntil: optionalIsoDate,
    qualityGrade: z.enum(QUALITY_GRADES),
    qualityNotes: optionalText(500),
    localityId: z.string().min(1, 'Choose the village or nearest town.'),
    publish: z.enum(['draft', 'active']).default('active'),
  })
  .superRefine((v, ctx) => {
    if (v.minOrderQty > v.quantityTotal) {
      ctx.addIssue({ code: 'custom', path: ['minOrderQty'], message: 'The minimum order cannot be more than the expected quantity.' });
    }
    if (v.maxOrderQty !== undefined && v.maxOrderQty < v.minOrderQty) {
      ctx.addIssue({ code: 'custom', path: ['maxOrderQty'], message: 'The maximum order must be at least the minimum order.' });
    }
    if (v.maxOrderQty !== undefined && v.maxOrderQty > v.quantityTotal) {
      ctx.addIssue({ code: 'custom', path: ['maxOrderQty'], message: 'The maximum order cannot exceed the expected quantity.' });
    }
    if (v.availabilityType === 'pre_harvest' && !v.expectedHarvestDate) {
      ctx.addIssue({ code: 'custom', path: ['expectedHarvestDate'], message: 'Enter the expected harvest date.' });
    }
    if (v.availableUntil && v.expectedHarvestDate && v.availableUntil < v.expectedHarvestDate) {
      ctx.addIssue({ code: 'custom', path: ['availableUntil'], message: 'This must be on or after the harvest date.' });
    }
  });
export type ListingInput = z.infer<typeof listingSchema>;

export const offerSchema = z.object({
  listingId: z.uuid(),
  quantity: decimalQuantity('Quantity'),
  price: rupeesToPaise('Your price'),
  fulfilmentMethod: z.enum(FULFILMENT_METHODS),
  message: optionalText(500),
});

export const counterSchema = z.object({
  offerId: z.uuid(),
  version: z.coerce.number().int().positive(),
  quantity: decimalQuantity('Quantity'),
  price: rupeesToPaise('Price'),
  message: optionalText(500),
});

export const offerDecisionSchema = z.object({
  offerId: z.uuid(),
  version: z.coerce.number().int().positive(),
  reason: optionalText(300),
});

export const orderActionSchema = z
  .object({
    orderId: z.uuid(),
    action: z.enum(ORDER_ACTIONS),
    note: optionalText(500),
    fulfilmentDate: optionalIsoDate,
  })
  .superRefine((v, ctx) => {
    if (v.action === 'confirm' && !v.fulfilmentDate) {
      ctx.addIssue({ code: 'custom', path: ['fulfilmentDate'], message: 'Choose the pickup or delivery date.' });
    }
    if (v.action === 'cancel' && (!v.note || v.note.length < 3)) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Give a short reason for cancelling.' });
    }
  });

export const profileSchema = z.object({
  displayName: z.string().trim().min(2, 'Enter your name.').max(80),
  organisationName: optionalText(120),
  buyerType: z.enum(BUYER_TYPES).optional().or(z.literal('').transform(() => undefined)),
  district: optionalText(80),
  village: optionalText(80),
  bio: optionalText(600),
  phone,
});

export const reportSchema = z
  .object({
    listingId: z.uuid().optional().or(z.literal('').transform(() => undefined)),
    reportedUserId: z.uuid().optional().or(z.literal('').transform(() => undefined)),
    reason: z.enum(REPORT_REASONS, { message: 'Choose a reason.' }),
    details: optionalText(1000),
  })
  .refine((v) => Boolean(v.listingId) !== Boolean(v.reportedUserId), { message: 'Report one listing or one person.' });

export const reviewSchema = z.object({
  orderId: z.uuid(),
  rating: z.coerce.number().int().min(1, 'Choose a rating.').max(5),
  comment: optionalText(500),
});

export const dateSchema = isoDate;

/** Turn FormData into a plain object (last value wins; checkboxes are "on"). */
export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === 'string') out[k] = v;
  return out;
}

/** Field → first message, for rendering inline errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : '_form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
