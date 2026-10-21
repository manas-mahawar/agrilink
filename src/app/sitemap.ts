import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';
import { searchListings } from '@/server/data/catalog';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl;
  const pages: MetadataRoute.Sitemap = ['', '/marketplace', '/about', '/services', '/contact', '/privacy', '/terms'].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: p === '/marketplace' ? 'hourly' : 'monthly',
  }));
  if (publicEnv.demoMode) return pages;
  try {
    for (let page = 1; page <= 20; page++) {
      const { items, total } = await searchListings({ sort: 'newest', pageSize: 48, page });
      for (const l of items) if (!l.isDemo) pages.push({ url: `${base}/marketplace/${l.id}`, lastModified: l.publishedAt ?? undefined });
      if (page * 48 >= total) break;
    }
  } catch {
    // The sitemap must never fail the build because the database is unreachable.
  }
  return pages;
}
