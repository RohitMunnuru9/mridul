import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import tailwindcss from '@tailwindcss/vite';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import hostingConfig from './.openai/hosting.json';

// Workspace packages are consumed as TypeScript source rather than as built
// output, so Vite compiles them with the app and there is no build step
// between editing a package and seeing it here.
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
  // Also server-only, and for a harder reason: it holds the CCAvenue working
  // key, which both encrypts the request and authenticates the reply. Kept out
  // of `@mridul/payments` itself so that importing the payment *types* from a
  // component cannot drag the crypto — or the key — into a client bundle.
  '@mridul/payments/ccavenue': fileURLToPath(
    new URL('../../packages/payments/src/ccavenue.ts', import.meta.url),
  ),
};

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

// Deployment target. Cloudflare Workers is vinext's native target and what the
// Codex preview and `wrangler` run. Vercel — or any other Nitro platform — is
// chosen automatically inside Vercel's build environment, or by hand with
// NITRO_PRESET=<preset> for a local build. Nothing in the app itself changes;
// only the plugin that turns the build into something a host can run.
const useNitro = process.env.VERCEL === '1' || Boolean(process.env.NITRO_PRESET);

const localBindingConfig = {
  main: 'vinext/server/fetch-handler',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: 'site-creator-d1',
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: 'site-creator-r2',
        },
      ]
    : [],
};

// One .env.local at the repo root serves both apps, so the keys are not
// duplicated per app and cannot drift apart.
loadEnv({ path: fileURLToPath(new URL('../../.env.local', import.meta.url)) });

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

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Each target's plugin is imported only on its own branch: Wrangler
  // snapshots its log path the moment the Cloudflare plugin is imported, and
  // neither host needs the other's plugin loaded at all.
  const targetPlugins = useNitro
    ? [(await import('nitro/vite')).nitro()]
    : await (async () => {
        const [{ cloudflare }, { sites }] = await Promise.all([
          import('@cloudflare/vite-plugin'),
          import('@openai/sites-vite-plugin'),
        ]);
        return [
          sites(),
          cloudflare({
            viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
            config: localBindingConfig,
          }),
        ];
      })();

  return {
    define: publicEnv,
    resolve: { alias: workspaceAliases },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    // Tailwind first: it registers the resolver for `@import "tailwindcss"`,
    // which Vite's own postcss-import would otherwise try to open as a file.
    // The same pipeline serves both targets, so the CSS cannot drift between
    // the Cloudflare and the Vercel build.
    plugins: [tailwindcss(), vinext(), ...targetPlugins],
  };
});
