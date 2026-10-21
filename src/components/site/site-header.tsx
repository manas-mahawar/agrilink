'use client';

import { Dialog as DialogPrimitive } from 'radix-ui';
import { Bell, LayoutDashboard, LogOut, Menu as MenuIcon, Shield, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, SheetContent } from '@/components/ui/overlays';
import { getBrowserClient } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';
import { HeaderLogo } from './logo';
import { MAIN_NAV } from './nav';
import { isSupabaseConfigured } from '@/lib/env';

interface HeaderUser {
  name: string;
  accountType: 'farmer' | 'buyer';
  isAdmin: boolean;
  unread: number;
}

/** Reads the session in the browser so public pages can stay static and cacheable. */
function useHeaderUser() {
  const [state, setState] = useState<{ loading: boolean; user: HeaderUser | null }>({ loading: isSupabaseConfigured, user: null });
  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return; // preview mode: no accounts (initial state already says so)
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.auth.getClaims();
      const sub = data?.claims?.sub;
      if (!sub) {
        if (!cancelled) setState({ loading: false, user: null });
        return;
      }
      const [{ data: profile }, { data: admin }, { count }] = await Promise.all([
        supabase.from('profiles').select('display_name, organisation_name, account_type').eq('id', sub).maybeSingle(),
        supabase.rpc('is_admin'),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
      ]);
      if (cancelled) return;
      setState({
        loading: false,
        user: profile
          ? {
              name: profile.organisation_name || profile.display_name,
              accountType: profile.account_type,
              isAdmin: admin === true,
              unread: count ?? 0,
            }
          : null,
      });
    };
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') void load();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);
  return state;
}

function SignOutForm({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <form action="/auth/signout" method="post" className={className}>
      {children}
    </form>
  );
}

export function SiteHeader() {
  const pathname = usePathname() ?? '/';
  const { loading, user } = useHeaderUser();
  const [open, setOpen] = useState(false);
  const dashHref = user ? (user.accountType === 'farmer' ? '/dashboard/farmer' : '/dashboard/buyer') : '/dashboard';
  const inDashboard = pathname.startsWith('/dashboard');

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur supports-[backdrop-filter]:bg-cream/85">
      <div className="container-page flex h-[68px] items-center gap-4">
        <HeaderLogo />
        <nav aria-label="Main" className="ml-3 hidden flex-1 items-center gap-0.5 md:flex">
          {MAIN_NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-10 items-center whitespace-nowrap rounded-md px-3 text-[15px] font-medium text-ink-soft hover:bg-sage hover:text-ink',
                  active && 'bg-sage font-semibold text-forest',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {loading ? (
            <span className="h-10 w-40" aria-hidden="true" />
          ) : user ? (
            <>
              <Button asChild variant="secondary" aria-current={inDashboard ? 'page' : undefined}>
                <Link href={dashHref}>
                  <LayoutDashboard />
                  <span className="max-w-[12rem] truncate">{user.name}</span>
                </Link>
              </Button>
              <Link
                href="/dashboard/notifications"
                aria-label={user.unread ? `Notifications, ${user.unread} unread` : 'Notifications'}
                className="relative inline-flex size-11 items-center justify-center rounded-md text-ink hover:bg-sage"
              >
                <Bell className="size-5" />
                {user.unread ? (
                  <span className="tabular absolute right-1.5 top-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-saffron px-1 text-[11px] font-bold leading-[18px] text-ink">
                    {user.unread > 9 ? '9+' : user.unread}
                  </span>
                ) : null}
              </Link>
              <Menu>
                <MenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Account menu">
                    <UserRound />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuLabel>Signed in as {user.name}</MenuLabel>
                  <MenuItem asChild>
                    <Link href={dashHref}>
                      <LayoutDashboard /> Dashboard
                    </Link>
                  </MenuItem>
                  <MenuItem asChild>
                    <Link href="/dashboard/profile">
                      <UserRound /> Profile
                    </Link>
                  </MenuItem>
                  {user.isAdmin ? (
                    <MenuItem asChild>
                      <Link href="/admin">
                        <Shield /> Administration
                      </Link>
                    </MenuItem>
                  ) : null}
                  <MenuSeparator />
                  {/* The menu unmounts on select, so the item submits a form that lives outside it. */}
                  <MenuItem onSelect={() => (document.getElementById('header-signout') as HTMLFormElement | null)?.requestSubmit()}>
                    <LogOut /> Sign out
                  </MenuItem>
                </MenuContent>
              </Menu>
              <form id="header-signout" action="/auth/signout" method="post" hidden />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" aria-current={pathname === '/login' ? 'page' : undefined}>
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild aria-current={pathname === '/register' ? 'page' : undefined}>
                <Link href="/register">Get Started</Link>
              </Button>
            </>
          )}
        </div>

        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Trigger asChild>
            <Button variant="ghost" size="icon" className="ml-auto md:hidden" aria-label="Open menu">
              <MenuIcon className="size-6" />
            </Button>
          </DialogPrimitive.Trigger>
          <SheetContent title="Menu">
            <nav aria-label="Main" className="flex flex-col gap-1">
              {MAIN_NAV.map((item) => {
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-12 items-center rounded-md px-3 text-base font-medium text-ink-soft hover:bg-sage',
                      active && 'bg-sage font-semibold text-forest',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line pt-4">
              {user ? (
                <>
                  <Button asChild onClick={() => setOpen(false)}>
                    <Link href={dashHref}>Dashboard</Link>
                  </Button>
                  <Button asChild variant="secondary" onClick={() => setOpen(false)}>
                    <Link href="/dashboard/notifications">Notifications{user.unread ? ` (${user.unread})` : ''}</Link>
                  </Button>
                  {user.isAdmin ? (
                    <Button asChild variant="secondary" className="col-span-2" onClick={() => setOpen(false)}>
                      <Link href="/admin">Administration</Link>
                    </Button>
                  ) : null}
                  <SignOutForm className="col-span-2">
                    <Button type="submit" variant="ghost" className="w-full">
                      Sign out
                    </Button>
                  </SignOutForm>
                </>
              ) : (
                <>
                  <Button asChild variant="secondary" onClick={() => setOpen(false)}>
                    <Link href="/login">Log in</Link>
                  </Button>
                  <Button asChild onClick={() => setOpen(false)}>
                    <Link href="/register">Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </DialogPrimitive.Root>
      </div>
    </header>
  );
}
