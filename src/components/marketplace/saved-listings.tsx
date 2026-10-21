'use client';

import { Heart } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, use, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { toggleFavorite } from '@/server/actions/favorites';
import { getBrowserClient } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';
import { isSupabaseConfigured } from '@/lib/env';

interface SavedState {
  ready: boolean;
  signedIn: boolean;
  isBuyer: boolean;
  ids: Set<string>;
  setSaved: (id: string, saved: boolean) => void;
}

const SavedContext = createContext<SavedState | null>(null);

/** Loads the signed-in buyer's saved listing ids once per page (RLS limits it to their own). */
export function SavedListingsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState({ ready: !isSupabaseConfigured, signedIn: false, isBuyer: false, ids: new Set<string>() });
  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getClaims();
      const sub = data?.claims?.sub;
      if (!sub) return !cancelled && setState((s) => ({ ...s, ready: true }));
      const [{ data: profile }, { data: favs }] = await Promise.all([
        supabase.from('profiles').select('account_type').eq('id', sub).maybeSingle(),
        supabase.from('favorites').select('listing_id'),
      ]);
      if (cancelled) return;
      setState({
        ready: true,
        signedIn: true,
        isBuyer: profile?.account_type === 'buyer',
        ids: new Set((favs ?? []).map((f) => f.listing_id as string)),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const setSaved = (id: string, saved: boolean) =>
    setState((s) => {
      const ids = new Set(s.ids);
      if (saved) ids.add(id);
      else ids.delete(id);
      return { ...s, ids };
    });
  return <SavedContext value={{ ...state, setSaved }}>{children}</SavedContext>;
}

export function SaveButton({ listingId, title, className, variant = 'overlay' }: { listingId: string; title: string; className?: string; variant?: 'overlay' | 'inline' }) {
  const ctx = use(SavedContext);
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const saved = ctx?.ids.has(listingId) ?? false;

  const onClick = () => {
    if (!ctx?.signedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname ?? '/marketplace')}`);
      return;
    }
    if (!ctx.isBuyer) {
      toast('Saving listings is for buyer accounts.');
      return;
    }
    ctx.setSaved(listingId, !saved);
    startTransition(async () => {
      const res = await toggleFavorite(listingId, !saved);
      if (!res.ok) {
        ctx.setSaved(listingId, saved);
        toast.error(res.error);
      } else {
        toast(saved ? 'Removed from saved listings' : 'Saved — find it in your dashboard');
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved listings` : `Save ${title}`}
      className={cn(
        'inline-flex items-center justify-center text-forest transition-colors disabled:opacity-70',
        variant === 'overlay'
          ? 'size-10 rounded-full bg-white/95 shadow-card hover:bg-white'
          : 'min-h-11 gap-2 rounded-md border border-line-strong bg-white px-4 text-[15px] font-semibold hover:border-forest',
        className,
      )}
    >
      <Heart className={cn('size-[18px]', saved && 'fill-current')} aria-hidden="true" />
      {variant === 'inline' ? (saved ? 'Saved' : 'Save') : null}
    </button>
  );
}
