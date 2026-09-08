/**
 * A horizontal rail of products with a heading and a link out.
 *
 * Used wherever a page wants to suggest something without becoming a listing:
 * the bag, the wishlist, the shop index and the bottom of a product page.
 * Renders nothing when it has nothing to show, so callers do not each need
 * their own guard.
 */

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ProductListItem } from '@mridul/types';
import { ProductCard } from './product-card';

export function ProductRail({
  eyebrow,
  title,
  href,
  products,
}: {
  eyebrow: string;
  title: string;
  href?: string;
  products: ProductListItem[];
}) {
  if (products.length === 0) return null;

  return (
    <section className="product-rail" aria-labelledby={`rail-${title}`}>
      <div className="compact-section-heading">
        <div>
          <p>{eyebrow}</p>
          <h2 id={`rail-${title}`}>{title}</h2>
        </div>
        {href && (
          <Link href={href}>
            See all <ArrowRight aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="product-row">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
