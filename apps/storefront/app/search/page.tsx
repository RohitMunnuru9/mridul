/**
 * Search results.
 *
 * The term lives in `?q=`, so a search is a real, shareable page rather than
 * transient client state — and the matching happens in the repository, next to
 * the data, rather than over a payload shipped to the browser.
 */

import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight } from 'lucide-react';
import { getCategories, getCollections } from '@mridul/database';
import type { RawSearchParams } from '@mridul/validation';
import { ProductListing } from '@/app/components/product-listing';
import { SearchField } from './search-field';

type PageProps = { searchParams: Promise<RawSearchParams> };

export const metadata: Metadata = {
  title: 'Search | Mridul by MR',
  description: 'Search sarees, blouses and fabrics at Mridul by MR.',
};

function readTerm(raw: RawSearchParams): string {
  const value = raw.q;
  const first = Array.isArray(value) ? value[0] : value;
  return (first ?? '').trim();
}

export default async function SearchPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const term = readTerm(raw);
  const [categories, collections] = await Promise.all([
    getCategories(),
    getCollections(),
  ]);

  return (
    <div className="listing-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <ChevronRight aria-hidden="true" />
        <span aria-current="page">Search</span>
      </nav>

      <SearchField term={term} />

      {term ? (
        <ProductListing
          scope={{ kind: 'search', term }}
          basePath="/search"
          eyebrow="Search results"
          title={`“${term}”`}
          intro="Matched on name, fabric, colour, weave and occasion."
          searchParams={raw}
          emptyTitle={`No pieces match “${term}”`}
          emptyBody="Try a fabric like linen or organza, a colour, or an occasion such as wedding."
        />
      ) : (
        <div className="search-prompt">
          <h1>What are you looking for?</h1>
          <p>Search by name, fabric, colour, weave or occasion.</p>
          <div className="search-suggestions">
            <span>Try</span>
            {['Linen', 'Organza', 'Handloom', 'Wedding', 'Everyday', 'Ivory'].map(
              (suggestion) => (
                <Link
                  href={`/search?q=${encodeURIComponent(suggestion)}`}
                  key={suggestion}
                >
                  {suggestion}
                </Link>
              ),
            )}
          </div>
          <div className="search-shortcuts">
            <div>
              <h2>Categories</h2>
              {categories.map((category) => (
                <Link href={`/shop/${category.slug}`} key={category.id}>
                  {category.name}
                </Link>
              ))}
            </div>
            <div>
              <h2>Collections</h2>
              {collections.map((collection) => (
                <Link href={`/collections/${collection.slug}`} key={collection.id}>
                  {collection.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
