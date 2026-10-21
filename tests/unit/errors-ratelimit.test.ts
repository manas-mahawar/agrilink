import { describe, expect, it } from 'vitest';
import { businessCode, GENERIC_ERROR, toUserMessage } from '@/domain/errors';
import { rateLimit, resetRateLimits } from '@/lib/rate-limit';

describe('database error messages', () => {
  it('uses the hint of business-rule errors', () => {
    const e = { code: 'P0001', message: 'QUANTITY_ABOVE_MAXIMUM', hint: 'The maximum order for this listing is 50 quintals.' };
    expect(businessCode(e)).toBe('QUANTITY_ABOVE_MAXIMUM');
    expect(toUserMessage(e)).toBe('The maximum order for this listing is 50 quintals.');
  });
  it('never leaks raw constraint or SQL text', () => {
    expect(toUserMessage({ code: '23514', message: 'new row violates check constraint "listing_window"' })).not.toMatch(/constraint/);
    expect(toUserMessage({ code: 'XX000', message: 'relation "secret" does not exist' })).toBe(GENERIC_ERROR);
    expect(toUserMessage({ code: '42501', message: 'permission denied for table profiles' })).toBe('You do not have permission to do that.');
  });
});

describe('rate limiter', () => {
  it('blocks after the limit within the window and resets after it', () => {
    resetRateLimits();
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit('k', 3, 1000, t).ok).toBe(true);
    expect(rateLimit('k', 3, 1000, t + 10).ok).toBe(false);
    expect(rateLimit('k', 3, 1000, t + 1001).ok).toBe(true);
  });
});
