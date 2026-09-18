import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Truck,
  Wallet,
} from 'lucide-react';
import {
  fetchOrderByNumber,
  getSiteSettings,
  isPaidFor,
  ORDER_PIPELINE,
  ORDER_STATUS_LABEL,
  type Order,
} from '@mridul/database';
import { sessionClient } from '@mridul/supabase/server';
import { ClearBagOnPaid } from './clear-bag';
import { RetryPayment } from './retry-payment';
import {
  formatDateTime,
  formatPaise,
  imageAtWidth,
  whatsappLink,
} from '@mridul/utils';

export const metadata: Metadata = {
  title: 'Your order | Mridul by MR',
  description: 'The details of your order with Mridul by MR.',
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ payment?: string }>;
};

/**
 * Where this order has reached, and what is still ahead of it. Cancelled,
 * returned and refunded orders leave the pipeline, so they show the exit
 * instead of a half-drawn track.
 */
function Progress({ order }: { order: Order }) {
  const index = ORDER_PIPELINE.indexOf(order.status);
  if (index === -1) {
    return (
      <p className="order-exit">
        This order is {ORDER_STATUS_LABEL[order.status].toLowerCase()}.
      </p>
    );
  }

  // An order that has not been paid for has not started. Drawing the track
  // with "Confirmed" lit would tell somebody whose card was declined that
  // their saree is being packed.
  if (order.status === 'pending_payment') {
    return (
      <p className="order-exit">
        This order has not been paid for yet, so nothing has started on it.
      </p>
    );
  }

  // "Awaiting payment" is handled above, so the track a customer sees starts
  // at Confirmed.
  const steps = ORDER_PIPELINE.slice(1);
  const reached = Math.max(0, index - 1);

  return (
    <ol className="order-track" aria-label="Order progress">
      {steps.map((step, position) => (
        <li
          className={
            position < reached ? 'is-done' : position === reached ? 'is-now' : undefined
          }
          key={step}
        >
          <span aria-hidden="true" />
          {ORDER_STATUS_LABEL[step]}
        </li>
      ))}
    </ol>
  );
}

export default async function OrderPage({ params, searchParams }: PageProps) {
  const { number } = await params;
  const { payment } = await searchParams;
  const db = await sessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(`/auth?next=${encodeURIComponent(`/order/${number}`)}`);

  // Row-level security does the checking: an order belonging to someone else
  // simply is not there, so a guessed order number is a 404 rather than a leak.
  const [order, settings] = await Promise.all([
    fetchOrderByNumber(db, decodeURIComponent(number)),
    getSiteSettings(),
  ]);
  if (!order) notFound();

  const cash = order.paymentMethod === 'cod';
  // The money is only real once it has been verified against the gateway —
  // the same test the admin and the database use. Saying "Paid online" on an
  // order whose card was declined is the one thing this page must not do.
  const paid = isPaidFor(order);
  const unpaid = !cash && order.status === 'pending_payment';
  // Null while the shop's number is still the seed value, so the order page
  // never offers a chat with a number that does not exist.
  const askHref = whatsappLink(
    settings.contact.whatsapp,
    `Hello, I have a question about order ${order.number}.`,
  );

  // The bag is only let go once the money is in.  is set by the
  // gateway callback after it has verified with CCAvenue directly — but this
  // still checks the order's own status, so a hand-typed query string empties
  // nothing.
  const paidOnline = payment === 'paid' && !cash && order.status !== 'pending_payment';

  return (
    <div className="order-page page-shell">
      {paidOnline && <ClearBagOnPaid />}

      {payment === 'pending' && (
        <p className="order-payment-note is-waiting" role="status">
          We could not confirm your payment with the bank just yet. Nothing has
          been charged twice — if money has left your account, this order will
          update shortly and we will be in touch.
        </p>
      )}
      {payment === 'mismatch' && (
        <p className="order-payment-note is-waiting" role="status">
          Your payment came back for a different amount than this order. We have
          held it for a person to check rather than confirming it, and we will
          contact you today.
        </p>
      )}

      <header className="order-banner">
        <CheckCircle2 aria-hidden="true" />
        <div>
          <p className="eyebrow">Order {order.number}</p>
          <h1>Thank you — we have your order</h1>
          <p>
            Placed {formatDateTime(order.placedAt)}. A confirmation is on its way
            to {order.email ?? 'your email'}.
          </p>
        </div>
        <span className={`order-status is-${order.status}`}>
          {ORDER_STATUS_LABEL[order.status]}
        </span>
      </header>

      <Progress order={order} />

      <div className="order-grid">
        <section className="order-panel" aria-label="What you ordered">
          <h2>
            <Package aria-hidden="true" /> Your pieces
          </h2>
          <ul className="order-lines">
            {order.lines.map((line) => (
              <li key={line.id}>
                <span className="order-line-photo">
                  {line.imageUrl ? (
                    <Image
                      src={imageAtWidth(line.imageUrl, 240)}
                      alt={line.name}
                      fill
                      sizes="88px"
                    />
                  ) : (
                    <Package aria-hidden="true" />
                  )}
                </span>
                <span className="order-line-body">
                  {line.productSlug ? (
                    <Link href={`/product/${line.productSlug}`}>{line.name}</Link>
                  ) : (
                    <strong>{line.name}</strong>
                  )}
                  <small>
                    {line.variantLabel}
                    {line.sku ? ` · ${line.sku}` : ''}
                  </small>
                  <small>
                    {formatPaise(line.unitPricePaise)} × {line.quantity}
                  </small>
                </span>
                <span className="order-line-amount">
                  {formatPaise(line.lineTotalPaise)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="order-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatPaise(order.subtotalPaise)}</dd>
            </div>
            {order.discountPaise > 0 && (
              <div className="is-discount">
                <dt>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</dt>
                <dd>−{formatPaise(order.discountPaise)}</dd>
              </div>
            )}
            <div>
              <dt>Shipping</dt>
              <dd>
                {order.shippingPaise === 0 ? 'Free' : formatPaise(order.shippingPaise)}
              </dd>
            </div>
            <div className="order-total">
              <dt>{cash ? 'To pay on delivery' : 'Total'}</dt>
              <dd>{formatPaise(order.totalPaise)}</dd>
            </div>
          </dl>
        </section>

        <div className="order-side">
          <section className="order-panel" aria-label="Delivery details">
            <h2>
              <MapPin aria-hidden="true" /> Delivering to
            </h2>
            <address>
              <strong>{order.address.fullName}</strong>
              <br />
              {order.address.line1}
              {order.address.line2 ? (
                <>
                  <br />
                  {order.address.line2}
                </>
              ) : null}
              {order.address.landmark ? (
                <>
                  <br />
                  Near {order.address.landmark}
                </>
              ) : null}
              <br />
              {order.address.city}, {order.address.state}
              <br />
              {order.address.pincode}
            </address>
            {/*
              Two different things, and saying which is which matters: the
              number is the one given for this delivery, the email is the one
              the account was created with. They are often not the same person's
              habit, and an unlabelled pair looks like a mistake.
            */}
            <ul className="order-contact">
              <li>
                <Phone aria-hidden="true" />
                <span>
                  <small>Delivery contact</small>
                  {order.phone ?? order.address.phone}
                </span>
              </li>
              <li>
                <Mail aria-hidden="true" />
                <span>
                  <small>Order updates sent to</small>
                  {order.email ?? '—'}
                </span>
              </li>
            </ul>
          </section>

          <section className="order-panel" aria-label="Payment">
            <h2>
              <Wallet aria-hidden="true" /> Payment
            </h2>
            <p className="order-payment">
              <strong>
                {cash
                  ? 'Cash on delivery'
                  : paid
                    ? 'Paid online'
                    : 'Not paid yet'}
              </strong>
              <span>
                {cash
                  ? `Please keep ${formatPaise(order.totalPaise)} ready for the delivery partner.`
                  : paid
                    ? 'Received in full.'
                    : 'We are holding these pieces for you. Complete the payment and your order is on its way.'}
              </span>
            </p>

            {unpaid && (
              <RetryPayment amount={formatPaise(order.totalPaise)} orderId={order.id} />
            )}
            {order.notes && (
              <p className="order-notes">
                <em>Your note:</em> {order.notes}
              </p>
            )}
          </section>

          {order.shipment && (
            <section className="order-panel" aria-label="Tracking">
              <h2>
                <Truck aria-hidden="true" /> On its way
              </h2>
              <p className="order-payment">
                <strong>{order.shipment.provider}</strong>
                <span>
                  Tracking number <code>{order.shipment.awb}</code>
                  {order.shipment.shippedAt
                    ? ` · handed over ${formatDateTime(order.shipment.shippedAt)}`
                    : ''}
                </span>
              </p>
              {order.shipment.trackingUrl && (
                <a
                  className="order-track-link"
                  href={order.shipment.trackingUrl}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  Track this parcel
                  <ArrowRight aria-hidden="true" />
                </a>
              )}
              {order.shipment.deliveredAt && (
                <p className="order-notes">
                  Delivered {formatDateTime(order.shipment.deliveredAt)}.
                </p>
              )}
            </section>
          )}

          <section className="order-panel" aria-label="What happens next">
            <h2>What happens next</h2>
            <ol className="order-next">
              {unpaid && <li>Complete the payment above — nothing starts until then.</li>}
              <li>We check the piece, press it and pack it by hand.</li>
              <li>
                {order.shipment
                  ? `Handed to ${order.shipment.provider} — the tracking number is above.`
                  : 'You get a message with the courier and tracking number.'}
              </li>
              <li>
                {cash
                  ? 'Pay the delivery partner when it arrives.'
                  : 'Your parcel arrives at the address above.'}
              </li>
            </ol>
            {askHref && (
              <a
                className="order-help"
                href={askHref}
                rel="noreferrer noopener"
                target="_blank"
              >
                <MessageCircle aria-hidden="true" /> Ask about this order
              </a>
            )}
          </section>
        </div>
      </div>

      <div className="order-foot">
        <Link className="primary-cta" href="/account">
          All your orders <ArrowRight aria-hidden="true" />
        </Link>
        <Link className="ghost-cta" href="/collections/new-arrivals">
          Keep browsing
        </Link>
      </div>
    </div>
  );
}
