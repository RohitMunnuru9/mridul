import type { NextConfig } from 'next';

/**
 * Product imagery is served from Supabase Storage, so the optimiser needs the
 * project host on its allow-list. Derived from the same env var the client
 * uses rather than hardcoded, so a different project needs no code change.
 */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: 'https',
            hostname: supabaseHost,
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],
  },
};

export default nextConfig;
