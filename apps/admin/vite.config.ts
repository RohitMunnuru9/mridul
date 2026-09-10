import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import tailwindcss from '@tailwindcss/vite';
import vinext from 'vinext';
import { defineConfig } from 'vite';

const WORKSPACE_PACKAGES = [
  'database',
  'notifications',
  'payments',
  'shipping',
  'types',
  'utils',
  'validation',
];

const workspaceAliases = {
  ...Object.fromEntries(
    WORKSPACE_PACKAGES.map((name) => [
      `@mridul/${name}`,
      fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url)),
    ]),
  ),
  // Server-only entry point: imports next/headers, never bundled for a browser.
  '@mridul/supabase/server': fileURLToPath(
    new URL('../../packages/supabase/src/server.ts', import.meta.url),
  ),
};

// One .env.local at the repo root serves both apps, so the keys are not
// duplicated per app and cannot drift apart.
loadEnv({ path: fileURLToPath(new URL('../../.env.local', import.meta.url)) });

// Deployment target: see the storefront config. Vercel is detected from its
// build environment; NITRO_PRESET picks a Nitro platform for a local build.
const useNitro = process.env.VERCEL === '1' || Boolean(process.env.NITRO_PRESET);

// These two are inlined into the bundle by `define` below, so they are read at
// build time, not at run time. On a host they come from the project's
// environment rather than a .env file — and if they are missing the build still
// succeeds and ships a site that cannot reach Supabase on any page. Failing the
// build instead turns a silent broken deploy into an obvious error.
function requirePublicEnv() {
  const missing = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ].filter((name) => !process.env[name]);
  if (missing.length === 0) return;
  throw new Error(
    `Cannot build without ${missing.join(' and ')}. Set them in the ` +
      'environment variables of the project you are building (on Vercel: ' +
      'Settings → Environment Variables), or in .env.local for a local build.',
  );
}

// Only the public values are inlined. The service-role key is never given to
// a bundle — it belongs to the seed script and, later, to server routes.
const publicEnv = {
  'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  ),
  'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  ),
};

export default defineConfig(async ({ command }) => {
  if (command === 'build') requirePublicEnv();

  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Imported only on its own branch: Wrangler snapshots its log path the
  // moment the Cloudflare plugin is imported.
  const targetPlugin = useNitro
    ? (await import('nitro/vite')).nitro()
    : (await import('@cloudflare/vite-plugin')).cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: {
          main: 'vinext/server/fetch-handler',
          compatibility_flags: ['nodejs_compat'],
        },
      });

  return {
    define: publicEnv,
    resolve: { alias: workspaceAliases },
    // Tailwind first, for the reason given in the storefront config.
    plugins: [tailwindcss(), vinext(), targetPlugin],
  };
});
