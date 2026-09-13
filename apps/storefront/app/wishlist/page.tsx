import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getAllProducts, getProductsByCollection } from '@mridul/database';
import { ProductRail } from '@/app/components/product-rail';
import { WishlistView } from './wishlist-view';

export const metadata: Metadata = {
  title: 'Your wishlist | Mridul by MR',
  description: 'The pieces you have saved at Mridul by MR.',
  // One person's page. Nothing here is useful as a search result.
  robots: { index: false, follow: false },
};

export default async function WishlistPage() {
  // The browser holds only ids, so the catalogue is passed in and matched on
  // the client. Prices and stock therefore come from the server every visit,
  // never from whatever was cached when the item was saved.
  const [catalogue, suggestions] = await Promise.all([
    getAllProducts(),
    getProductsByCollection('new-arrivals', 4),
  ]);

  return (
    <div className="page-shell">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <ChevronRight aria-hidden="true" />
        <span aria-current="page">Wishlist</span>
      </nav>

      <div className="page-head">
        <p className="eyebrow">Kept for later</p>
        <h1>Your wishlist</h1>
      </div>

      <WishlistView catalogue={catalogue} />

      <ProductRail
        eyebrow="Just arrived"
        title="New this week"
        href="/collections/new-arrivals"
        products={suggestions}
      />
    </div>
  );
}
