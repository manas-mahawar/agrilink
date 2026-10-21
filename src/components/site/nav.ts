export const MAIN_NAV = [
  { href: '/', label: 'Home', match: (p: string) => p === '/' },
  { href: '/marketplace', label: 'Explore Produce', match: (p: string) => p.startsWith('/marketplace') || p.startsWith('/farmers') },
  { href: '/about', label: 'About', match: (p: string) => p.startsWith('/about') },
  { href: '/services', label: 'Services', match: (p: string) => p.startsWith('/services') },
] as const;
