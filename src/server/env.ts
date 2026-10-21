import 'server-only';

// Server-only secrets. Importing this file from a Client Component fails the build.

export const serverEnv = {
  /** Supabase secret (service role) key — used only by trusted server code (payment webhooks). */
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  /** Password shared by the seeded demo accounts in a DEMO project. Required for demo sign-in. */
  demoAccountPassword: process.env.DEMO_ACCOUNT_PASSWORD || '',
  /** Razorpay (not active yet — see docs/PAYMENTS_PLAN.md). */
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
} as const;

export const DEMO_ACCOUNTS = {
  farmer: process.env.DEMO_FARMER_EMAIL || 'demo.farmer@agrilink-demo.example.com',
  buyer: process.env.DEMO_BUYER_EMAIL || 'demo.buyer@agrilink-demo.example.com',
} as const;
