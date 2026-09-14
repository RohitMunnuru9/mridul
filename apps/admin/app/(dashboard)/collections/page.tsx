/**
 * Collections.
 *
 * Collections cut across categories and are what the homepage rails, the shop
 * index and the Shop tab are fed from — so what is in a collection is a
 * merchandising decision made here, not in code.
 */

import type { Metadata } from 'next';
import {
  getCollectionsWithCounts,
  getHomepageSections,
  getProductsByCollection,
} from '@mridul/database';
import { sessionClient } from '@mridul/supabase/server';
import { formatPaise } from '@mridul/utils';
import { InternalLink, MediaThumb, PageHead, Panel, Pill, StatCard, ViewOnSite, mediaUrl } from '../../components/ui';
import { CollectionBoard } from '../../components/collection-board';

export const metadata: Metadata = { title: 'Collections | Mridul Admin' };

export default async function CollectionsPage() {
  const db = await sessionClient();
  const [collections, sections] = await Promise.all([
    getCollectionsWithCounts(db),
    getHomepageSections(true, db),
  ]);

  const featuredSlug = sections.find(
    (section) => section.key === 'featured_products',
  )?.collectionSlug;

  const withProducts = await Promise.all(
    collections.map(async (collection) => ({
      collection,
      // The board needs the whole membership, not a preview of it — a piece
      // you cannot see is a piece you cannot move.
      products: await getProductsByCollection(collection.slug, 200, db),
    })),
  );

  const board = withProducts.map(({ collection, products }) => ({
    collection: { id: collection.id, name: collection.name, slug: collection.slug },
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      pricePaise: product.pricePaise,
      imageUrl: mediaUrl(product.images[0].url),
    })),
  }));

  return (
    <>
      <PageHead
        title="Collections"
        subtitle="Edits that cut across categories. These feed the homepage rails and the Shop tab."
      />

      <dl className="stat-grid">
        <StatCard label="Collections" value={collections.length} note="defined" />
        <StatCard
          label="On the homepage"
          value={featuredSlug ?? '—'}
          note="feeds the product rail"
        />
        <StatCard
          label="Largest"
          value={
            [...collections].sort((a, b) => b.productCount - a.productCount)[0]?.name ??
            '—'
          }
          note="most products"
        />
        <StatCard
          label="Assignments"
          value={collections.reduce((total, item) => total + item.productCount, 0)}
          note="product memberships"
        />
      </dl>

      <Panel
        title="Move pieces between collections"
        note="Drag a piece by its grip into another collection, or use the Move to menu on it. Changes save straight away."
        wide
      >
        <CollectionBoard
          collections={board.map((entry) => entry.collection)}
          initialGroups={Object.fromEntries(
            board.map((entry) => [entry.collection.id, entry.products]),
          )}
        />
      </Panel>

      {withProducts.map(({ collection, products }) => (
        <Panel
          key={collection.id}
          title={collection.name}
          note={`${collection.tagline} · ${collection.productCount} products`}
        >
          <div className="panel-meta">
            <span>
              Slug <code>{collection.slug}</code>
            </span>
            {collection.slug === featuredSlug && <Pill tone="ok">On the homepage</Pill>}
            <ViewOnSite href={`/collections/${collection.slug}`} label="View listing" />
          </div>
          <table>
            <thead>
              <tr>
                <th>Image</th>
                <th>Product</th>
                <th>Category</th>
                <th className="numeric">Price</th>
                <th className="numeric">Stock</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <MediaThumb
                      url={product.images[0].url}
                      alt={product.images[0].alt}
                      focal={product.images[0].focal}
                    />
                  </td>
                  <td>
                    <InternalLink href={`/products/${product.id}`}>
                      {product.name}
                    </InternalLink>
                  </td>
                  <td>{product.categorySlug}</td>
                  <td className="numeric">{formatPaise(product.pricePaise)}</td>
                  <td className="numeric">{product.stockTotal}</td>
                  <td>
                    <ViewOnSite href={`/product/${product.slug}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {collection.productCount > products.length && (
            <p className="panel-foot-note">
              Showing {products.length} of {collection.productCount}.
            </p>
          )}
        </Panel>
      ))}
    </>
  );
}
