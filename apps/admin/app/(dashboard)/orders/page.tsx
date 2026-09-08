import type { Metadata } from 'next';
import { AwaitingBackend, PageHead } from '../../components/ui';

export const metadata: Metadata = { title: 'Orders | Mridul Admin' };

export default function OrdersPage() {
  return (
    <>
      <PageHead title="Orders" subtitle="Nothing to manage until checkout is live." />
      <AwaitingBackend
        title="No orders yet"
        body="Orders appear here once checkout and Razorpay are connected. You will be able to search them, open each one with its customer and address, and move it through packing, shipping and delivery."
        needs={['Checkout', 'Razorpay']}
      />
    </>
  );
}
