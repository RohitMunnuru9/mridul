/**
 * Orders.
 *
 * There is no orders table yet, so rather than mock rows this sets out the
 * states an order will move through and the guarantees the flow has to keep.
 * Those are decisions worth writing down before the schema exists.
 */

import type { Metadata } from 'next';
import { AwaitingBackend, PageHead, Panel, StatCard } from '../components/ui';

export const metadata: Metadata = { title: 'Orders | Mridul Admin' };

const ORDER_STATES = [
  ['pending_payment', 'Created, awaiting a verified payment. Holds no stock.'],
  ['confirmed', 'Payment verified by signature and webhook. Stock deducted.'],
  ['processing', 'Being picked and checked.'],
  ['packed', 'Packed and ready for the courier.'],
  ['shipped', 'Handed over. AWB issued, tracking sent on WhatsApp.'],
  ['out_for_delivery', 'On the final leg.'],
  ['delivered', 'Confirmed delivered by the courier.'],
  ['cancelled', 'Cancelled before dispatch. Stock returned.'],
  ['returned', 'Came back after delivery.'],
  ['refunded', 'Money returned in full or in part.'],
];

const PAYMENT_STATES = [
  ['pending', 'Razorpay order created, customer has not paid.'],
  ['authorized', 'Funds held, not yet captured.'],
  ['paid', 'Captured and verified. The only state that confirms an order.'],
  ['failed', 'Declined or abandoned.'],
  ['refunded', 'Fully refunded.'],
  ['partially_refunded', 'Part of the order refunded.'],
];

export default function OrdersPage() {
  return (
    <>
      <PageHead
        title="Orders"
        subtitle="Order management opens once checkout and the orders table exist."
      />

      <dl className="stat-grid">
        <StatCard label="Today" value="" note="orders placed" pending />
        <StatCard label="Pending" value="" note="awaiting payment" pending />
        <StatCard label="To ship" value="" note="paid, not dispatched" pending />
        <StatCard label="Revenue" value="" note="captured payments" pending />
      </dl>

      <AwaitingBackend
        title="No orders yet"
        body="This section lists, filters and searches orders, opens each one with its customer, address, payment and shipment, and moves it through the pipeline. It needs these tables:"
        needs={['orders', 'order_items', 'payments', 'shipments', 'tracking_events']}
      />

      <div className="panel-row">
        <Panel title="Order states" note="The pipeline an order moves through.">
          <table>
            <thead>
              <tr>
                <th>State</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              {ORDER_STATES.map(([state, meaning]) => (
                <tr key={state}>
                  <td>
                    <code>{state}</code>
                  </td>
                  <td className="cell-wrap">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Payment states" note="Tracked separately from the order.">
          <table>
            <thead>
              <tr>
                <th>State</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              {PAYMENT_STATES.map(([state, meaning]) => (
                <tr key={state}>
                  <td>
                    <code>{state}</code>
                  </td>
                  <td className="cell-wrap">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Rules the order flow must keep">
        <div className="prose">
          <ul>
            <li>
              Prices are re-read from the database immediately before the Razorpay
              order is created. Nothing in a request body sets an amount.
            </li>
            <li>
              An order is only confirmed after the Razorpay signature verifies
              server-side <em>and</em> the webhook agrees. A browser reporting
              success means nothing.
            </li>
            <li>Stock moves on verified payment, not when an item enters a bag.</li>
            <li>
              Coupons and shipping are recalculated server-side at checkout, not
              carried over from what the bag page displayed.
            </li>
            <li>
              Every status change an admin makes is written to{' '}
              <code>admin_audit_logs</code> with who made it.
            </li>
          </ul>
        </div>
      </Panel>
    </>
  );
}
