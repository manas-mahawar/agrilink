# Payments plan (Razorpay) — not active

**Today AgriLink takes no payments.** Buyer and farmer settle directly; every order shows
"Settled directly between buyer and farmer". Nothing in the app collects card, UPI or bank
details. This document describes what is already prepared and what remains, so online
payment can be added safely later.

## What is already built (inactive)

* **Tables:** `payments` (one per checkout attempt, linked to an order, amount in paise),
  `payment_events` (every webhook, unique per provider event id), `refunds`.
* **`orders.payment_status`** can be changed **only** by `apply_payment_event()`, which only
  the server's secret key can call. No user — not even an admin through the app — can mark
  an order paid.
* **`apply_payment_event()`** is idempotent (a repeated webhook is recorded once and returns
  `duplicate`), rejects events whose signature was not verified, ignores unknown orders and
  **flags** an amount mismatch instead of marking the order paid.
* **Webhook route** `POST /api/payments/razorpay/webhook`: returns 404 unless
  `PAYMENTS_ENABLED=true` and `RAZORPAY_WEBHOOK_SECRET` are set; verifies the
  `X-Razorpay-Signature` HMAC-SHA256 over the raw body in constant time; uses the
  `X-Razorpay-Event-Id` header for idempotency; then calls `apply_payment_event()`.
  Unit tests cover the signature check (`tests/unit/razorpay.test.ts`); database tests cover
  idempotency and amount mismatch (`tests/db/rls.test.ts`).

## What remains before switching on

1. **Business and legal:** a Razorpay account in the business's name, KYC, and a decision on
   the model. Collecting money on behalf of farmers (marketplace / escrow-like flows) needs
   Razorpay **Route** or a similar product and may have regulatory implications — get advice
   before building it. The simplest first step is buyer → farmer payment links with AgriLink
   only recording the status.
2. **Create order (server):** a Server Action that, for a *confirmed* order the buyer owns,
   creates a Razorpay order with `amount = orders.total_paise`, stores a `payments` row with
   the `provider_order_id`, and returns only the public order id and key id to the browser.
3. **Checkout (browser):** open Razorpay Checkout with that order id. The success callback
   only shows "Payment received — confirming…". **It is never treated as proof of payment.**
4. **Webhook (server):** subscribe to `payment.captured`, `payment.failed`, `refund.processed`
   in the Razorpay dashboard, pointing at `https://YOUR-DOMAIN/api/payments/razorpay/webhook`
   with the webhook secret. Extend `apply_payment_event()` for refunds.
5. **CSP:** add `https://checkout.razorpay.com` to `script-src`/`frame-src` and
   `https://api.razorpay.com` to `connect-src` in `next.config.ts`; drop `payment=()` from
   the Permissions-Policy.
6. **Reconciliation:** a daily job comparing captured payments with Razorpay's settlement
   report; an admin page listing flagged events.
7. **Tests:** end-to-end with Razorpay test mode keys, including a replayed webhook, a forged
   signature, and an amount mismatch.

## Environment variables

`PAYMENTS_ENABLED`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` — all
server-only; never prefix them with `NEXT_PUBLIC_`.
