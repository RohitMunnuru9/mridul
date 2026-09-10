# Deploying

The apps are built by [vinext](https://github.com/cloudflare/vinext), which
targets Cloudflare Workers natively and every other host through
[Nitro](https://v3.nitro.build/). Both targets are wired up here, and the
application code is identical on each — only the build plugin differs.

The target is chosen for you:

| Where | What decides it | Output |
| --- | --- | --- |
| Vercel | `VERCEL=1`, set by Vercel's build environment | `.vercel/output` |
| Another Nitro host, locally | `NITRO_PRESET=<preset>` | `.output` |
| Cloudflare Workers | neither of the above | `dist/` |

So `npm run dev`, `npm run build` and the Cloudflare deploy are unchanged.

## Vercel

The storefront and the admin are **two separate Vercel projects** from the same
repository. They must be: they are different sites on different domains, and
the admin should not be reachable under the shop's domain.

For each project, in the Vercel dashboard → **Add New → Project** → import
`RohitMunnuru9/mridul`, then set:

| Setting | Storefront | Admin |
| --- | --- | --- |
| Root Directory | `apps/storefront` | `apps/admin` |
| Framework Preset | **Other** | **Other** |
| Build Command | leave as the repo's `vercel.json` sets it | same |
| Node.js version | 22.x | 22.x |

Leave **Include files outside the root directory** switched **on** — this is a
npm workspaces monorepo and the build needs `packages/*` and the root lockfile.

### Environment variables

Set these in **Settings → Environment Variables** on *both* projects, for
Production, Preview and Development:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key |
| `NEXT_PUBLIC_STOREFRONT_ORIGIN` | `https://<storefront domain>` |
| `NEXT_PUBLIC_ADMIN_ORIGIN` | `https://<admin domain>` (admin project only) |

`SUPABASE_SERVICE_ROLE_KEY` is **not** set on either project. Nothing either app
serves reads it — it belongs to `scripts/seed-supabase.ts`, which you run from
your own machine. The key bypasses row-level security, so putting it in a web
project's environment would put it one mistaken import away from a bundle.

### After the first deploy

Two things point at `localhost` until you change them:

1. **Supabase → Authentication → URL Configuration.** Add
   `https://<storefront domain>/auth/callback` and
   `https://<admin domain>/auth/callback` to the redirect allow-list, and set
   the Site URL to the storefront domain. Sign-in fails until this is done.
2. **Supabase → Authentication → Providers → Google.** Add the same two
   callback URLs to the Google OAuth client's authorised redirect URIs.

## Cloudflare Workers

Unchanged, and still the better-supported target:

```bash
npx @vinext/cloudflare deploy
```

## What differs between the two

`next/image` optimisation is a Cloudflare binding. On Vercel, Nitro's build does
not wire it up, so images are served through vinext's passthrough rather than
being resized. They still render, at their original size — worth watching if the
product photography is large.
