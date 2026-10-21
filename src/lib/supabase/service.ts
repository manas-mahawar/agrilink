import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
import { serverEnv } from '@/server/env';

/**
 * Service-role client. BYPASSES Row Level Security — use only for trusted server-side jobs
 * that have already verified their input (for example a payment webhook whose signature
 * was checked). Never call it with user-controlled identifiers without authorisation checks.
 */
export function createServiceClient() {
  if (!serverEnv.supabaseSecretKey) throw new Error('SUPABASE_SECRET_KEY is not configured');
  return createClient(publicEnv.supabaseUrl, serverEnv.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
