/**
 * Collection listing — New Arrivals, Best Sellers, Festive and so on.
 *
 * A collection cuts across categories, so it is a different pool than a
 * category but the same listing engine, filters included.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronRight } from 'lucide-react';
import { getCollectionBySlug, getCollections } from '@mridul/database';
import type { RawSearchParams } from '@mridul/validation';
import { ProductListing } from '@/app/components/product-listing';

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateStaticParams() {
  const collections = await getCollections();
  return collections.map((collection) => ({ slug: collection.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) return { title: 'Not found | Mridul by MR' };

  return {
    title: `${collection.name} | Mridul by MR`,
    description: `${collection.name} — ${collection.tagline}.`,
  };
}

export default async function CollectionPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();

  return (
    <div className="listing-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <ChevronRight aria-hidden="true" />
        <Link href="/shop">Shop</Link>
        <ChevronRight aria-hidden="true" />
        <span aria-current="page">{collection.name}</span>
      </nav>

      <ProductListing
        scope={{ kind: 'collection', slug: collection.slug }}
        basePath={`/collections/${collection.slug}`}
        eyebrow={collection.tagline}
        title={collection.name}
        intro={`Everything currently in the ${collection.name} edit, across sarees and blouses.`}
        searchParams={await searchParams}
        emptyTitle="Nothing in this edit matches those filters"
        emptyBody="Clear a filter to see the whole collection again."
      />
    </div>
  );
}
