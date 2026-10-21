import type { NextConfig } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseOrigin = (() => {
  try {
    return supabaseUrl ? new URL(supabaseUrl).origin : '';
  } catch {
    return '';
  }
})();
const supabaseWs = supabaseOrigin.replace(/^http/, 'ws');

// Content Security Policy. 'unsafe-inline' for scripts is required by Next.js hydration
// without per-request nonces; everything else is limited to this site and Supabase.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`.trim(),
  ...(process.env.NODE_ENV === 'production' && supabaseOrigin.startsWith('https') ? ['upgrade-insecure-requests'] : []),
].join('; ');

const nextConfig: NextConfig = {
  // The classic caching model (no Cache Components): pages that read cookies render per
  // request; public pages are static or revalidated. See docs/ARCHITECTURE.md.
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    // Uploaded photos are already resized and re-encoded on upload, and are rendered
    // unoptimized; bundled photos in /public go through the optimizer.
    remotePatterns: supabaseOrigin ? [{ protocol: new URL(supabaseOrigin).protocol.replace(':', '') as 'http' | 'https', hostname: new URL(supabaseOrigin).hostname }] : [],
  },
  experimental: {
    serverActions: {
      // Photos are downscaled in the browser before upload and re-encoded on the server.
      // Stay under Vercel's 4.5 MB request limit for serverless functions.
      bodySizeLimit: '4mb',
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default nextConfig;
