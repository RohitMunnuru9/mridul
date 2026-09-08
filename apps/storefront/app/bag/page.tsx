import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getProductsByCollection } from '@mridul/database';
import { ProductRail } from '@/app/components/product-rail';
import { BagView } from './bag-view';

export const metadata: Metadata = {
  title: 'Your bag | Mridul by MR',
  description: 'Review the pieces in your bag before checkout.',
};

export default async function BagPage() {
  const suggestions = await getProductsByCollection('best-sellers', 4);

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

      <BagView />

      <ProductRail
        eyebrow="Pairs well with"
        title="Loved on repeat"
        href="/collections/best-sellers"
        products={suggestions}
      />
    </div>
  );
}
