/**
 * Packing: every parcel waiting to be made up, on paper, in one go.
 *
 * The Start page says how many orders need packing; this is where that
 * morning's work actually gets done. One print gives one A4 page per order,
 * oldest first, so the pile of paper comes off the printer in the order the
 * parcels should be packed and the person who has waited longest is on top.
 *
 * Anything whose money has not arrived is not in this list at all. That is the
 * same test the database applies before it will accept a dispatch, so the
 * printer cannot be used to get around it.
 */

import type { Metadata } from 'next';
import { PackageCheck } from 'lucide-react';
import {
  fetchOrders,
  getSiteSettings,
  packingQueue,
  packingSlip,
} from '@mridul/database';
import { sessionClient } from '@mridul/supabase/server';
import { ParcelSheet, shopDetails } from '../../components/parcel';
import { PrintButton } from '../../components/print-button';
import { PageHead } from '../../components/ui';

export const metadata: Metadata = { title: 'Packing | Mridul Admin' };

export default async function PackingPage() {
  const db = await sessionClient();
  const [orders, settings] = await Promise.all([
    fetchOrders(db, { limit: 200 }),
    getSiteSettings(),
  ]);

  const queue = packingQueue(orders);
  const shop = shopDetails(settings);
  const pieces = queue.reduce(
    (count, order) => count + order.lines.reduce((n, line) => n + line.quantity, 0),
    0,
  );

  return (
    <>
      <PageHead
        title="Packing"
        subtitle={
          queue.length === 0
            ? 'Nothing is waiting to be packed.'
            : `${queue.length} ${queue.length === 1 ? 'parcel' : 'parcels'} to make up, ${pieces} ${pieces === 1 ? 'piece' : 'pieces'} in all. Oldest order first.`
        }
        actions={
          queue.length > 0 ? (
            <PrintButton
              label={`Print ${queue.length} ${queue.length === 1 ? 'page' : 'pages'}`}
            />
          ) : undefined
        }
      />

      {queue.length === 0 ? (
        <div className="awaiting">
          <PackageCheck aria-hidden="true" />
          <h2>Everything is packed</h2>
          <p>
            Orders appear here once the money for them is in hand — straight
            away for cash on delivery, and as soon as an online payment has been
            verified. Each one prints as a label and a delivery note on a single
            page.
          </p>
        </div>
      ) : (
        <>
          <div className="packing-bar">
            <p>
              Each page below is one parcel. Tick the pieces off the note as
              they go in, put the note in the box, and cut the label off the
              top.
            </p>
          </div>

          {queue.map((order) => (
            <ParcelSheet key={order.id} shop={shop} slip={packingSlip(order)} />
          ))}
        </>
      )}
    </>
  );
}
