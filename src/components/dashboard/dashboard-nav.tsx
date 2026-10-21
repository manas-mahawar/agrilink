'use client';

import { Bell, ClipboardList, Handshake, Heart, LayoutDashboard, ListPlus, Package, Shield, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean; badge?: number };

export function DashboardNav({ accountType, isAdmin, unread, openOffers }: { accountType: 'farmer' | 'buyer'; isAdmin: boolean; unread: number; openOffers: number }) {
  const pathname = usePathname();
  const items: Item[] =
    accountType === 'farmer'
      ? [
          { href: '/dashboard/farmer', label: 'Overview', icon: LayoutDashboard, exact: true },
          { href: '/dashboard/listings', label: 'My listings', icon: ClipboardList },
          { href: '/dashboard/listings/new', label: 'New listing', icon: ListPlus, exact: true },
          { href: '/dashboard/offers', label: 'Offers', icon: Handshake, badge: openOffers },
          { href: '/dashboard/orders', label: 'Orders', icon: Package },
        ]
      : [
          { href: '/dashboard/buyer', label: 'Overview', icon: LayoutDashboard, exact: true },
          { href: '/dashboard/saved', label: 'Saved listings', icon: Heart },
          { href: '/dashboard/offers', label: 'My offers', icon: Handshake, badge: openOffers },
          { href: '/dashboard/orders', label: 'Orders', icon: Package },
        ];
  items.push({ href: '/dashboard/notifications', label: 'Notifications', icon: Bell, badge: unread }, { href: '/dashboard/profile', label: 'Profile', icon: UserRound });
  if (isAdmin) items.push({ href: '/admin', label: 'Admin', icon: Shield });

  const isActive = (it: Item) =>
    it.exact ? pathname === it.href : pathname === it.href || (pathname.startsWith(`${it.href}/`) && !(it.href === '/dashboard/listings' && pathname === '/dashboard/listings/new'));

  return (
    <nav aria-label="Dashboard" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1.5 lg:flex-col">
        {items.map((it) => {
          const active = isActive(it);
          return (
            <li key={it.href} className="shrink-0">
              <Link
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-md px-3 text-[15px] font-medium',
                  active ? 'bg-forest text-white' : 'text-ink-soft hover:bg-sage hover:text-ink',
                )}
              >
                <it.icon className="size-[18px] shrink-0" aria-hidden="true" />
                <span className="flex-1">{it.label}</span>
                {it.badge ? (
                  <span className={cn('tabular rounded-full px-2 py-0.5 text-xs font-bold', active ? 'bg-white text-forest' : 'bg-saffron text-ink')}>
                    {it.badge > 99 ? '99+' : it.badge}
                    <span className="sr-only"> new</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
