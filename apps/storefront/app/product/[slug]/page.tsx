/**
 * Product detail page — the layer under a listing card.
 *
 * Server-rendered from the repository so the price, stock and copy here are the
 * same values the listing used, and so search engines see the whole product
 * without running any JavaScript.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import {
  ChevronRight,
  Droplet,
  Layers,
  Ruler,
  Sparkles,
  Star,
  Wand2,
} from 'lucide-react';
import { ProductRail } from '@/app/components/product-rail';
import { badgeLabel } from '@mridul/utils';
import {
  getCategoryBySlug,
  getContentBlocks,
  getProductBySlug,
  getRelatedProducts,
  getSiteSettings,
} from '@mridul/database';
import { DeliveryCheck } from './delivery-check';
import { ProductGallery, ProductPurchase } from './product-detail';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: 'Not found | Mridul by MR' };

  return {
    title: `${product.name} | Mridul by MR`,
    description: product.description,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [category, related, settings, copy] = await Promise.all([
    getCategoryBySlug(product.categorySlug),
    getRelatedProducts(product, 4),
    getSiteSettings(),
    getContentBlocks(),
  ]);
  const label = badgeLabel(product.badge);

  // Whether a size chart appears is a property of the category, not a hardcoded
  // check for the word "blouses" — a new sized category needs no code change.
  const sizeChart = category?.sizeChart ?? [];
  const rates = {
    freeShippingThresholdPaise: settings.freeShippingThresholdPaise,
    flatRatePaise: settings.flatShippingPaise,
  };

  // Each spec carries an icon so the block reads as four facts about a
  // garment rather than as four rows of a form.
  const specs = [
    { label: 'Fabric', value: product.fabric, icon: Layers },
    { label: 'Colour', value: product.colour.name, icon: Droplet, swatch: product.colour.hex },
    { label: 'Weave', value: product.technique, icon: Wand2 },
    { label: 'Occasion', value: product.occasion, icon: Sparkles },
  ];

  return (
    <div className="pdp">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <ChevronRight aria-hidden="true" />
        {category && (
          <>
            <Link href={`/shop/${category.slug}`}>{category.name}</Link>
            <ChevronRight aria-hidden="true" />
          </>
        )}
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="pdp-layout">
        <ProductGallery product={product} />

        <div className="pdp-info">
          <div className="pdp-heading">
            {label && <span className="product-badge">{label}</span>}
            <h1>{product.name}</h1>
            <p className="pdp-subtitle">{product.subtitle}</p>
            {product.rating && (
              <p className="pdp-rating">
                <Star aria-hidden="true" fill="currentColor" />
                {product.rating.average.toFixed(1)}
                <small>({product.rating.count} reviews)</small>
              </p>
            )}
          </div>

          <p className="pdp-description">{product.description}</p>

          <ProductPurchase
            product={product}
            freeShippingThresholdPaise={settings.freeShippingThresholdPaise}
          />

          <DeliveryCheck pricePaise={product.pricePaise} rates={rates} />

          <dl className="pdp-specs">
            {specs.map((spec) => {
              const Icon = spec.icon;
              return (
                <div key={spec.label}>
                  <span className="spec-icon" aria-hidden="true">
                    {spec.swatch ? (
                      <i style={{ background: spec.swatch }} />
                    ) : (
                      <Icon />
                    )}
                  </span>
                  <div>
                    <dt>{spec.label}</dt>
                    <dd>{spec.value}</dd>
                  </div>
                </div>
              );
            })}
          </dl>

          <div className="pdp-accordions">
            {sizeChart.length > 0 && (
              <details>
                <summary>
                  <Ruler aria-hidden="true" /> Size chart
                </summary>
                <div className="size-chart">
                  <table>
                    <thead>
                      <tr>
                        <th>Size</th>
                        <th>Bust</th>
                        <th>Waist</th>
                        <th>Shoulder</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sizeChart.map((row) => (
                        <tr key={row.size}>
                          <td>{row.size}</td>
                          <td>{row.bust}&quot;</td>
                          <td>{row.waist}&quot;</td>
                          <td>{row.shoulder}&quot;</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {category?.sizeChartNote && <p>{category.sizeChartNote}</p>}
                </div>
              </details>
            )}
            {product.blouseDetails && (
              <details>
                <summary>Blouse details</summary>
                <p>{product.blouseDetails}</p>
              </details>
            )}
            <details>
              <summary>Care</summary>
              <ul>
                {product.care.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </details>
            <details>
              <summary>Shipping &amp; returns</summary>
              <p>{copy.pdp_shipping_returns}</p>
            </details>
            <details>
              <summary>Why it costs what it costs</summary>
              <p>{copy.pdp_why_it_costs}</p>
            </details>
          </div>
        </div>
      </div>

      <ProductRail
        eyebrow="You may also like"
        title={`More from ${category?.name ?? 'the collection'}`}
        href={category ? `/shop/${category.slug}` : undefined}
        products={related}
      />
    </div>
  );
}
