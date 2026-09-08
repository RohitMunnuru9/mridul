/**
 * Shop index — where the Shop tab lands.
 *
 * It leads with the collections that front the homepage, so tapping Shop takes
 * you straight to what is currently being pushed rather than to an alphabetical
 * list of everything. Categories sit underneath for people who know what they
 * came for.
 */

import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { getCategories, getCollections, getProductsByCollection } from '@mridul/database';
import { ProductRail } from '@/app/components/product-rail';

export const metadata: Metadata = {
  title: 'Shop | Mridul by MR',
  description:
    'The latest collections, sarees and blouses from Mridul by MR — new arrivals, best sellers, festive and wedding edits.',
};

/** Collections given a full rail. The rest appear as links. */
const FEATURED = ['new-arrivals', 'best-sellers', 'festive'];

export default async function ShopPage() {
  const [categories, collections] = await Promise.all([
    getCategories(),
    getCollections(),
  ]);

  const rails = await Promise.all(
    FEATURED.map(async (slug) => ({
      collection: collections.find((item) => item.slug === slug),
      products: await getProductsByCollection(slug, 6),
    })),
  );

  return (
    <div className="page-shell">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <ChevronRight aria-hidden="true" />
        <span aria-current="page">Shop</span>
      </nav>

      <div className="page-head">
        <p className="eyebrow">Everything, in one place</p>
        <h1>Shop the latest</h1>
        <p className="page-intro">
          The edits currently on the homepage, and the two categories everything
          else sits inside.
        </p>
      </div>

      <div className="shop-categories">
        {categories.map((category) => (
          <Link
            className="shop-category-card"
            href={`/shop/${category.slug}`}
            key={category.id}
          >
            <div className="shop-category-photo">
              <Image
                src={category.heroImage.url}
                alt={category.heroImage.alt}
                fill
                sizes="(max-width: 900px) 100vw, 50vw"
                style={{ objectPosition: category.heroImage.focal }}
              />
            </div>
            <div className="shop-category-copy">
              <p>{category.tagline}</p>
              <h2>
                {category.name} <ArrowRight aria-hidden="true" />
              </h2>
            </div>
          </Link>
        ))}
      </div>

      <nav className="collection-chips" aria-label="Collections">
        {collections.map((collection) => (
          <Link href={`/collections/${collection.slug}`} key={collection.id}>
            {collection.name}
          </Link>
        ))}
      </nav>

      {rails.map(
        ({ collection, products }) =>
          collection && (
            <ProductRail
              key={collection.id}
              eyebrow={collection.tagline}
              title={collection.name}
              href={`/collections/${collection.slug}`}
              products={products}
            />
          ),
      )}
    </div>
  );
}
