import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Mail, MapPin, Phone, UserRound, Wallet } from 'lucide-react';
import {
  fetchOrderById,
  ORDER_EXITS,
  ORDER_PIPELINE,
  ORDER_STATUS_LABEL,
} from '@mridul/database';
import { can, currentAdmin, sessionClient } from '@mridul/supabase/server';
import { formatDateTime, formatPaise } from '@mridul/utils';
import { updateOrderNote, updateOrderStatus } from '../../../actions/orders';
import { EditForm, Select, TextArea } from '../../../components/form';
import { PageHead } from '../../../components/ui';

export const metadata: Metadata = { title: 'Order | Mridul Admin' };

type PageProps = { params: Promise<{ id: string }> };

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const db = await sessionClient();
  const order = await fetchOrderById(db, id);
  if (!order) notFound();

  const admin = await currentAdmin();
  const canEdit = can(admin, 'order_manager');
  const closed = ['cancelled', 'returned', 'refunded'].includes(order.status);
  const cash = order.paymentMethod === 'cod';
  const collected = order.payment?.status === 'paid';

  return (
    <>
      <Link className="internal-link back-link" href="/orders">
        <ChevronLeft aria-hidden="true" /> All orders
      </Link>

      <PageHead
        title={order.number}
        subtitle={`Placed ${formatDateTime(order.placedAt)}`}
        actions={
          <span className={`order-pill is-${order.status}`}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>
        }
      />

      <div className="order-detail">
        <div className="order-detail-main">
          <section className="panel">
            <div className="panel-head">
              <h2>What was ordered</h2>
              <p>
                Names and prices are copies taken when the order was placed, so
                editing the product later never changes this.
              </p>
            </div>
            <div className="order-items-table">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Piece</th>
                    <th scope="col">SKU</th>
                    <th scope="col">Unit</th>
                    <th scope="col">Qty</th>
                    <th scope="col">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="order-item-cell">
                        {line.imageUrl && (
                          <span className="media-thumb" style={{ width: 44, height: 44 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={line.imageUrl} alt="" />
                          </span>
                        )}
                        <span>
                          <strong>{line.name}</strong>
                          <small>{line.variantLabel}</small>
                        </span>
                      </td>
                      <td>
                        <code>{line.sku || '—'}</code>
                      </td>
                      <td className="numeric">{formatPaise(line.unitPricePaise)}</td>
                      <td className="numeric">{line.quantity}</td>
                      <td className="numeric">
                        <strong>{formatPaise(line.lineTotalPaise)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="order-detail-totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatPaise(order.subtotalPaise)}</dd>
              </div>
              {order.discountPaise > 0 && (
                <div>
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
              <div className="is-total">
                <dt>Total</dt>
                <dd>{formatPaise(order.totalPaise)}</dd>
              </div>
            </dl>
          </section>

          {order.notes && (
            <section className="panel">
              <div className="panel-head">
                <h2>What the customer wrote</h2>
                <p>Typed at checkout. Not editable here.</p>
              </div>
              <p className="order-customer-note">{order.notes}</p>
            </section>
          )}

          <section className="panel">
            <div className="panel-head">
              <h2>Your note</h2>
              <p>Only the shop sees this. The customer never does.</p>
            </div>
            {canEdit ? (
              <EditForm action={updateOrderNote} submitLabel="Save note">
                <input name="id" type="hidden" value={order.id} />
                <TextArea
                  defaultValue={order.staffNotes}
                  hint="Called, delivering Saturday. Blouse to be stitched to 38."
                  label="Note about this order"
                  name="staff_notes"
                  rows={3}
                />
              </EditForm>
            ) : (
              <p className="order-customer-note">{order.staffNotes || 'No note.'}</p>
            )}
          </section>
        </div>

        <div className="order-detail-side">
          <section className="panel">
            <div className="panel-head">
              <h2>Customer</h2>
            </div>
            <ul className="order-facts">
              <li>
                <UserRound aria-hidden="true" />
                <strong>{order.address.fullName}</strong>
              </li>
              <li>
                <Phone aria-hidden="true" />
                <a href={`tel:${order.phone ?? order.address.phone}`}>
                  {order.phone ?? order.address.phone}
                </a>
              </li>
              <li>
                <Mail aria-hidden="true" />
                {order.email ? <a href={`mailto:${order.email}`}>{order.email}</a> : '—'}
              </li>
            </ul>
            {order.customerId && (
              <Link className="internal-link" href={`/customers/${order.customerId}`}>
                See this customer
              </Link>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>
                <MapPin aria-hidden="true" /> Deliver to
              </h2>
            </div>
            <address className="order-address">
              {order.address.fullName}
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
              <br />
              {order.phone ?? order.address.phone}
            </address>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>
                <Wallet aria-hidden="true" /> Payment
              </h2>
            </div>
            <ul className="order-facts">
              <li>
                <strong>{cash ? 'Cash on delivery' : 'Online (Razorpay)'}</strong>
              </li>
              <li>
                {collected
                  ? `${formatPaise(order.totalPaise)} collected`
                  : `${formatPaise(order.totalPaise)} still to collect`}
              </li>
              {order.confirmedAt && <li>Confirmed {formatDateTime(order.confirmedAt)}</li>}
              {order.cancelledAt && <li>Cancelled {formatDateTime(order.cancelledAt)}</li>}
            </ul>
            {cash && !collected && (
              <p className="panel-note">
                Marking this order delivered records the cash as collected.
              </p>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Move this order on</h2>
              {closed && <p>This order is closed and cannot be reopened.</p>}
            </div>
            {canEdit && !closed ? (
              <EditForm action={updateOrderStatus} submitLabel="Update status">
                <input name="id" type="hidden" value={order.id} />
                <Select
                  defaultValue={order.status}
                  label="Status"
                  name="status"
                  options={[...ORDER_PIPELINE.filter((step) => step !== 'pending_payment'), ...ORDER_EXITS].map(
                    (step) => ({ value: step, label: ORDER_STATUS_LABEL[step] }),
                  )}
                />
                <p className="panel-note">
                  Cancelling, returning or refunding puts every piece on this
                  order back into stock.
                </p>
              </EditForm>
            ) : (
              !closed && <p className="panel-note">You can view orders but not change them.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
