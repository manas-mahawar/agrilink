import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  // Demo deployments are never indexed.
  if (publicEnv.demoMode) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/admin', '/auth', '/api', '/login', '/register', '/forgot-password', '/reset-password'] },
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}
