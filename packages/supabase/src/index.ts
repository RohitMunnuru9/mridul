/**
 * Supabase client factories.
 *
 * Three clients, and which one you reach for is a security decision:
 *
 *   publicClient — the anon key. Row-level security applies. Safe to use from
 *     a browser, and safe on the server for anything a logged-out visitor is
 *     allowed to see. This is what the storefront uses for the catalogue.
 *
 *   adminClient — the service role key. Row-level security does NOT apply.
 *     This key can read and write every row belonging to every customer, so it
 *     must never reach a browser. The factory throws if it is called anywhere
 *     a `window` exists, and throws if the key is missing rather than silently
 *     falling back to the anon key and producing confusing empty results.
 *
 * The rule of thumb: if you cannot say out loud why a query needs to bypass
 * RLS, it does not need the admin client.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@mridul/types';

export type Client = SupabaseClient<Database>;

type EnvName =
  | 'NEXT_PUBLIC_SUPABASE_URL'
  | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  | 'SUPABASE_SERVICE_ROLE_KEY';

/**
 * Each branch is a literal `process.env.X` so the bundler can substitute it at
 * build time — a dynamic `process.env[name]` would be left untouched and come
 * back undefined in the browser.
 *
 * The service-role branch is deliberately never substituted for client
 * bundles, so in a browser it throws on the missing `process` global and is
 * caught here. That is the desired outcome: the secret is simply not present.
 */
function readEnv(name: EnvName): string | undefined {
  try {
    switch (name) {
      case 'NEXT_PUBLIC_SUPABASE_URL':
        return process.env.NEXT_PUBLIC_SUPABASE_URL;
      case 'NEXT_PUBLIC_SUPABASE_ANON_KEY':
        return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      case 'SUPABASE_SERVICE_ROLE_KEY':
        return process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  } catch {
    return undefined;
  }
}

function requireEnv(name: EnvName): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill in the values ` +
        `from your Supabase dashboard.`,
    );
  }
  return value;
}

/**
 * Anon-key client. RLS applies, so this only ever returns rows the caller is
 * allowed to see. Used for the catalogue, which is public by design.
 */
export function publicClient(): Client {
  return createClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      auth: {
        // The storefront has no sign-in yet, so there is no session to persist
        // and nothing to refresh. Turning these off avoids the client trying
        // to touch storage that does not exist on the server.
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

/**
 * Service-role client. Bypasses RLS entirely. Server-side only.
 *
 * This is what will write orders after the server has priced them, and what
 * the seed script uses. Every call site should be able to justify itself.
 */
export function adminClient(): Client {
  if (typeof window !== 'undefined') {
    throw new Error(
      'adminClient() was called in a browser. The service role key bypasses ' +
        'row-level security and must never be shipped to a client.',
    );
  }

  return createClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** True when the app has enough configuration to talk to Supabase at all. */
export function isConfigured(): boolean {
  return Boolean(
    readEnv('NEXT_PUBLIC_SUPABASE_URL') && readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  );
}

/**
 * Public URL for an image in a storage bucket, resized on the way out.
 *
 * The originals are full-resolution PNGs straight from a camera or an export —
 * the homepage hero is 1.9 MB on its own, and a phone on mobile data was being
 * asked for nine megabytes of them. `next/image` cannot help here: this runtime
 * optimises files it serves itself but passes remote URLs through untouched.
 *
 * So the resizing is asked of Supabase instead. Its render endpoint scales the
 * file and hands back WebP to any browser that will take one, which turns that
 * 1.9 MB hero into about 45 KB. Transformations are counted per distinct source
 * image rather than per request, and this shop has a few dozen.
 *
 * Buckets are public for reads, so this stays a plain deterministic URL — no
 * round trip, and usable in a server-rendered `src`.
 */
export function storageUrl(bucket: string, path: string, width = 1200): string {
  const base = readEnv('NEXT_PUBLIC_SUPABASE_URL');
  if (!base) return '';
  return (
    `${base}/storage/v1/render/image/public/${bucket}/${path}` +
    `?width=${width}&quality=70`
  );
}

/**
 * The untouched file. For anything being inspected or re-processed rather than
 * displayed — never for an `<img>` on a page a customer loads.
 */
export function storageOriginalUrl(bucket: string, path: string): string {
  const base = readEnv('NEXT_PUBLIC_SUPABASE_URL');
  if (!base) return '';
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
