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
import {
  AlertCircle,
  BadgeIndianRupee,
  CreditCard,
  MapPin,
  Wallet,
} from 'lucide-react';
import { formatPaise, imageAtWidth } from '@mridul/utils';
import { estimateShipping, type ShippingRates } from '@mridul/shipping';
import { useStore } from '../providers/store-provider';
import { placeOrder, type PaymentMethod } from './actions';
import { startCCAvenuePayment } from './ccavenue-action';

/**
 * Hand the browser over to CCAvenue.
 *
 * It has to be a real form POST to their domain — they do not accept a fetch,
 * and the customer has to end up on their page to type a card into it. So the
 * form is built, submitted and discarded here rather than sitting in the
 * markup where something could submit it early.
 */
function handOver(action: string, fields: Record<string, string>) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    // appendChild, not append: the Cloudflare Workers types this app is built
    // against declare an `append` of their own, and it wins here.
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

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
  buyNowOnly = false,
  onlinePayment = false,
}: {
  address: SavedAddress | null;
  email: string;
  rates: ShippingRates;
  /** Arrived here from "Buy now", so this checkout is one piece, not the bag. */
  buyNowOnly?: boolean;
  /** CCAvenue is configured on this deployment. Decided on the server — the
   *  browser is never told whether a key exists, only whether to offer the
   *  choice. */
  onlinePayment?: boolean;
}) {
  const store = useStore();
  const { couponCode, clearBag, clearBuyNow } = store;

  // Two different checkouts share this panel, and which one it is comes from
  // the URL rather than from guessing at the contents of the bag.
  const lines =
    buyNowOnly ? (store.buyNow ? [store.buyNow] : []) : store.lines;
  const subtotalPaise = buyNowOnly
    ? lines.reduce((total, line) => total + line.unitPricePaise * line.quantity, 0)
    : store.subtotalPaise;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState<PaymentMethod>(onlinePayment ? 'ccavenue' : 'cod');
  // Separate from `pending`: the transition has finished by the time the
  // browser is being sent to CCAvenue, and the button must not go back to
  // saying "Place order" during the second or two before the page changes.
  const [leaving, setLeaving] = useState(false);

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
        buyNowOnly ? '' : couponCode,
        notes,
        method,
      );

      if (!result.ok) {
        setError(result.message);
        return;
      }

      // Paying online: the order exists but is not paid for, and the bag stays
      // exactly as it is. If the card is declined the order is cancelled and
      // its stock released, and the customer lands back here with everything
      // they had — rather than an empty bag and a saree they never bought.
      if (result.needsPayment) {
        setLeaving(true);
        const handoff = await startCCAvenuePayment(result.orderId);
        if (!handoff.ok) {
          setLeaving(false);
          setError(handoff.message);
          return;
        }
        handOver(handoff.action, {
          encRequest: handoff.encRequest,
          access_code: handoff.accessCode,
        });
        return;
      }

      // Cash on delivery: the order is already confirmed, so the bag has done
      // its job. A Buy now order clears only itself — the bag was never part
      // of it.
      if (buyNowOnly) clearBuyNow();
      else clearBag();
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
            <h2>{buyNowOnly ? 'Nothing chosen' : 'Your bag is empty'}</h2>
          </div>
        </div>
        <p className="review-empty">
          {buyNowOnly
            ? 'This checkout was for one piece and it is no longer here. Open the piece again and choose Buy now, or '
            : 'Nothing to order yet. '}
          <Link href="/collections/new-arrivals">Browse new arrivals</Link>
          {buyNowOnly ? '.' : ' and come back.'}
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
          <h2>{buyNowOnly ? 'Buying this piece' : 'What you are ordering'}</h2>
        </div>
      </div>

      <ul className="review-lines">
        {lines.map((line) => (
          <li key={line.variantId}>
            <span className="review-photo">
              <Image
                src={imageAtWidth(line.image.url, 240)}
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
        {!buyNowOnly && couponCode && (
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
              <span className="review-address-email">
                Order updates to {email}
              </span>
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

      {onlinePayment ? (
        <fieldset className="review-pay-choice">
          <legend>How would you like to pay?</legend>

          <label className={method === 'ccavenue' ? 'is-chosen' : undefined}>
            <input
              checked={method === 'ccavenue'}
              name="payment_method"
              onChange={() => setMethod('ccavenue')}
              type="radio"
              value="ccavenue"
            />
            <CreditCard aria-hidden="true" />
            <span>
              <strong>Pay now — card, UPI or net banking</strong>
              <small>
                You will be taken to CCAvenue to pay. Your card details are
                entered on their page and never reach us.
              </small>
            </span>
          </label>

          <label className={method === 'cod' ? 'is-chosen' : undefined}>
            <input
              checked={method === 'cod'}
              name="payment_method"
              onChange={() => setMethod('cod')}
              type="radio"
              value="cod"
            />
            <Wallet aria-hidden="true" />
            <span>
              <strong>Cash on delivery</strong>
              <small>Pay the delivery partner when your parcel arrives.</small>
            </span>
          </label>
        </fieldset>
      ) : (
        <div className="review-payment">
          <Wallet aria-hidden="true" />
          <div>
            <strong>Cash on delivery</strong>
            <small>
              Pay the delivery partner when your parcel arrives. Card and UPI
              payment is being set up.
            </small>
          </div>
        </div>
      )}

      {error && (
        <p className="delivery-message is-bad" role="alert">
          {error}
        </p>
      )}

      <button
        className="delivery-submit"
        disabled={pending || leaving || !address}
        onClick={submit}
        type="button"
      >
        {leaving
          ? 'Taking you to the payment page…'
          : pending
            ? 'Placing your order…'
            : method === 'ccavenue'
              ? `Pay ${formatPaise(estimatedTotal)}`
              : 'Place order'}
      </button>
    </section>
  );
}
