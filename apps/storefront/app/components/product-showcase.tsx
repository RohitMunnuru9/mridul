'use client';

/**
 * Homepage product rail. Receives its products from the server so the
 * homepage and the listing page never disagree about price or stock.
 */

import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { ProductListItem } from '@mridul/types';
import { ProductCard } from './product-card';

export function ProductShowcase({ products }: { products: ProductListItem[] }) {
  const rowRef = useRef<HTMLDivElement>(null);

  function scroll(direction: -1 | 1) {
    rowRef.current?.scrollBy({
      left: direction * rowRef.current.clientWidth * 0.82,
      behavior: 'smooth',
    });
  }

  return (
    <section className="product-section" id="new-arrivals" aria-labelledby="product-title">
      <div className="product-heading">
        <div>
          <p>Fresh from the loom</p>
          <h2 id="product-title">Mridul&apos;s picks</h2>
        </div>
        <div className="product-heading-actions">
          <Link href="/collections/new-arrivals">View all</Link>
          <div className="product-navigation" aria-label="Product carousel controls">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous products"
              onClick={() => scroll(-1)}
            >
              <ArrowLeft aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next products"
              onClick={() => scroll(1)}
            >
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
      <div className="product-row" ref={rowRef}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      <Link className="view-all-link" href="/shop">
        Shop everything <ArrowRight aria-hidden="true" />
      </Link>
    </section>
  );
}
