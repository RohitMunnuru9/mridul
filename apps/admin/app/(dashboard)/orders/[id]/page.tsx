import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronLeft,
  Mail,
  MapPin,
  Phone,
  Printer,
  RotateCcw,
  Truck,
  UserRound,
  Wallet,
} from 'lucide-react';
import {
  fetchOrderById,
  fetchPaymentReference,
  fetchReturnsForOrder,
  isPaidFor,
  RETURN_REASON_LABEL,
  RETURN_STATUS_LABEL,
  ORDER_EXITS,
  ORDER_PIPELINE,
  ORDER_STATUS_LABEL,
  paymentMethodLabel,
} from '@mridul/database';
import { can, currentAdmin, sessionClient } from '@mridul/supabase/server';
import { formatDateTime, formatPaise } from '@mridul/utils';
import { COURIERS } from '@mridul/shipping';
import { decideReturn } from '../../../actions/returns';
import {
  markDelivered,
  recordDispatch,
  updateOrderNote,
  updateOrderStatus,
} from '../../../actions/orders';
import { EditForm, Field, Select, TextArea } from '../../../components/form';
import { PageHead } from '../../../components/ui';

export const metadata: Metadata = { title: 'Order | Mridul Admin' };

type PageProps = { params: Promise<{ id: string }> };

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const db = await sessionClient();
  const order = await fetchOrderById(db, id);
  if (!order) notFound();

  // Asked for on its own, because the column only exists from migration 0017
  // and a missing one would otherwise fail the whole order query. Null until
  // that is applied, which costs this page one line of small print.
  const [bankReference, returns] = await Promise.all([
    order.payment ? fetchPaymentReference(db, order.id) : Promise.resolve(null),
    fetchReturnsForOrder(db, order.id),
  ]);

  const admin = await currentAdmin();
  const canEdit = can(admin, 'order_manager');
  const closed = ['cancelled', 'returned', 'refunded'].includes(order.status);
  const cash = order.paymentMethod === 'cod';
  // Not `payment.status === 'paid'`. For anything paid online the money is
  // only real once it has been verified against the gateway, and that is the
  // same test the database applies before it will let this order be
  // dispatched — so the screen and the rule agree.
  const collected = isPaidFor(order);
  const awaitingPayment = !cash && order.status === 'pending_payment';

  return (
    <>
      <Link className="internal-link back-link" href="/orders">
        <ChevronLeft aria-hidden="true" /> All orders
      </Link>

      <PageHead
        title={order.number}
        subtitle={`Placed ${formatDateTime(order.placedAt)}`}
        actions={
          <>
            <span className={`order-pill is-${order.status}`}>
              {ORDER_STATUS_LABEL[order.status]}
            </span>
            {/*
              The step between marking an order ready and recording its
              tracking number: the label for the box and the note that goes
              inside it, rather than an address copied out by hand.
            */}
            <Link className="parcel-link" href={`/orders/${order.id}/slip`}>
              <Printer aria-hidden="true" /> Parcel paper
            </Link>
          </>
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
                <strong>{paymentMethodLabel(order.paymentMethod)}</strong>
              </li>
              <li>
                {collected
                  ? `${formatPaise(order.totalPaise)} received`
                  : `${formatPaise(order.totalPaise)} still to collect`}
              </li>
              {order.payment?.verifiedAt && (
                <li>Verified with the gateway {formatDateTime(order.payment.verifiedAt)}</li>
              )}
              {order.confirmedAt && <li>Confirmed {formatDateTime(order.confirmedAt)}</li>}
              {order.cancelledAt && <li>Cancelled {formatDateTime(order.cancelledAt)}</li>}
            </ul>

            {/* The gateway's own references. Not a gate on anything — they are
                here so a disputed payment can be looked up in CCAvenue's
                dashboard months later without going through the database. */}
            {!cash && (order.payment?.providerPaymentId || bankReference) && (
              <dl className="order-refs">
                {order.payment?.providerPaymentId && (
                  <div>
                    <dt>Gateway reference</dt>
                    <dd>
                      <code>{order.payment.providerPaymentId}</code>
                    </dd>
                  </div>
                )}
                {bankReference && (
                  <div>
                    <dt>Bank reference</dt>
                    <dd>
                      <code>{bankReference}</code>
                    </dd>
                  </div>
                )}
                {order.payment?.method && (
                  <div>
                    <dt>Paid by</dt>
                    <dd>{order.payment.method}</dd>
                  </div>
                )}
              </dl>
            )}

            {cash && !collected && (
              <p className="panel-note">
                Marking this order delivered records the cash as collected.
              </p>
            )}

            {awaitingPayment && (
              <p className="panel-note is-warning">
                <strong>No money has been received for this order.</strong> The
                pieces on it are being held out of stock while it waits. If the
                customer is not going to pay, cancel it — that puts everything
                back on the shelf straight away.
              </p>
            )}
          </section>

          {/*
            Dispatch.
            
            The site tells the customer twice — on their order page and in the
            help panel — that they will get a tracking number. This is where it
            comes from. Everything that could be wrong about a dispatch is
            decided by the database, so a refusal here is a sentence, not a
            silent failure.
          */}
          <section className="panel">
            <div className="panel-head">
              <h2>
                <Truck aria-hidden="true" /> Dispatch
              </h2>
              {order.shipment ? (
                <p>
                  Handed to {order.shipment.provider}
                  {order.shipment.shippedAt
                    ? ` on ${formatDateTime(order.shipment.shippedAt)}`
                    : ''}
                  . Correcting anything below mends this record rather than
                  adding a second one.
                </p>
              ) : (
                <p>
                  Enter the courier and the number on their slip. The customer
                  sees both on their order page straight away.
                </p>
              )}
            </div>

            {order.shipment && (
              <ul className="order-facts">
                <li>
                  <strong>{order.shipment.awb}</strong>
                </li>
                {order.shipment.trackingUrl && (
                  <li>
                    <a
                      href={order.shipment.trackingUrl}
                      rel="noreferrer noopener"
                      target="_blank"
                    >
                      Open the courier&apos;s tracking page
                    </a>
                  </li>
                )}
                {order.shipment.deliveredAt && (
                  <li>Delivered {formatDateTime(order.shipment.deliveredAt)}</li>
                )}
              </ul>
            )}

            {canEdit && !closed ? (
              <>
                <EditForm
                  action={recordDispatch}
                  submitLabel={order.shipment ? 'Update dispatch' : 'Mark as shipped'}
                >
                  <input name="id" type="hidden" value={order.id} />
                  <Field
                    defaultValue={order.shipment?.provider ?? ''}
                    hint="Type any courier; the common ones are suggested."
                    label="Courier"
                    list="couriers"
                    name="provider"
                    required
                  />
                  <datalist id="couriers">
                    {COURIERS.map((courier) => (
                      <option key={courier.name} value={courier.name}>
                        {courier.name}
                      </option>
                    ))}
                  </datalist>
                  <Field
                    defaultValue={order.shipment?.awb ?? ''}
                    hint="The number on the courier's slip."
                    label="Tracking number"
                    name="awb"
                    required
                  />
                  <Field
                    defaultValue={order.shipment?.trackingUrl ?? ''}
                    hint="Optional. Left blank, we build one for couriers we know."
                    label="Tracking link"
                    name="tracking_url"
                  />
                </EditForm>

                {order.shipment && order.status !== 'delivered' && (
                  <EditForm action={markDelivered} submitLabel="Mark delivered" compact>
                    <input name="id" type="hidden" value={order.id} />
                  </EditForm>
                )}
              </>
            ) : (
              !closed && (
                <p className="panel-note">You can view orders but not dispatch them.</p>
              )
            )}
          </section>

          {returns.length > 0 && (
            <section className="panel">
              <div className="panel-head">
                <h2>
                  <RotateCcw aria-hidden="true" /> Returns
                </h2>
                <p>
                  Approving puts only the returned pieces back into stock. The
                  money moves by hand — cash back, or a refund in CCAvenue — and
                  is written down here once it has.
                </p>
              </div>

              {returns.map((request) => (
                <div className="return-request" key={request.id}>
                  <div className="return-request-head">
                    <strong>{RETURN_STATUS_LABEL[request.status]}</strong>
                    <small>
                      Asked {formatDateTime(request.requestedAt)} ·{' '}
                      {RETURN_REASON_LABEL[request.reason]}
                    </small>
                  </div>

                  <ul className="return-items">
                    {request.items.map((item) => {
                      const line = order.lines.find((l) => l.id === item.orderItemId);
                      return (
                        <li key={item.orderItemId}>
                          {item.quantity} × {line?.name ?? 'a piece'}
                          {line?.variantLabel ? ` · ${line.variantLabel}` : ''}
                          {line ? ` · ${formatPaise(line.unitPricePaise * item.quantity)}` : ''}
                        </li>
                      );
                    })}
                  </ul>

                  {request.note && (
                    <p className="return-note">
                      <em>Customer:</em> {request.note}
                    </p>
                  )}
                  {request.staffNote && (
                    <p className="return-note">
                      <em>You said:</em> {request.staffNote}
                    </p>
                  )}
                  {request.refundPaise !== null && (
                    <p className="return-note">
                      Refunded {formatPaise(request.refundPaise)}.
                    </p>
                  )}

                  {canEdit && request.status === 'requested' && (
                    <div className="return-decide">
                      <EditForm action={decideReturn} submitLabel="Approve" compact>
                        <input name="request_id" type="hidden" value={request.id} />
                        <input name="order_id" type="hidden" value={order.id} />
                        <input name="decision" type="hidden" value="approve" />
                      </EditForm>
                      <EditForm action={decideReturn} submitLabel="Decline" compact danger>
                        <input name="request_id" type="hidden" value={request.id} />
                        <input name="order_id" type="hidden" value={order.id} />
                        <input name="decision" type="hidden" value="decline" />
                        <Field
                          hint="The customer reads this."
                          label="Why"
                          name="staff_note"
                          required
                        />
                      </EditForm>
                    </div>
                  )}

                  {canEdit && request.status === 'approved' && (
                    <EditForm action={decideReturn} submitLabel="Record the refund" compact>
                      <input name="request_id" type="hidden" value={request.id} />
                      <input name="order_id" type="hidden" value={order.id} />
                      <input name="decision" type="hidden" value="refund" />
                      <Field
                        hint="In rupees, once the money has actually gone back."
                        label="Amount refunded"
                        name="refund"
                        required
                      />
                    </EditForm>
                  )}
                </div>
              ))}
            </section>
          )}

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
                  // An order still waiting to be paid for online can only be
                  // left alone or cancelled. Offering "Shipped" here would be
                  // offering to send a saree nobody has paid for — the
                  // database refuses it anyway, and a menu that leads only to
                  // an error message is a worse way to learn that.
                  options={(awaitingPayment
                    ? ['pending_payment' as const, ...ORDER_EXITS]
                    : [
                        ...ORDER_PIPELINE.filter((step) => step !== 'pending_payment'),
                        ...ORDER_EXITS,
                      ]
                  ).map((step) => ({ value: step, label: ORDER_STATUS_LABEL[step] }))}
                />
                <p className="panel-note">
                  {awaitingPayment
                    ? 'This order cannot move on until its payment is confirmed. Cancelling it returns every piece to stock.'
                    : 'Cancelling, returning or refunding puts every piece on this order back into stock.'}
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
