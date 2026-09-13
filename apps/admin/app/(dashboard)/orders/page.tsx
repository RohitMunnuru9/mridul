import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Search } from 'lucide-react';
import {
  fetchOrders,
  ORDER_EXITS,
  ORDER_PIPELINE,
  ORDER_STATUS_LABEL,
  type OrderStatus,
} from '@mridul/database';
import { sessionClient } from '@mridul/supabase/server';
import { formatDateTime, formatPaise } from '@mridul/utils';
import { PageHead, Panel } from '../../components/ui';

export const metadata: Metadata = { title: 'Orders | Mridul Admin' };

type PageProps = {
  searchParams: Promise<{ status?: string; q?: string }>;
};

const FILTERS: (OrderStatus | 'all')[] = [
  'all',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

function isStatus(value?: string): value is OrderStatus {
  return Boolean(
    value && [...ORDER_PIPELINE, ...ORDER_EXITS].includes(value as OrderStatus),
  );
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const status = isStatus(query.status) ? query.status : undefined;
  const search = query.q?.trim() ?? '';

  const db = await sessionClient();
  // No customer filter and no role check in the query: `orders_staff_read`
  // decides what this admin may see, in Postgres.
  const orders = await fetchOrders(db, { status, search });

  // Counted over what came back rather than with extra queries — a shop this
  // size will not have enough orders for that to matter, and one source of
  // rows means the figures can never disagree with the table under them.
  const toPack = orders.filter((order) =>
    ['confirmed', 'processing'].includes(order.status),
  ).length;
  const inTransit = orders.filter((order) =>
    ['packed', 'shipped', 'out_for_delivery'].includes(order.status),
  ).length;
  const owed = orders
    .filter((order) => order.paymentMethod === 'cod' && order.payment?.status !== 'paid')
    .filter((order) => !['cancelled', 'returned', 'refunded'].includes(order.status))
    .reduce((total, order) => total + order.totalPaise, 0);

  return (
    <>
      <PageHead
        title="Orders"
        subtitle="Every order placed on the website, newest first."
      />

      <section className="admin-summary" aria-label="Order summary">
        <div>
          <strong>{orders.length}</strong>
          <span>{status || search ? 'Matching orders' : 'Total orders'}</span>
        </div>
        <div>
          <strong>{toPack}</strong>
          <span>To pack</span>
        </div>
        <div>
          <strong>{inTransit}</strong>
          <span>On the way</span>
        </div>
        <div>
          <strong>{formatPaise(owed)}</strong>
          <span>Cash still to collect</span>
        </div>
      </section>

      <div className="orders-controls">
        <nav className="orders-filters" aria-label="Filter by status">
          {FILTERS.map((option) => {
            const active = option === 'all' ? !status : option === status;
            const href =
              option === 'all'
                ? search
                  ? `/orders?q=${encodeURIComponent(search)}`
                  : '/orders'
                : `/orders?status=${option}${search ? `&q=${encodeURIComponent(search)}` : ''}`;
            return (
              <Link
                aria-current={active ? 'page' : undefined}
                className={active ? 'is-active' : undefined}
                href={href}
                key={option}
              >
                {option === 'all' ? 'All' : ORDER_STATUS_LABEL[option]}
              </Link>
            );
          })}
        </nav>

        <form action="/orders" className="orders-search">
          {status && <input name="status" type="hidden" value={status} />}
          <Search aria-hidden="true" />
          <label className="sr-only" htmlFor="order-search">
            Search orders
          </label>
          <input
            defaultValue={search}
            id="order-search"
            name="q"
            placeholder="Order number, email or phone"
            type="search"
          />
          <button className="btn-primary" type="submit">
            Search
          </button>
        </form>
      </div>

      {orders.length === 0 ? (
        <div className="awaiting">
          <h2>{status || search ? 'Nothing matches that' : 'No orders yet'}</h2>
          <p>
            {status || search
              ? 'Try another status, or clear the search to see everything.'
              : 'When someone checks out on the website their order appears here, with their name, phone number, email and full delivery address.'}
          </p>
        </div>
      ) : (
        <Panel
          title={status ? ORDER_STATUS_LABEL[status] : 'Every order'}
          note={`${orders.length} shown, newest first.`}
          wide
        >
          <table className="orders-table">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Customer</th>
                <th scope="col">Delivering to</th>
                <th scope="col">Pieces</th>
                <th scope="col">Total</th>
                <th scope="col">Payment</th>
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
                    <small>{formatDateTime(order.placedAt)}</small>
                  </td>
                  <td>
                    <strong>{order.address.fullName}</strong>
                    <small>{order.phone ?? order.address.phone}</small>
                    <small>{order.email ?? '—'}</small>
                  </td>
                  <td>
                    {order.address.city}, {order.address.state}
                    <small>{order.address.pincode}</small>
                  </td>
                  <td className="numeric">
                    {order.lines.reduce((count, line) => count + line.quantity, 0)}
                  </td>
                  <td className="numeric">
                    <strong>{formatPaise(order.totalPaise)}</strong>
                  </td>
                  <td>
                    {order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online'}
                    <small>
                      {order.payment?.status === 'paid' ? 'Collected' : 'Not yet collected'}
                    </small>
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
        </Panel>
      )}
    </>
  );
}
