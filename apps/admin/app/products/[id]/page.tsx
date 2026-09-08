/**
 * Product detail — every field on the record, nothing summarised away.
 *
 * This is the page that answers "what exactly is this product?", so it shows
 * all images with their crops and alt text, every variant with its own SKU,
 * price and stock, the full description and care copy, and the taxonomy.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getCollections, getProductById } from '@mridul/database';
import { badgeLabel, formatPaise } from '@mridul/utils';
import { MediaThumb, PageHead, Panel, Pill, StatCard, ViewOnSite } from '../../components/ui';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  return { title: `${product?.name ?? 'Product'} | Mridul Admin` };
}

export default async function ProductDetail({ params }: PageProps) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();

  const collections = await getCollections();
  const memberships = collections.filter((collection) =>
    product.collectionSlugs.includes(collection.slug),
  );

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: 'Product ID', value: <code>{product.id}</code> },
    { label: 'Slug', value: <code>{product.slug}</code> },
    { label: 'Subtitle', value: product.subtitle },
    { label: 'Category', value: <code>{product.categorySlug}</code> },
    { label: 'Fabric', value: product.fabric },
    {
      label: 'Colour',
      value: (
        <span className="colour-cell">
          <i style={{ background: product.colour.hex }} />
          {product.colour.name} <code>{product.colour.hex}</code>
        </span>
      ),
    },
    { label: 'Weave', value: product.technique },
    { label: 'Occasion', value: product.occasion },
    { label: 'Badge', value: badgeLabel(product.badge) ?? '—' },
    { label: 'Published', value: product.publishedAt },
    {
      label: 'Rating',
      value: product.rating
        ? `${product.rating.average.toFixed(1)} from ${product.rating.count} reviews`
        : '—',
    },
    {
      label: 'Swatches',
      value: (
        <span className="swatch-row">
          {product.swatches.map((swatch) => (
            <i key={swatch} style={{ background: swatch }} title={swatch} />
          ))}
        </span>
      ),
    },
  ];

  return (
    <>
      <Link className="back-link" href="/products">
        <ChevronLeft aria-hidden="true" /> All products
      </Link>

      <PageHead
        title={product.name}
        subtitle={`${product.fabric} · ${product.subtitle}`}
        actions={<ViewOnSite href={`/product/${product.slug}`} label="View on site" />}
      />

      <dl className="stat-grid">
        <StatCard label="Price" value={formatPaise(product.pricePaise)} note="base price" />
        <StatCard
          label="Compare at"
          value={product.compareAtPaise ? formatPaise(product.compareAtPaise) : '—'}
          note={product.discountPercent > 0 ? `${product.discountPercent}% off` : 'no offer'}
        />
        <StatCard label="Stock" value={product.stockTotal} note="across all variants" />
        <StatCard label="Variants" value={product.variants.length} note="buyable options" />
      </dl>

      <Panel title="Images" note="Order here is the order on the product page. The first is the thumbnail.">
        <ul className="image-strip">
          {product.images.map((image, index) => (
            <li key={image.id}>
              <MediaThumb url={image.url} alt={image.alt} focal={image.focal} size={150} />
              <div>
                <span className="image-role">
                  {index === 0 ? 'Thumbnail' : `Image ${index + 1}`}
                </span>
                <p className="image-alt">{image.alt}</p>
                <code>{image.url}</code>
                <code className="image-focal">crop {image.focal}</code>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Variants and inventory" note="Stock is tracked per variant, not per product.">
        <table>
          <thead>
            <tr>
              <th>Option</th>
              <th>SKU</th>
              <th className="numeric">Price adjustment</th>
              <th className="numeric">Sells at</th>
              <th className="numeric">Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {product.variants.map((variant) => (
              <tr key={variant.id}>
                <td>
                  <strong>{variant.label}</strong>
                </td>
                <td>
                  <code>{variant.sku}</code>
                </td>
                <td className="numeric">
                  {variant.priceDeltaPaise === 0 ? (
                    <span className="muted">—</span>
                  ) : (
                    `+${formatPaise(variant.priceDeltaPaise)}`
                  )}
                </td>
                <td className="numeric">
                  {formatPaise(product.pricePaise + variant.priceDeltaPaise)}
                </td>
                <td className="numeric">{variant.stock}</td>
                <td>
                  <Pill
                    tone={variant.stock === 0 ? 'out' : variant.stock <= 5 ? 'low' : 'ok'}
                  >
                    {variant.stock === 0
                      ? 'Sold out'
                      : variant.stock <= 5
                        ? 'Low'
                        : 'In stock'}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="panel-row">
        <Panel title="Attributes">
          <dl className="field-list">
            {fields.map((field) => (
              <div key={field.label}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel title="Collections" note="Drives which rails and edits this appears in.">
          {memberships.length === 0 ? (
            <p className="panel-empty">Not in any collection.</p>
          ) : (
            <ul className="tag-list">
              {memberships.map((collection) => (
                <li key={collection.id}>
                  <strong>{collection.name}</strong>
                  <code>{collection.slug}</code>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Copy" note="Everything the product page renders as text.">
        <div className="prose">
          <h3>Description</h3>
          <p>{product.description}</p>
          {product.blouseDetails && (
            <>
              <h3>Blouse details</h3>
              <p>{product.blouseDetails}</p>
            </>
          )}
          <h3>Care</h3>
          <ul>
            {product.care.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </Panel>
    </>
  );
}
