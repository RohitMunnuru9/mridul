/**
 * Product list. Every product with its thumbnail, price, stock and status,
 * linking through to the full record.
 */

import type { Metadata } from 'next';
import { getAllProducts, getCategories } from '@mridul/database';
import { badgeLabel, formatPaise } from '@mridul/utils';
import {
  InternalLink,
  MediaThumb,
  PageHead,
  Panel,
  Pill,
  StatCard,
  ViewOnSite,
} from '../components/ui';

export const metadata: Metadata = { title: 'Products | Mridul Admin' };

/** Below this many units a product needs restocking. */
const LOW_STOCK_THRESHOLD = 6;

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([getAllProducts(), getCategories()]);

  const onOffer = products.filter((product) => product.discountPercent > 0);
  const totalImages = products.reduce(
    (total, product) => total + product.images.length,
    0,
  );

  return (
    <>
      <PageHead
        title="Products"
        subtitle={`${products.length} products across ${categories.length} categories.`}
      />

      <dl className="stat-grid">
        <StatCard label="Products" value={products.length} note="in the catalogue" />
        <StatCard
          label="Live"
          value={products.filter((product) => product.isActive).length}
          note="visible on the storefront"
        />
        <StatCard label="On offer" value={onOffer.length} note="have a compare-at price" />
        <StatCard label="Images" value={totalImages} note="across all products" />
      </dl>

      {categories.map((category) => {
        const rows = products.filter(
          (product) => product.categorySlug === category.slug,
        );
        return (
          <Panel
            key={category.id}
            title={category.name}
            note={`${rows.length} products · ${category.tagline}`}
          >
            <table>
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Fabric</th>
                  <th>Colour</th>
                  <th>Badge</th>
                  <th className="numeric">Price</th>
                  <th className="numeric">Compare at</th>
                  <th className="numeric">Stock</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => (
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
                      <small className="row-sub">{product.subtitle}</small>
                    </td>
                    <td>{product.fabric}</td>
                    <td>
                      <span className="colour-cell">
                        <i style={{ background: product.colour.hex }} />
                        {product.colour.name}
                      </span>
                    </td>
                    <td>
                      {badgeLabel(product.badge) ?? <span className="muted">—</span>}
                    </td>
                    <td className="numeric">{formatPaise(product.pricePaise)}</td>
                    <td className="numeric">
                      {product.compareAtPaise ? (
                        formatPaise(product.compareAtPaise)
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="numeric">{product.stockTotal}</td>
                    <td>
                      <Pill
                        tone={
                          product.stockTotal === 0
                            ? 'out'
                            : product.stockTotal <= LOW_STOCK_THRESHOLD
                              ? 'low'
                              : 'ok'
                        }
                      >
                        {product.stockTotal === 0
                          ? 'Out of stock'
                          : product.stockTotal <= LOW_STOCK_THRESHOLD
                            ? 'Low'
                            : 'In stock'}
                      </Pill>
                    </td>
                    <td>
                      <ViewOnSite href={`/product/${product.slug}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        );
      })}
    </>
  );
}
