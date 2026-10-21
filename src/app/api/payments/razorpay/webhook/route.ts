import { type NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { serverEnv } from '@/server/env';
import { verifyRazorpaySignature } from '@/server/payments/razorpay';

// Razorpay webhook receiver — INACTIVE until PAYMENTS_ENABLED=true and the webhook secret is
// set (see docs/PAYMENTS_PLAN.md). The browser checkout callback is never trusted; only
// signed webhooks change an order's payment status, and only through apply_payment_event().

export const dynamic = 'force-dynamic';
const MAX_BODY = 256 * 1024;

export async function POST(request: NextRequest) {
  if (process.env.PAYMENTS_ENABLED !== 'true' || !serverEnv.razorpayWebhookSecret) {
    return NextResponse.json({ error: 'Payments are not enabled.' }, { status: 404 });
  }
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });

  const verified = verifyRazorpaySignature(raw, request.headers.get('x-razorpay-signature'), serverEnv.razorpayWebhookSecret);
  if (!verified) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  let payload: { event?: string };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const eventId = request.headers.get('x-razorpay-event-id');
  if (!eventId || !payload.event) return NextResponse.json({ error: 'Missing event id' }, { status: 400 });

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('apply_payment_event', {
    p_provider: 'razorpay',
    p_provider_event_id: eventId.slice(0, 120),
    p_event_type: payload.event.slice(0, 80),
    p_payload: payload,
    p_signature_verified: true,
  });
  if (error) {
    console.error('[agrilink] payment event failed', { code: error.code });
    // 500 makes Razorpay retry; the event id keeps retries idempotent.
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
  return NextResponse.json({ result: data });
}
