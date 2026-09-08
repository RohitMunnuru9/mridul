import type { Metadata } from 'next';
import { AwaitingBackend, PageHead } from '../../components/ui';

export const metadata: Metadata = { title: 'Customers | Mridul Admin' };

export default function CustomersPage() {
  return (
    <>
      <PageHead title="Customers" subtitle="Nothing to show until shoppers can sign in." />
      <AwaitingBackend
        title="No customer accounts yet"
        body="Bags and wishlists currently live in the shopper's browser rather than against an account. Once sign-in is live this shows each customer with their orders and addresses."
        needs={['Customer sign-in']}
      />
    </>
  );
}
