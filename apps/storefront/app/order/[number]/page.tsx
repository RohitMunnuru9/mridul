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
  Wallet,
} from 'lucide-react';
import {
  fetchOrderByNumber,
  getSiteSettings,
  ORDER_PIPELINE,
  ORDER_STATUS_LABEL,
  type Order,
} from '@mridul/database';
import { sessionClient } from '@mridul/supabase/server';
import { formatDateTime, formatPaise } from '@mridul/utils';

export const metadata: Metadata = {
  title: 'Your order | Mridul by MR',
  description: 'The details of your order with Mridul by MR.',
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ number: string }> };

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

  // "Awaiting payment" never applies to a cash order, so the track a customer
  // sees starts at Confirmed.
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

export default async function OrderPage({ params }: PageProps) {
  const { number } = await params;
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
  const whatsapp = settings.contact.whatsapp.replace(/[^\d]/g, '');

  return (
    <div className="order-page page-shell">
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
                    <Image src={line.imageUrl} alt={line.name} fill sizes="88px" />
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
              <strong>{cash ? 'Cash on delivery' : 'Paid online'}</strong>
              <span>
                {cash
                  ? `Please keep ${formatPaise(order.totalPaise)} ready for the delivery partner.`
                  : 'Received in full.'}
              </span>
            </p>
            {order.notes && (
              <p className="order-notes">
                <em>Your note:</em> {order.notes}
              </p>
            )}
          </section>

          <section className="order-panel" aria-label="What happens next">
            <h2>What happens next</h2>
            <ol className="order-next">
              <li>We check the piece, press it and pack it by hand.</li>
              <li>You get a message with the courier and tracking number.</li>
              <li>
                {cash
                  ? 'Pay the delivery partner when it arrives.'
                  : 'Your parcel arrives at the address above.'}
              </li>
            </ol>
            {whatsapp && (
              <a
                className="order-help"
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(
                  `Hello, I have a question about order ${order.number}.`,
                )}`}
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
