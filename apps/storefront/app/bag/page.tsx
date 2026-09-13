import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getProductsByCollection, getSiteSettings } from '@mridul/database';
import { ProductRail } from '@/app/components/product-rail';
import { BagView } from './bag-view';

export const metadata: Metadata = {
  title: 'Your bag | Mridul by MR',
  description: 'Review the pieces in your bag before checkout.',
  // One person's page. Nothing here is useful as a search result.
  robots: { index: false, follow: false },
};

export default async function BagPage() {
  // Shipping figures come from settings, so the bag meter, the announcement
  // bar and the delivery check can never quote different thresholds.
  const [suggestions, settings] = await Promise.all([
    getProductsByCollection('best-sellers', 4),
    getSiteSettings(),
  ]);
  const rates = {
    freeShippingThresholdPaise: settings.freeShippingThresholdPaise,
    flatRatePaise: settings.flatShippingPaise,
  };

  return (
    <div className="page-shell">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <ChevronRight aria-hidden="true" />
        <span aria-current="page">Bag</span>
      </nav>

      <div className="page-head">
        <p className="eyebrow">Almost yours</p>
        <h1>Your bag</h1>
      </div>

      <BagView rates={rates} />

      <ProductRail
        eyebrow="Pairs well with"
        title="Loved on repeat"
        href="/collections/best-sellers"
        products={suggestions}
      />
    </div>
  );
}
