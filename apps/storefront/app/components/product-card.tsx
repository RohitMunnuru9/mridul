'use client';

/**
 * The one product card used by the listing grid, every rail and the wishlist,
 * so a product looks the same wherever it appears.
 *
 * Every displayed value — price, discount, stock — arrives already computed
 * from the repository. The card formats, it does not decide.
 *
 * The action button changes with the product: a piece with one buyable option
 * can go straight into the bag, but anything with a real choice to make sends
 * you to the product page instead of guessing a variant on your behalf.
 */

import Image from 'next/image';
import { useRef } from 'react';
import Link from 'next/link';
import { Heart, ShoppingBag, Star } from 'lucide-react';
import { badgeLabel, formatPaise } from '@mridul/utils';
import type { ProductListItem } from '@mridul/types';
import { useStore } from '../providers/store-provider';
import { flyToBag } from './silk-interactions';

export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductListItem;
  priority?: boolean;
}) {
  const { addLine, toggleWishlist, isWishlisted, notify } = useStore();
  const liked = isWishlisted(product.id);
  const card = useRef<HTMLElement>(null);
  const [primary, secondary] = product.images;
  const label = badgeLabel(product.badge);
  const href = `/product/${product.slug}`;

  const buyable = product.variants.filter((variant) => variant.stock > 0);
  const canQuickAdd = buyable.length === 1;

  function quickAdd() {
    const variant = buyable[0];
    if (!variant) return;
    addLine({
      productId: product.id,
      productSlug: product.slug,
      variantId: variant.id,
      name: product.name,
      variantLabel: variant.label,
      unitPricePaise: product.pricePaise + variant.priceDeltaPaise,
      image: { url: primary.url, focal: primary.focal, alt: primary.alt },
    });
    notify(`${product.name} added to bag.`, {
      label: 'View bag',
      href: '/bag',
    });
    if (card.current) flyToBag(card.current, primary.url);
  }

  function onWishlist() {
    const added = toggleWishlist(product.id);
    notify(
      added
        ? `${product.name} saved.`
        : `${product.name} removed from wishlist.`,
      added ? { label: 'View wishlist', href: '/wishlist' } : undefined,
    );
  }

  return (
    <article
      ref={card}
      className={`product-card${product.inStock ? '' : ' is-sold-out'}`}
    >
      {/* Photo, heart and action share one box, so the action can sit at the
          bottom of the picture rather than the bottom of the whole card —
          where it was covering the name and price. */}
      <div className="product-media">
        <Link className="product-photo" href={href} data-cursor="VIEW">
          <Image
            src={primary.url}
            alt={primary.alt}
            fill
            sizes="(max-width: 720px) 50vw, 25vw"
            priority={priority}
            style={{ objectPosition: primary.focal }}
          />
          {secondary && (
            <Image
              className="product-photo-alt"
              src={secondary.url}
              alt=""
              aria-hidden="true"
              fill
              sizes="(max-width: 720px) 50vw, 25vw"
              style={{ objectPosition: secondary.focal }}
            />
          )}
          <span className="product-flags">
            {label && <span className="product-badge">{label}</span>}
            {product.discountPercent > 0 && (
              <span className="product-badge is-sale">
                {product.discountPercent}% off
              </span>
            )}
          </span>
          {!product.inStock && (
            <span className="product-soldout">Sold out</span>
          )}
        </Link>

        <button
          aria-label={`${liked ? 'Remove' : 'Add'} ${product.name} ${liked ? 'from' : 'to'} wishlist`}
          aria-pressed={liked}
          className={`wishlist-button${liked ? ' is-on' : ''}`}
          onClick={onWishlist}
          type="button"
        >
          <Heart aria-hidden="true" fill={liked ? 'currentColor' : 'none'} />
        </button>

        {product.inStock &&
          (canQuickAdd ? (
            <button className="card-action" onClick={quickAdd} type="button">
              <ShoppingBag aria-hidden="true" />
              Add to bag
            </button>
          ) : (
            <Link className="card-action" href={href}>
              Select options
            </Link>
          ))}
      </div>

      <div className="product-details">
        {/* Name and price on one line: they are the two things a shopper is
            actually comparing, and stacking them made every card read as a
            paragraph. */}
        <div className="product-line">
          <h3>
            <Link href={href}>{product.name}</Link>
          </h3>
          <span className="product-price">
            {product.compareAtPaise && (
              <s>{formatPaise(product.compareAtPaise)}</s>
            )}
            <strong>{formatPaise(product.pricePaise)}</strong>
          </span>
        </div>

        <p className="product-meta">
          <span className="fabric-tag">{product.fabric}</span>
          <span className="product-subtitle">{product.subtitle}</span>
        </p>

        <div className="product-foot">
          {product.rating && (
            <span className="product-rating">
              <Star aria-hidden="true" fill="currentColor" />
              {product.rating.average.toFixed(1)}
              <small>({product.rating.count})</small>
            </span>
          )}
          <div className="swatches" aria-label="Available colours">
            {product.swatches.map((swatch) => (
              <span key={swatch} style={{ background: swatch }} />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
