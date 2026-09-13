/**
 * The admin is not a website. Nothing here should ever be crawled, indexed or
 * kept in a cache — the `noindex` in the layout says so to a crawler that has
 * already fetched a page, and this says it before one is fetched at all.
 *
 * Neither is what keeps anybody out: `admin_roles` does that, in Postgres.
 */

export const dynamic = 'force-dynamic';

export function GET(): Response {
  return new Response('User-agent: *\nDisallow: /\n', {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
