import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, ChevronRight, ShieldAlert } from 'lucide-react';
import { fetchCustomers } from '@mridul/database';
import { sessionClient } from '@mridul/supabase/server';
import { formatDate, formatDateTime, formatPaise } from '@mridul/utils';
import { PageHead, Panel } from '../../components/ui';

export const metadata: Metadata = { title: 'Customers | Mridul Admin' };

const METHOD_LABEL: Record<string, string> = {
  google: 'Google',
  email: 'Email',
  phone: 'Phone',
};

export default async function CustomersPage() {
  const db = await sessionClient();
  // `admin_customers()` reads auth.users, which no client role may touch. It
  // checks the caller's role itself and refuses anyone without one, so this
  // page needs the admin's ordinary session and not the service-role key.
  const customers = await fetchCustomers(db);

  const shoppers = customers.filter((customer) => !customer.isStaff);
  const buyers = shoppers.filter((customer) => customer.ordersCount > 0);
  const spend = shoppers.reduce((total, customer) => total + customer.spendPaise, 0);

  return (
    <>
      <PageHead
        title="Customers"
        subtitle="Everyone who has created an account on the website."
      />

      <section className="admin-summary" aria-label="Customer summary">
        <div>
          <strong>{shoppers.length}</strong>
          <span>Accounts</span>
        </div>
        <div>
          <strong>{buyers.length}</strong>
          <span>Have ordered</span>
        </div>
        <div>
          <strong>{formatPaise(spend)}</strong>
          <span>Spent in total</span>
        </div>
        <div>
          <strong>{customers.length - shoppers.length}</strong>
          <span>Staff accounts</span>
        </div>
      </section>

      {customers.length === 0 ? (
        <div className="awaiting">
          <h2>No accounts yet</h2>
          <p>
            Anyone who signs in on the website appears here with their email,
            phone number, when they joined and how they signed in.
          </p>
        </div>
      ) : (
        <Panel
          title="Everyone with an account"
          note="Newest first. Staff accounts are marked."
          wide
        >
          <table className="customers-table">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Contact</th>
                <th scope="col">Where</th>
                <th scope="col">Signed in with</th>
                <th scope="col">Joined</th>
                <th scope="col">Last signed in</th>
                <th scope="col">Orders</th>
                <th scope="col">Spent</th>
                <th scope="col">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <Link className="order-number" href={`/customers/${customer.id}`}>
                      {customer.fullName ?? 'No name given'}
                    </Link>
                    {customer.isStaff && <small className="is-staff">Staff</small>}
                  </td>
                  <td>
                    <span className="customer-email">
                      {customer.email ?? '—'}
                      {customer.emailConfirmedAt ? (
                        <BadgeCheck aria-label="Email verified" className="is-good" />
                      ) : (
                        <ShieldAlert aria-label="Email not verified" className="is-warn" />
                      )}
                    </span>
                    <small>{customer.phone ?? 'No phone yet'}</small>
                  </td>
                  <td>
                    {customer.city ? `${customer.city}, ${customer.state}` : '—'}
                  </td>
                  <td>{METHOD_LABEL[customer.signInMethod] ?? customer.signInMethod}</td>
                  <td>{formatDate(customer.signedUpAt)}</td>
                  <td>{formatDateTime(customer.lastSignInAt)}</td>
                  <td className="numeric">{customer.ordersCount}</td>
                  <td className="numeric">
                    <strong>{formatPaise(customer.spendPaise)}</strong>
                  </td>
                  <td>
                    <Link className="internal-link" href={`/customers/${customer.id}`}>
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
