/**
 * One order's parcel paper.
 *
 * Reached from the order itself, so the sequence at the table is: open the
 * order, print this, pack against the ticks, then come back and record the
 * tracking number. Until now the middle step was a biro and a guess at
 * somebody's pincode.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { fetchOrderById, getSiteSettings, packingSlip } from '@mridul/database';
import { sessionClient } from '@mridul/supabase/server';
import { ParcelSheet, shopDetails } from '../../../../components/parcel';
import { PrintButton } from '../../../../components/print-button';
import { PageHead } from '../../../../components/ui';

export const metadata: Metadata = { title: 'Parcel | Mridul Admin' };

type PageProps = { params: Promise<{ id: string }> };

export default async function SlipPage({ params }: PageProps) {
  const { id } = await params;
  const db = await sessionClient();

  // Row-level security decides whether this order comes back at all, exactly
  // as it does on the order page itself. Nothing here re-checks a role.
  const [order, settings] = await Promise.all([
    fetchOrderById(db, id),
    getSiteSettings(),
  ]);
  if (!order) notFound();

  const slip = packingSlip(order);

  return (
    <>
      <Link className="internal-link back-link" href={`/orders/${order.id}`}>
        <ChevronLeft aria-hidden="true" /> Back to {order.number}
      </Link>

      <PageHead
        title="Parcel paper"
        subtitle="The label to stick on the box, and the note to put inside it. One A4 page."
        actions={<PrintButton label="Print this parcel" />}
      />

      <ParcelSheet shop={shopDetails(settings)} slip={slip} />
    </>
  );
}
