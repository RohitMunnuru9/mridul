import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
} from 'lucide-react';
import { fetchCustomers, fetchOrders, ORDER_STATUS_LABEL } from '@mridul/database';
import { sessionClient } from '@mridul/supabase/server';
import { formatDate, formatDateTime, formatPaise } from '@mridul/utils';
import { PageHead, Panel } from '../../../components/ui';

export const metadata: Metadata = { title: 'Customer | Mridul Admin' };

type PageProps = { params: Promise<{ id: string }> };

const METHOD_LABEL: Record<string, string> = {
  google: 'Google account',
  email: 'Email and password',
  phone: 'Phone number',
};

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const db = await sessionClient();

  const [customers, orders, { data: addresses }] = await Promise.all([
    fetchCustomers(db),
    fetchOrders(db, { customerId: id }),
    db
      .from('addresses')
      .select('id, full_name, phone, line1, line2, landmark, city, state, pincode, is_default')
      .eq('customer_id', id)
      .order('is_default', { ascending: false }),
  ]);

  const customer = customers.find((row) => row.id === id);
  if (!customer) notFound();

  return (
    <>
      <Link className="internal-link back-link" href="/customers">
        <ChevronLeft aria-hidden="true" /> All customers
      </Link>

      <PageHead
        title={customer.fullName ?? 'No name given'}
        subtitle={customer.email ?? 'No email on the account'}
        actions={customer.isStaff ? <span className="order-pill is-confirmed">Staff</span> : undefined}
      />

      <section className="admin-summary" aria-label="This customer">
        <div>
          <strong>{customer.ordersCount}</strong>
          <span>Orders placed</span>
        </div>
        <div>
          <strong>{formatPaise(customer.spendPaise)}</strong>
          <span>Spent</span>
        </div>
        <div>
          <strong>{formatDate(customer.signedUpAt)}</strong>
          <span>Joined</span>
        </div>
        <div>
          <strong>{formatDate(customer.lastOrderAt)}</strong>
          <span>Last order</span>
        </div>
      </section>

      <div className="order-detail">
        <div className="order-detail-main">
          <Panel
            title="Their orders"
            note={
              orders.length === 0
                ? 'This account has not ordered anything yet.'
                : 'Newest first.'
            }
          >
            {orders.length === 0 ? (
              <p className="panel-note">Nothing to show.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Placed</th>
                    <th scope="col">Pieces</th>
                    <th scope="col">Total</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link className="order-number" href={`/orders/${order.id}`}>
                          {order.number}
                        </Link>
                      </td>
                      <td>{formatDateTime(order.placedAt)}</td>
                      <td className="numeric">
                        {order.lines.reduce((count, line) => count + line.quantity, 0)}
                      </td>
                      <td className="numeric">
                        <strong>{formatPaise(order.totalPaise)}</strong>
                      </td>
                      <td>
                        <span className={`order-pill is-${order.status}`}>
                          {ORDER_STATUS_LABEL[order.status]}
                        </span>
                      </td>
                      <td>
                        <Link className="internal-link" href={`/orders/${order.id}`}>
                          Open <ChevronRight aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel
            title="Saved addresses"
            note="Where this customer has asked for parcels to go."
          >
            {(addresses ?? []).length === 0 ? (
              <p className="panel-note">No address saved yet.</p>
            ) : (
              <ul className="customer-addresses">
                {(addresses ?? []).map((address) => (
                  <li key={address.id}>
                    <MapPin aria-hidden="true" />
                    <address>
                      <strong>{address.full_name}</strong>
                      {address.is_default && <span className="is-default">Default</span>}
                      <br />
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ''}
                      {address.landmark ? (
                        <>
                          <br />
                          Near {address.landmark}
                        </>
                      ) : null}
                      <br />
                      {address.city}, {address.state} — {address.pincode}
                      <br />
                      {address.phone}
                    </address>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="order-detail-side">
          <section className="panel">
            <div className="panel-head">
              <h2>Account</h2>
              <p>How this person signs in.</p>
            </div>
            <ul className="order-facts">
              <li>
                <Mail aria-hidden="true" />
                <span className="customer-email">
                  {customer.email ?? '—'}
                  {customer.emailConfirmedAt ? (
                    <BadgeCheck aria-label="Email verified" className="is-good" />
                  ) : (
                    <ShieldAlert aria-label="Email not verified" className="is-warn" />
                  )}
                </span>
              </li>
              <li>
                <Phone aria-hidden="true" />
                {customer.phone ?? 'No phone number yet'}
              </li>
              <li>
                <KeyRound aria-hidden="true" />
                {METHOD_LABEL[customer.signInMethod] ?? customer.signInMethod}
              </li>
            </ul>
            <dl className="customer-meta">
              <div>
                <dt>Joined</dt>
                <dd>{formatDateTime(customer.signedUpAt)}</dd>
              </div>
              <div>
                <dt>Last signed in</dt>
                <dd>{formatDateTime(customer.lastSignInAt)}</dd>
              </div>
              <div>
                <dt>Email verified</dt>
                <dd>
                  {customer.emailConfirmedAt
                    ? formatDateTime(customer.emailConfirmedAt)
                    : 'Not yet'}
                </dd>
              </div>
              <div>
                <dt>Marketing</dt>
                <dd>{customer.acceptsMarketing ? 'Opted in' : 'Not opted in'}</dd>
              </div>
            </dl>
            <p className="panel-note">
              Passwords are held by Supabase and are never readable here — not by
              this page, and not by anyone with the keys to this project.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
