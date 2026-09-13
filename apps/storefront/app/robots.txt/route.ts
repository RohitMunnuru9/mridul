/**
 * robots.txt
 *
 * The shop wants to be found; a customer's bag does not. Everything behind a
 * sign-in, and everything that only means something to one person, is kept out
 * of the index — not because it is secret (row-level security handles that)
 * but because a search result for somebody else's order page helps nobody.
 *
 * Built from the request's own origin rather than an environment variable, so
 * a preview deployment advertises itself and not production.
 */

export const dynamic = 'force-dynamic';

const PRIVATE = [
  '/account',
  '/bag',
  '/checkout',
  '/wishlist',
  '/auth',
  '/order/',
  '/api/',
];

export function GET(request: Request): Response {
  const { origin } = new URL(request.url);

  const body = [
    'User-agent: *',
    ...PRIVATE.map((path) => `Disallow: ${path}`),
    'Allow: /',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
