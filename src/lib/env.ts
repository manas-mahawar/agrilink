// Public configuration (safe to ship to the browser). Values are inlined at build time.
// Secrets live in src/server/env.ts and are never imported by client code.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
// New Supabase projects issue a "publishable" key; older projects call it the "anon" key.
const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export const publicEnv = {
  supabaseUrl: url.replace(/\/+$/, ''),
  supabaseKey: key,
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  /** Shows demo banners and the "explore as demo farmer/buyer" buttons. Never grants access by itself. */
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === 'true',
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'mahawar.manas@gmail.com',
} as const;

/** False until a Supabase project is configured; the site then runs as a read-only preview. */
export const isSupabaseConfigured = Boolean(publicEnv.supabaseUrl && publicEnv.supabaseKey);

export function storagePublicUrl(bucket: 'listing-images' | 'avatars', path: string): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${bucket}/${encoded}`;
}
