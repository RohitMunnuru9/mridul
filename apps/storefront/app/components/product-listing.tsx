/**
 * The shared listing view.
 *
 * Categories, collections and search all render through this one component,
 * differing only in the scope they pass and the header they show. That is why
 * a filter learned on the Sarees page behaves identically on a collection or a
 * set of search results.
 *
 * It is a server component: the filtering, sorting and paging happen in the
 * repository before any markup exists.
 */

import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { countActiveFilters, parseProductQuery } from '@mridul/validation';
import type { RawSearchParams } from '@mridul/validation';
import { listProducts } from '@mridul/database';
import type { ProductImage, ProductScope } from '@mridul/types';
import { ProductCard } from './product-card';
import {
  ActiveFilters,
  FilterDrawer,
  FilterPanel,
  GridDensity,
  SortSelect,
} from './filter-controls';

type ListingProps = {
  scope: ProductScope;
  /** Route the controls write their query string back to. */
  basePath: string;
  eyebrow: string;
  title: string;
  intro: string;
  /** Longer copy rendered under the grid, mainly for search engines. */
  note?: string;
  heroImage?: ProductImage;
  searchParams: RawSearchParams;
  /** Shown instead of the grid when the scope itself yields nothing. */
  emptyTitle?: string;
  emptyBody?: string;
};

/** Keeps the current filters while moving between pages. */
function pageHref(basePath: string, search: string, page: number) {
  const params = new URLSearchParams(search);
  if (page <= 1) params.delete('page');
  else params.set('page', String(page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/**
 * Rebuilds the query string from the params the server received, so the client
 * controls and the server agree on one representation of the current URL.
 */
function serialiseParams(raw: RawSearchParams): string {
  return new URLSearchParams(
    Object.entries(raw).flatMap(([key, value]) =>
      value === undefined
        ? []
        : (Array.isArray(value) ? value : [value]).map(
            (item) => [key, item] as [string, string],
          ),
    ),
  ).toString();
}

export async function ProductListing({
  scope,
  basePath,
  eyebrow,
  title,
  intro,
  note,
  heroImage,
  searchParams,
  emptyTitle = 'Nothing matches that combination',
  emptyBody,
}: ListingProps) {
  const query = parseProductQuery(scope, searchParams);
  const result = await listProducts(query);

  const search = serialiseParams(searchParams);
  const activeCount = countActiveFilters(query);
  const density = searchParams.view === 'large' ? 'large' : 'compact';
  const controls = { basePath, search, query, result };

  return (
    <>
      <header className={`listing-header${heroImage ? '' : ' is-plain'}`}>
        <div className="listing-header-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="listing-intro">{intro}</p>
        </div>
        {heroImage && (
          <div className="listing-header-image">
            <Image
              src={heroImage.url}
              alt={heroImage.alt}
              fill
              sizes="(max-width: 900px) 100vw, 38vw"
              priority
              style={{ objectPosition: heroImage.focal }}
            />
          </div>
        )}
      </header>

      <div className="listing-toolbar">
        <p className="listing-count">
          {result.total} {result.total === 1 ? 'piece' : 'pieces'}
          {activeCount > 0 && <span> · {activeCount} filtered</span>}
        </p>
        <div className="listing-toolbar-actions">
          <div className="mobile-only">
            <FilterDrawer {...controls} activeCount={activeCount} />
          </div>
          <SortSelect basePath={basePath} search={search} query={query} />
          <GridDensity basePath={basePath} search={search} density={density} />
        </div>
      </div>

      <ActiveFilters {...controls} />

      <div className="listing-body">
        <aside className="listing-filters" aria-label="Filters">
          <FilterPanel {...controls} />
        </aside>

        <div className="listing-results">
          {result.items.length === 0 ? (
            <div className="listing-empty">
              <h2>{emptyTitle}</h2>
              <p>
                {emptyBody ??
                  'Try widening the price band or clearing a colour — the rest of the edit is still here.'}
              </p>
              <Link className="primary-cta" href={basePath}>
                Clear filters
              </Link>
            </div>
          ) : (
            <div className={`product-grid density-${density}`}>
              {result.items.map((product, index) => (
                <ProductCard key={product.id} product={product} priority={index < 2} />
              ))}
            </div>
          )}

          {result.pageCount > 1 && (
            <nav className="listing-pagination" aria-label="Pagination">
              {result.page > 1 && (
                <Link
                  className="page-step"
                  href={pageHref(basePath, search, result.page - 1)}
                  rel="prev"
                >
                  <ArrowLeft aria-hidden="true" /> Previous
                </Link>
              )}
              <div className="page-numbers">
                {Array.from({ length: result.pageCount }, (_, index) => index + 1).map(
                  (page) => (
                    <Link
                      aria-current={page === result.page ? 'page' : undefined}
                      className={page === result.page ? 'is-current' : undefined}
                      href={pageHref(basePath, search, page)}
                      key={page}
                    >
                      {page}
                    </Link>
                  ),
                )}
              </div>
              {result.page < result.pageCount && (
                <Link
                  className="page-step"
                  href={pageHref(basePath, search, result.page + 1)}
                  rel="next"
                >
                  Next <ArrowRight aria-hidden="true" />
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>

      {note && (
        <section className="listing-note">
          <h2>About {title.toLowerCase()}</h2>
          <p>{note}</p>
        </section>
      )}
    </>
  );
}
