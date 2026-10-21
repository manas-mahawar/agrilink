// Turn database / API errors into messages a person can act on. Business-rule errors from
// our SQL functions carry a stable code in `message` and the human text in `hint`.

export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
  hint?: string | null;
  details?: string | null;
}

export const GENERIC_ERROR = 'Something went wrong. Please try again.';

const KNOWN_CODES: Record<string, string> = {
  AUTH_REQUIRED: 'Please log in to continue.',
  OFFER_STALE: 'This offer changed while you were viewing it. Review the latest terms and try again.',
  NOT_YOUR_TURN: 'You are waiting for the other party to respond.',
};

/** Stable business code from one of our SQL functions, if any (e.g. "OFFER_STALE"). */
export function businessCode(error: DbErrorLike | null | undefined): string | null {
  const m = error?.message ?? '';
  return error?.code === 'P0001' && /^[A-Z][A-Z_]{2,40}$/.test(m) ? m : null;
}

export function toUserMessage(error: DbErrorLike | null | undefined): string {
  if (!error) return GENERIC_ERROR;
  const code = businessCode(error);
  if (code) return error.hint?.trim() || KNOWN_CODES[code] || GENERIC_ERROR;
  const msg = error.message ?? '';
  if (error.code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return 'You do not have permission to do that.';
  }
  if (error.code === '23505') return 'That already exists.';
  // Guard triggers raise readable sentences with these codes.
  if ((error.code === '23514' || error.code === 'P0001' || error.code === '23503') && msg && !/constraint|violates|null value/i.test(msg)) {
    return msg;
  }
  if (error.code === '23514') return 'Some of the values are not allowed. Check the form and try again.';
  if (error.code === 'PGRST116') return 'Not found.';
  return GENERIC_ERROR;
}
