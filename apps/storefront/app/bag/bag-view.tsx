'use client';

/**
 * The bag.
 *
 * Every figure here is a preview. Quantities and the coupon are the customer's
 * intent; the amount actually charged is recomputed at checkout from database
 * prices, current stock and a real shipping quote. That is why the summary
 * says "estimated" rather than presenting itself as a bill.
 */

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Heart,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPaise, imageAtWidth } from '@mridul/utils';
import {
  amountToFreeShipping,
  estimateShipping,
  type ShippingRates,
} from '@mridul/shipping';
import type { CouponResult } from '@mridul/types';
import { useStore } from '../providers/store-provider';
import { applyCoupon } from './coupon-action';

function FreeShippingMeter({
  subtotalPaise,
  rates,
}: {
  subtotalPaise: number;
  rates: ShippingRates;
}) {
  const remaining = amountToFreeShipping(subtotalPaise, rates);
  const progress = Math.min(
    100,
    Math.round((subtotalPaise / rates.freeShippingThresholdPaise) * 100),
  );

  return (
    <div className="shipping-meter">
      <p>
        <Truck aria-hidden="true" />
        {remaining === 0 ? (
          <>Your order ships free.</>
        ) : (
          <>
            Add <strong>{formatPaise(remaining)}</strong> more for free shipping.
          </>
        )}
      </p>
      <div
        aria-label={`${progress}% of the way to free shipping`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progress}
        className="shipping-meter-track"
        role="progressbar"
      >
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export function BagView({ rates }: { rates: ShippingRates }) {
  const {
    lines,
    subtotalPaise,
    couponCode,
    setQuantity,
    removeLine,
    moveLineToWishlist,
    setCouponCode,
    notify,
  } = useStore();

  // Seeded from the store so a code applied here survives a reload and is
  // still attached when the customer reaches checkout.
  const [code, setCode] = useState(couponCode);
  const [coupon, setCoupon] = useState<CouponResult | null>(null);
  const [checking, setChecking] = useState(false);

  const discountPaise = coupon?.ok ? coupon.discountPaise : 0;
  const shippingPaise = estimateShipping(subtotalPaise - discountPaise, rates);
  const totalPaise = subtotalPaise - discountPaise + shippingPaise;

  async function checkCoupon(event: React.FormEvent) {
    event.preventDefault();
    setChecking(true);
    try {
      const result = await applyCoupon(code, subtotalPaise);
      setCoupon(result);
      // Only the code travels to checkout. What it is worth is decided again
      // by the database against the server's own subtotal.
      setCouponCode(result.ok ? result.coupon.code : '');
      if (result.ok) notify(`${result.coupon.code} applied.`);
    } finally {
      setChecking(false);
    }
  }

  if (lines.length === 0) {
    return (
      <div className="empty-state">
        <ShoppingBag aria-hidden="true" />
        <h1>Your bag is empty</h1>
        <p>
          Nothing saved here yet. Start with the new arrivals, or browse the whole
          collection.
        </p>
        <div className="empty-actions">
          <Link className="primary-cta" href="/collections/new-arrivals">
            Shop new arrivals <ArrowRight aria-hidden="true" />
          </Link>
          <Link className="ghost-cta" href="/wishlist">
            View wishlist
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bag-layout">
      <section className="bag-lines" aria-label="Items in your bag">
        <FreeShippingMeter subtotalPaise={subtotalPaise} rates={rates} />

        {lines.map((line) => (
          <article className="bag-line" key={line.variantId}>
            <Link className="bag-line-photo" href={`/product/${line.productSlug}`}>
              <Image
                src={imageAtWidth(line.image.url, 240)}
                alt={line.image.alt}
                fill
                sizes="120px"
                style={{ objectPosition: line.image.focal }}
              />
            </Link>

            <div className="bag-line-body">
              <div className="bag-line-head">
                <div>
                  <h2>
                    <Link href={`/product/${line.productSlug}`}>{line.name}</Link>
                  </h2>
                  <p>{line.variantLabel}</p>
                </div>
                <button
                  aria-label={`Remove ${line.name} from bag`}
                  className="bag-line-remove"
                  onClick={() => {
                    removeLine(line.variantId);
                    notify(`${line.name} removed.`);
                  }}
                  type="button"
                >
                  <X aria-hidden="true" />
                </button>
              </div>

              <div className="bag-line-foot">
                <div className="quantity-stepper">
                  <button
                    aria-label={`Reduce quantity of ${line.name}`}
                    disabled={line.quantity <= 1}
                    onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                    type="button"
                  >
                    <Minus aria-hidden="true" />
                  </button>
                  <span aria-live="polite">{line.quantity}</span>
                  <button
                    aria-label={`Increase quantity of ${line.name}`}
                    disabled={line.quantity >= 10}
                    onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                    type="button"
                  >
                    <Plus aria-hidden="true" />
                  </button>
                </div>

                <button
                  className="bag-line-save"
                  onClick={() => {
                    moveLineToWishlist(line.variantId);
                    notify(`${line.name} moved to wishlist.`, {
                      label: 'View wishlist',
                      href: '/wishlist',
                    });
                  }}
                  type="button"
                >
                  <Heart aria-hidden="true" />
                  Save for later
                </button>

                <strong className="bag-line-total">
                  {formatPaise(line.unitPricePaise * line.quantity)}
                </strong>
              </div>
            </div>
          </article>
        ))}
      </section>

      <aside className="bag-summary" aria-label="Order summary">
        <h2>Order summary</h2>

        <form className="coupon-form" onSubmit={checkCoupon}>
          <label className="sr-only" htmlFor="coupon-code">
            Discount code
          </label>
          <div>
            <Tag aria-hidden="true" />
            <input
              autoComplete="off"
              id="coupon-code"
              onChange={(event) => setCode(event.target.value)}
              placeholder="Discount code"
              value={code}
            />
          </div>
          <Button disabled={checking || !code.trim()} type="submit" variant="outline">
            {checking ? 'Checking…' : 'Apply'}
          </Button>
        </form>

        {coupon && (
          <p className={`coupon-feedback${coupon.ok ? ' is-ok' : ' is-bad'}`}>
            {coupon.ok ? coupon.coupon.description : coupon.reason}
          </p>
        )}

        <dl className="summary-rows">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatPaise(subtotalPaise)}</dd>
          </div>
          {discountPaise > 0 && (
            <div className="is-discount">
              <dt>Discount</dt>
              <dd>−{formatPaise(discountPaise)}</dd>
            </div>
          )}
          <div>
            <dt>Shipping</dt>
            <dd>{shippingPaise === 0 ? 'Free' : formatPaise(shippingPaise)}</dd>
          </div>
          <div className="summary-total">
            <dt>Estimated total</dt>
            <dd>{formatPaise(totalPaise)}</dd>
          </div>
        </dl>

        <p className="summary-note">
          Shipping is an estimate until a delivery pincode is entered. The final
          amount is calculated on our server before payment.
        </p>

        <Link className="checkout-cta" href="/checkout">
          Proceed to checkout <ArrowRight aria-hidden="true" />
        </Link>
        <p className="checkout-pending">
          Sign in securely, then confirm where we should send your order.
        </p>

        <ul className="bag-assurances">
          <li>
            <ShieldCheck aria-hidden="true" />
            Pay cash when your parcel arrives
          </li>
          <li>
            <Truck aria-hidden="true" />
            Free shipping above {formatPaise(rates.freeShippingThresholdPaise)}
          </li>
        </ul>
      </aside>
    </div>
  );
}

