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

import {
  getAllProducts,
  getCategories,
  getCollections,
  getJournalPosts,
  hasStory,
} from '@mridul/database';

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

  const [categories, collections, products, posts] = await Promise.all([
    getCategories(),
    getCollections(),
    getAllProducts(),
    getJournalPosts(),
  ]);
  // Only stories with a page of their own. A post that points at a listing
  // has nothing at /journal/<slug>, and a sitemap must not promise a 404.
  const stories = posts.filter(hasStory);

  const entries: Entry[] = [
    { path: '/', priority: '1.0', changefreq: 'weekly' },
    ...(stories.length > 0
      ? [{ path: '/journal', priority: '0.6', changefreq: 'weekly' }]
      : []),
    ...stories.map((post) => ({
      path: `/journal/${post.slug}`,
      priority: '0.5',
      changefreq: 'monthly',
    })),
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
