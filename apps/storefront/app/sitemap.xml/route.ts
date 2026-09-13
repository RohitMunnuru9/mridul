/**
 * sitemap.xml
 *
 * Built from the catalogue rather than written by hand, so a product added in
 * the admin is listed the next time a crawler asks — and a product hidden
 * there disappears from it, instead of leaving a promoted link to a 404.
 *
 * Only pages a stranger can usefully land on. Everything in robots.txt's
 * Disallow list is absent here too; the two must not contradict each other.
 */

import { getAllProducts, getCategories, getCollections } from '@mridul/database';

export const dynamic = 'force-dynamic';

type Entry = { path: string; priority: string; changefreq: string };

function xml(entries: Entry[], origin: string): string {
  const urls = entries
    .map(
      (entry) =>
        '  <url>\n' +
        `    <loc>${origin}${entry.path}</loc>\n` +
        `    <changefreq>${entry.changefreq}</changefreq>\n` +
        `    <priority>${entry.priority}</priority>\n` +
        '  </url>',
    )
    .join('\n');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${urls}\n` +
    '</urlset>\n'
  );
}

export async function GET(request: Request): Promise<Response> {
  const { origin } = new URL(request.url);

  const [categories, collections, products] = await Promise.all([
    getCategories(),
    getCollections(),
    getAllProducts(),
  ]);

  const entries: Entry[] = [
    { path: '/', priority: '1.0', changefreq: 'weekly' },
    ...categories
      .filter((category) => category.isActive)
      .map((category) => ({
        path: `/shop/${category.slug}`,
        priority: '0.8',
        changefreq: 'weekly',
      })),
    // `getCollections` already returns only the live ones; inactive collections
    // never leave the repository.
    ...collections.map((collection) => ({
      path: `/collections/${collection.slug}`,
      priority: '0.7',
      changefreq: 'weekly',
    })),
    // A hidden product is hidden. Listing it here would promote a page the
    // storefront will not serve.
    ...products
      .filter((product) => product.isActive)
      .map((product) => ({
        path: `/product/${product.slug}`,
        priority: '0.9',
        changefreq: 'weekly',
      })),
  ];

  return new Response(xml(entries, origin), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
