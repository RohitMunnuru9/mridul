/**
 * Customers.
 *
 * Needs Supabase Auth. Access to customer records is also the part of the
 * admin most in need of role restrictions, so the plan is written down here
 * rather than discovered later.
 */

import type { Metadata } from 'next';
import { AwaitingBackend, PageHead, Panel, StatCard } from '../components/ui';

export const metadata: Metadata = { title: 'Customers | Mridul Admin' };

const ROLES = [
  ['super_admin', 'Everything, including managing other admins and refunds.'],
  ['catalog_manager', 'Products, categories, collections, inventory, product images.'],
  ['order_manager', 'Orders, processing, shipping and tracking.'],
  ['content_manager', 'Homepage, banners, media and collection content.'],
  ['support', 'Read-only on orders and limited customer detail.'],
];

export default function CustomersPage() {
  return (
    <>
      <PageHead
        title="Customers"
        subtitle="Customer records open with Supabase Auth and row-level security."
      />

      <dl className="stat-grid">
        <StatCard label="Customers" value="" note="registered" pending />
        <StatCard label="Repeat buyers" value="" note="more than one order" pending />
        <StatCard label="Addresses" value="" note="saved" pending />
        <StatCard label="Wishlists" value="" note="server-side" pending />
      </dl>

      <AwaitingBackend
        title="No customer records yet"
        body="Bags and wishlists currently live in the browser, not against an account. This section arrives with sign-in, and will show a customer's orders, addresses and lifetime value."
        needs={['profiles', 'addresses', 'orders', 'wishlists', 'carts']}
      />

      <Panel
        title="Who sees what"
        note="Roles gate this section more tightly than any other."
      >
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Scope</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map(([role, scope]) => (
              <tr key={role}>
                <td>
                  <code>{role}</code>
                </td>
                <td className="cell-wrap">{scope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Data handling">
        <div className="prose">
          <ul>
            <li>
              Row-level security is the enforcement point, not the UI. A customer
              can only ever read their own profile, cart, addresses, wishlist and
              orders.
            </li>
            <li>
              Knowing the admin URL grants nothing — every query is checked against
              the caller&apos;s role.
            </li>
            <li>
              Support sees what it needs to answer an order question and no more;
              full contact details stay behind a higher role.
            </li>
            <li>Admin reads of customer data are worth logging, not just writes.</li>
          </ul>
        </div>
      </Panel>
    </>
  );
}
