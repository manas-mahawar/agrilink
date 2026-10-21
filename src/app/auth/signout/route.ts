import { type NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

// POST only, so a link or image on another site can't sign people out. Next.js checks the
// Origin header for Server Actions but not Route Handlers, so we check it here.
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return new NextResponse('Forbidden', { status: 403 });
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: 'local' });
  }
  return NextResponse.redirect(new URL('/', request.nextUrl.origin), { status: 303 });
}
