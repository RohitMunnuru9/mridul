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
import { ChevronRight, Ruler, Star } from 'lucide-react';
import { ProductRail } from '@/app/components/product-rail';
import { badgeLabel } from '@mridul/utils';
import {
  getCategoryBySlug,
  getProductBySlug,
  getRelatedProducts,
} from '@mridul/database';
import { DeliveryCheck } from './delivery-check';
import { ProductGallery, ProductPurchase } from './product-detail';

type PageProps = { params: Promise<{ slug: string }> };

/** Blouse measurements, in inches. Replace with per-product data when stitched sizes vary. */
const SIZE_CHART = [
  { size: 'XS', bust: '32', waist: '26', shoulder: '13' },
  { size: 'S', bust: '34', waist: '28', shoulder: '13.5' },
  { size: 'M', bust: '36', waist: '30', shoulder: '14' },
  { size: 'L', bust: '38', waist: '32', shoulder: '14.5' },
  { size: 'XL', bust: '40', waist: '34', shoulder: '15' },
  { size: 'XXL', bust: '42', waist: '36', shoulder: '15.5' },
];

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

  const category = await getCategoryBySlug(product.categorySlug);
  const related = await getRelatedProducts(product, 4);
  const label = badgeLabel(product.badge);
  const isBlouse = product.categorySlug === 'blouses';

  const specs = [
    { label: 'Fabric', value: product.fabric },
    { label: 'Colour', value: product.colour.name },
    { label: 'Weave', value: product.technique },
    { label: 'Occasion', value: product.occasion },
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

          <ProductPurchase product={product} />

          <DeliveryCheck pricePaise={product.pricePaise} />

          <dl className="pdp-specs">
            {specs.map((spec) => (
              <div key={spec.label}>
                <dt>{spec.label}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>

          <div className="pdp-accordions">
            {isBlouse && (
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
                      {SIZE_CHART.map((row) => (
                        <tr key={row.size}>
                          <td>{row.size}</td>
                          <td>{row.bust}&quot;</td>
                          <td>{row.waist}&quot;</td>
                          <td>{row.shoulder}&quot;</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p>
                    Measurements are of the garment, not the body. Every piece leaves
                    a small seam allowance if you want a local alteration.
                  </p>
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
              <p>
                Dispatched within two working days. Delivery charge is calculated
                from your pincode at checkout, and the tracking link reaches you on
                WhatsApp once the parcel is picked up. Returns accepted within seven
                days of delivery on unworn pieces with tags intact.
              </p>
            </details>
            <details>
              <summary>Why it costs what it costs</summary>
              <p>
                Small runs on a handloom cost more per metre than a mill does, and we
                would rather pay that than shorten the weave. What you are paying for
                is the yarn, the weaver&apos;s time, and a piece that stays in your
                wardrobe long enough to justify both.
              </p>
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
