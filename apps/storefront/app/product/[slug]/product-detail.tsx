'use client';

/**
 * The interactive half of the product page: the gallery and the buy box.
 *
 * The buy box picks a variant and a quantity and drops a line in the local
 * bag. It deliberately does not compute anything that money depends on — the
 * price shown is the one the server sent, and checkout will price the order
 * again from the database before it reaches Razorpay.
 */

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Heart,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPaise } from '@mridul/utils';
import type { ProductListItem } from '@mridul/types';
import { useStore } from '@/app/providers/store-provider';
import { flyToBag } from '@/app/components/silk-interactions';

/** Below this many units we say so, to be honest about a short run. */
const LOW_STOCK_THRESHOLD = 5;

export function ProductGallery({ product }: { product: ProductListItem }) {
  const [active, setActive] = useState(0);
  const image = product.images[active] ?? product.images[0];

  return (
    <div className="pdp-gallery">
      <div className="pdp-stage">
        <Image
          src={image.url}
          alt={image.alt}
          fill
          sizes="(max-width: 900px) 100vw, 48vw"
          priority
          style={{ objectPosition: image.focal }}
        />
      </div>
      {product.images.length > 1 && (
        <div className="pdp-thumbs" role="tablist" aria-label="Product images">
          {product.images.map((item, index) => (
            <button
              aria-label={item.alt}
              aria-selected={index === active}
              className={index === active ? 'is-active' : undefined}
              key={item.id}
              onClick={() => setActive(index)}
              role="tab"
              type="button"
            >
              <Image
                src={item.url}
                alt=""
                fill
                sizes="72px"
                style={{ objectPosition: item.focal }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductPurchase({
  product,
  freeShippingThresholdPaise,
}: {
  product: ProductListItem;
  freeShippingThresholdPaise: number;
}) {
  const { addLine, toggleWishlist, isWishlisted, notify } = useStore();
  const router = useRouter();

  // Default to the first variant that can actually be bought.
  const [variantId, setVariantId] = useState(
    () =>
      (product.variants.find((item) => item.stock > 0) ?? product.variants[0])
        .id,
  );
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const variant =
    product.variants.find((item) => item.id === variantId) ??
    product.variants[0];
  const unitPricePaise = product.pricePaise + variant.priceDeltaPaise;
  const liked = isWishlisted(product.id);
  const maxQuantity = Math.max(1, Math.min(variant.stock, 10));

  /** Puts the line in the bag. Shared so Buy now cannot drift from Add to bag. */
  function putInBag() {
    addLine(
      {
        productId: product.id,
        productSlug: product.slug,
        variantId: variant.id,
        name: product.name,
        variantLabel: variant.label,
        unitPricePaise,
        image: {
          url: product.images[0].url,
          focal: product.images[0].focal,
          alt: product.images[0].alt,
        },
      },
      quantity,
    );
  }

  function add(event: React.MouseEvent<HTMLButtonElement>) {
    if (variant.stock <= 0) return;
    putInBag();
    setAdded(true);
    flyToBag(event.currentTarget);
    notify(`${product.name} added to bag.`, {
      label: 'View bag',
      href: '/bag',
    });
  }

  /* Straight to checkout. No toast and no fly-to-bag: both of those exist to
     tell you something happened somewhere else on the page, and here the page
     itself is about to change. */
  function buyNow() {
    if (variant.stock <= 0) return;
    putInBag();
    router.push('/checkout');
  }

  function chooseVariant(id: string) {
    setVariantId(id);
    setQuantity(1);
    setAdded(false);
  }

  return (
    <div className="pdp-buy">
      <div className="pdp-price">
        <strong>{formatPaise(unitPricePaise)}</strong>
        {product.compareAtPaise && <s>{formatPaise(product.compareAtPaise)}</s>}
        {product.discountPercent > 0 && (
          <span className="pdp-saving">{product.discountPercent}% off</span>
        )}
      </div>
      <p className="pdp-tax-note">
        Inclusive of all taxes. Shipping shown at checkout.
      </p>

      <fieldset className="pdp-variants">
        <legend>
          {product.categorySlug === 'blouses' ? 'Size' : 'Choose your drape'}
        </legend>
        <div className="pdp-variant-row">
          {product.variants.map((item) => (
            <button
              aria-pressed={item.id === variant.id}
              className={`pdp-variant${item.id === variant.id ? ' is-on' : ''}`}
              disabled={product.isSoldOut || item.stock <= 0}
              key={item.id}
              onClick={() => chooseVariant(item.id)}
              type="button"
            >
              {item.label}
              {item.priceDeltaPaise > 0 && (
                <small>+{formatPaise(item.priceDeltaPaise)}</small>
              )}
            </button>
          ))}
        </div>
      </fieldset>

      {product.isSoldOut ? (
        <p className="pdp-stock is-out">Currently sold out — check back soon</p>
      ) : variant.stock <= 0 ? (
        <p className="pdp-stock is-out">Sold out in this option</p>
      ) : variant.stock <= LOW_STOCK_THRESHOLD ? (
        <div className="pdp-stock is-low">
          <p>Only {variant.stock} left — we weave these in small runs</p>
          {/* The bar is the real count against the threshold that made this
              line appear. It is not a countdown and nothing about it is
              invented: a shop that fakes scarcity is lying to its customers. */}
          <span
            aria-hidden="true"
            className="pdp-stock-bar"
            style={{
              // eslint-disable-next-line
              ['--left' as string]: `${Math.round((variant.stock / LOW_STOCK_THRESHOLD) * 100)}%`,
            }}
          />
        </div>
      ) : (
        <p className="pdp-stock">In stock, ready to ship</p>
      )}

      <div className="pdp-actions">
        <div className="pdp-quantity">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reduce quantity"
            disabled={quantity <= 1}
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
          >
            <Minus aria-hidden="true" />
          </Button>
          <span aria-live="polite">{quantity}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Increase quantity"
            disabled={quantity >= maxQuantity}
            onClick={() =>
              setQuantity((value) => Math.min(maxQuantity, value + 1))
            }
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>
        <Button
          className="pdp-add"
          disabled={product.isSoldOut || variant.stock <= 0}
          onClick={add}
        >
          <ShoppingBag aria-hidden="true" />
          {added ? 'Added to bag' : 'Add to bag'}
        </Button>
        <Button
          className="pdp-buy-now"
          disabled={product.isSoldOut || variant.stock <= 0}
          onClick={buyNow}
        >
          Buy now
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={`${liked ? 'Remove' : 'Add'} ${product.name} ${liked ? 'from' : 'to'} wishlist`}
          aria-pressed={liked}
          className="pdp-wishlist"
          onClick={() => {
            const saved = toggleWishlist(product.id);
            notify(
              saved
                ? `${product.name} saved.`
                : `${product.name} removed from wishlist.`,
              saved ? { label: 'View wishlist', href: '/wishlist' } : undefined,
            );
          }}
        >
          <Heart aria-hidden="true" fill={liked ? 'currentColor' : 'none'} />
        </Button>
      </div>

      <ul className="pdp-assurances">
        <li>
          <Truck aria-hidden="true" />
          Free shipping above {formatPaise(freeShippingThresholdPaise)}.
          Delivery charge is calculated from your pincode at checkout.
        </li>
        <li>
          <ShieldCheck aria-hidden="true" />
          Secure payment through Razorpay. Order updates on WhatsApp.
        </li>
      </ul>
    </div>
  );
}
