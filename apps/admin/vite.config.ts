import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import tailwindcss from '@tailwindcss/postcss';
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
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    define: publicEnv,
    resolve: { alias: workspaceAliases },
    css: { postcss: { plugins: [tailwindcss()] } },
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: {
          main: 'vinext/server/fetch-handler',
          compatibility_flags: ['nodejs_compat'],
        },
      }),
    ],
  };
});
