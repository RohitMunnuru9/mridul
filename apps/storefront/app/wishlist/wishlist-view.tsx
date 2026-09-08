'use client';

/**
 * The wishlist.
 *
 * The browser stores ids only. The full catalogue is handed in from the
 * server, so a saved piece shows today's price and today's stock rather than
 * whatever was true when it was saved — and a product that has since been
 * retired quietly drops out instead of rendering a dead card.
 */

import Link from 'next/link';
import { ArrowRight, Heart, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProductListItem } from '@mridul/types';
import { ProductCard } from '@/app/components/product-card';
import { useStore } from '../providers/store-provider';

export function WishlistView({ catalogue }: { catalogue: ProductListItem[] }) {
  const { wishlist, addLine, toggleWishlist, notify } = useStore();

  const byId = new Map(catalogue.map((product) => [product.id, product]));
  const saved = wishlist
    .map((id) => byId.get(id))
    .filter((product): product is ProductListItem => Boolean(product));

  if (saved.length === 0) {
    return (
      <div className="empty-state">
        <Heart aria-hidden="true" />
        <h1>Nothing saved yet</h1>
        <p>
          Tap the heart on any piece to keep it here. Your wishlist stays on this
          device until you sign in.
        </p>
        <div className="empty-actions">
          <Link className="primary-cta" href="/shop/sarees">
            Browse sarees <ArrowRight aria-hidden="true" />
          </Link>
          <Link className="ghost-cta" href="/shop/blouses">
            Browse blouses
          </Link>
        </div>
      </div>
    );
  }

  /** Adds every saved piece that still has stock, in one go. */
  function addAllInStock() {
    const available = saved.filter((product) => product.inStock);
    for (const product of available) {
      const variant = product.variants.find((item) => item.stock > 0);
      if (!variant) continue;
      addLine({
        productId: product.id,
        productSlug: product.slug,
        variantId: variant.id,
        name: product.name,
        variantLabel: variant.label,
        unitPricePaise: product.pricePaise + variant.priceDeltaPaise,
        image: {
          url: product.images[0].url,
          focal: product.images[0].focal,
          alt: product.images[0].alt,
        },
      });
    }
    notify(
      `${available.length} ${available.length === 1 ? 'piece' : 'pieces'} added to bag.`,
      { label: 'View bag', href: '/bag' },
    );
  }

  const inStockCount = saved.filter((product) => product.inStock).length;

  return (
    <>
      <div className="wishlist-toolbar">
        <p>
          {saved.length} saved
          {inStockCount < saved.length && (
            <span> · {saved.length - inStockCount} out of stock</span>
          )}
        </p>
        <div className="wishlist-toolbar-actions">
          <Button disabled={inStockCount === 0} onClick={addAllInStock}>
            <ShoppingBag aria-hidden="true" />
            Add all in stock
          </Button>
          <button
            className="ghost-button"
            onClick={() => {
              saved.forEach((product) => toggleWishlist(product.id));
              notify('Wishlist cleared.');
            }}
            type="button"
          >
            Clear wishlist
          </button>
        </div>
      </div>

      <div className="product-grid density-compact">
        {saved.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </>
  );
}
