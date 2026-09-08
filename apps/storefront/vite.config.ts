import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
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
};

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

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

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    define: publicEnv,
    resolve: { alias: workspaceAliases },
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: localBindingConfig,
      }),
    ],
  };
});
