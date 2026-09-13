'use client';

/**
 * The last step: review and place.
 *
 * Every figure on this panel is an estimate and says so. The bag lives in this
 * browser, so the prices it remembers are a snapshot from whenever each piece
 * was added — they are shown because a customer needs to recognise what they
 * are buying, not because they decide anything. What is actually charged is
 * calculated by `place_order` in the database from the current catalogue, and
 * the confirmation page shows those figures instead.
 *
 * All this component sends is a list of variant ids and quantities.
 */

import { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, BadgeIndianRupee, MapPin, Wallet } from 'lucide-react';
import { formatPaise } from '@mridul/utils';
import { estimateShipping, type ShippingRates } from '@mridul/shipping';
import { useStore } from '../providers/store-provider';
import { placeOrder } from './actions';

type SavedAddress = {
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
};

export function PlaceOrderPanel({
  address,
  email,
  rates,
}: {
  address: SavedAddress | null;
  email: string;
  rates: ShippingRates;
}) {
  const { lines, subtotalPaise, couponCode, clearBag } = useStore();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');

  const shippingPaise = estimateShipping(subtotalPaise, rates);
  const estimatedTotal = subtotalPaise + shippingPaise;

  function submit() {
    setError('');
    startTransition(async () => {
      const result = await placeOrder(
        lines.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
        })),
        couponCode,
        notes,
      );

      if (!result.ok) {
        setError(result.message);
        return;
      }

      // The bag is emptied only once the order exists, so a failure leaves the
      // customer exactly where they were rather than with nothing to retry.
      clearBag();
      router.push(`/order/${result.orderNumber}`);
    });
  }

  if (lines.length === 0) {
    return (
      <section className="checkout-section">
        <div className="checkout-section-head">
          <span>
            <BadgeIndianRupee aria-hidden="true" />
          </span>
          <div>
            <small>Review</small>
            <h2>Your bag is empty</h2>
          </div>
        </div>
        <p className="review-empty">
          Nothing to order yet. <Link href="/collections/new-arrivals">Browse new arrivals</Link>{' '}
          and come back.
        </p>
      </section>
    );
  }

  return (
    <section className="checkout-section review-section">
      <div className="checkout-section-head">
        <span>
          <BadgeIndianRupee aria-hidden="true" />
        </span>
        <div>
          <small>Review</small>
          <h2>What you are ordering</h2>
        </div>
      </div>

      <ul className="review-lines">
        {lines.map((line) => (
          <li key={line.variantId}>
            <span className="review-photo">
              <Image
                src={line.image.url}
                alt={line.image.alt}
                fill
                sizes="72px"
                style={{ objectPosition: line.image.focal }}
              />
            </span>
            <span className="review-line-body">
              <strong>{line.name}</strong>
              <small>
                {line.variantLabel} · Qty {line.quantity}
              </small>
            </span>
            <span className="review-line-amount">
              {formatPaise(line.unitPricePaise * line.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="review-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatPaise(subtotalPaise)}</dd>
        </div>
        <div>
          <dt>Shipping</dt>
          <dd>{shippingPaise === 0 ? 'Free' : formatPaise(shippingPaise)}</dd>
        </div>
        {couponCode && (
          <div className="is-discount">
            <dt>Code applied</dt>
            <dd>{couponCode.toUpperCase()}</dd>
          </div>
        )}
        <div className="review-total">
          <dt>Estimated total</dt>
          <dd>{formatPaise(estimatedTotal)}</dd>
        </div>
      </dl>

      <p className="review-note">
        These are the prices your browser remembers. The amount you actually pay
        is calculated on our server from the current catalogue and shown on your
        confirmation — including any discount your code is worth today.
      </p>

      {address ? (
        <div className="review-address">
          <MapPin aria-hidden="true" />
          <div>
            <small>Delivering to</small>
            <p>
              <strong>{address.fullName}</strong> · {address.phone}
              <br />
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ''}
              {address.landmark ? `, ${address.landmark}` : ''}
              <br />
              {address.city}, {address.state} — {address.pincode}
              <br />
              <span className="review-address-email">{email}</span>
            </p>
          </div>
        </div>
      ) : (
        <p className="review-blocked">
          <AlertCircle aria-hidden="true" />
          Save your contact and delivery details above, then place the order.
        </p>
      )}

      <label className="review-notes">
        <span>Anything we should know? (optional)</span>
        <textarea
          maxLength={400}
          name="notes"
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Gift wrap, a delivery time that suits you, a blouse measurement to note"
          rows={2}
          value={notes}
        />
      </label>

      <div className="review-payment">
        <Wallet aria-hidden="true" />
        <div>
          <strong>Cash on delivery</strong>
          <small>
            Pay the delivery partner when your parcel arrives. Card and UPI
            payment through Razorpay is being set up.
          </small>
        </div>
      </div>

      {error && (
        <p className="delivery-message is-bad" role="alert">
          {error}
        </p>
      )}

      <button
        className="delivery-submit"
        disabled={pending || !address}
        onClick={submit}
        type="button"
      >
        {pending ? 'Placing your order…' : 'Place order'}
      </button>
    </section>
  );
}
