import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Razorpay webhook signature check: HMAC-SHA256 of the exact raw request body, keyed with
 * the webhook secret, hex-encoded, compared in constant time. The body must not be parsed
 * and re-serialised before checking.
 */
export function verifyRazorpaySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  const given = Buffer.from(signature, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
