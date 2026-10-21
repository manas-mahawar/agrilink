import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyRazorpaySignature } from '@/server/payments/razorpay';

const secret = 'whsec_test_only';
const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', amount: 3150000 } } } });
const sign = (b: string, s = secret) => createHmac('sha256', s).update(b).digest('hex');

describe('verifyRazorpaySignature', () => {
  it('accepts the exact body signed with the secret', () => {
    expect(verifyRazorpaySignature(body, sign(body), secret)).toBe(true);
  });
  it('rejects a modified body (e.g. a changed amount)', () => {
    expect(verifyRazorpaySignature(body.replace('3150000', '1'), sign(body), secret)).toBe(false);
  });
  it('rejects a signature made with another secret', () => {
    expect(verifyRazorpaySignature(body, sign(body, 'other'), secret)).toBe(false);
  });
  it('rejects missing, malformed or empty inputs', () => {
    expect(verifyRazorpaySignature(body, null, secret)).toBe(false);
    expect(verifyRazorpaySignature(body, 'not-hex', secret)).toBe(false);
    expect(verifyRazorpaySignature(body, sign(body), '')).toBe(false);
    expect(verifyRazorpaySignature(body, sign(body).slice(0, 62), secret)).toBe(false);
  });
});
