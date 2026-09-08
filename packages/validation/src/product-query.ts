/**
 * URL <-> ProductQuery translation.
 *
 * Filter state lives in the query string rather than in React state so a
 * filtered listing can be shared, bookmarked, crawled, and rendered on the
 * server. Everything arriving here is untrusted input from the address bar,
 * so each value is parsed and clamped rather than cast.
 */

import type { ProductQuery, ProductScope, SortKey } from '@mridul/types';

/** Products per listing page. One place, so URL parsing and paging agree. */
export const DEFAULT_PER_PAGE = 8;

/** Search params as Next hands them over: a value may repeat. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

const SORT_KEYS: SortKey[] = [
  'featured',
  'newest',
  'price_asc',
  'price_desc',
  'discount',
];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'discount', label: 'Biggest saving' },
];

/** Reads a repeatable param into a clean list, tolerating `a,b` as well as `a&a=b`. */
function readList(raw: string | string[] | undefined): string[] {
  if (raw === undefined) return [];
  const parts = Array.isArray(raw) ? raw : [raw];
  return [
    ...new Set(
      parts
        .flatMap((part) => part.split(','))
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

function readOne(raw: string | string[] | undefined): string | undefined {
  const [first] = readList(raw);
  return first;
}

/** Rupees in the URL, paise internally — the address bar stays readable. */
function readRupees(raw: string | string[] | undefined): number | undefined {
  const value = readOne(raw);
  if (value === undefined) return undefined;
  const rupees = Number.parseInt(value, 10);
  if (!Number.isFinite(rupees) || rupees < 0) return undefined;
  return rupees * 100;
}

export function parseProductQuery(
  scope: ProductScope,
  params: RawSearchParams,
): ProductQuery {
  const sort = readOne(params.sort) as SortKey | undefined;
  const page = Number.parseInt(readOne(params.page) ?? '1', 10);

  let minPaise = readRupees(params.min);
  let maxPaise = readRupees(params.max);
  // A reversed range is a typo, not an empty result set.
  if (minPaise !== undefined && maxPaise !== undefined && minPaise > maxPaise) {
    [minPaise, maxPaise] = [maxPaise, minPaise];
  }

  return {
    scope,
    fabrics: readList(params.fabric),
    colours: readList(params.colour),
    occasions: readList(params.occasion),
    collections: readList(params.collection),
    minPaise,
    maxPaise,
    inStockOnly: readOne(params.stock) === 'in',
    onSaleOnly: readOne(params.sale) === '1',
    sort: sort && SORT_KEYS.includes(sort) ? sort : 'featured',
    page: Number.isFinite(page) && page > 0 ? page : 1,
    perPage: DEFAULT_PER_PAGE,
  };
}

/** The filter groups a chip row and a "clear all" button need to know about. */
export const FILTER_KEYS = [
  'fabric',
  'colour',
  'occasion',
  'collection',
  'min',
  'max',
  'stock',
  'sale',
] as const;

/** How many filters are currently applied — drives the "Filters (3)" badge. */
export function countActiveFilters(query: ProductQuery): number {
  return (
    query.fabrics.length +
    query.colours.length +
    query.occasions.length +
    query.collections.length +
    (query.minPaise !== undefined || query.maxPaise !== undefined ? 1 : 0) +
    (query.inStockOnly ? 1 : 0) +
    (query.onSaleOnly ? 1 : 0)
  );
}

/**
 * Toggles one value inside a repeatable filter group and returns the new
 * query string. Always resets to page 1 — staying on page 4 of a result set
 * that just shrank to one page is the classic filtering bug.
 */
export function toggleParam(
  current: URLSearchParams,
  key: string,
  value: string,
): string {
  const next = new URLSearchParams(current);
  const existing = next.getAll(key);
  next.delete(key);
  for (const entry of existing) {
    if (entry !== value) next.append(key, entry);
  }
  if (!existing.includes(value)) next.append(key, value);
  next.delete('page');
  return next.toString();
}

/** Replaces a single-valued param, clearing it when `value` is empty. */
export function setParam(
  current: URLSearchParams,
  key: string,
  value: string | undefined,
): string {
  const next = new URLSearchParams(current);
  next.delete(key);
  if (value) next.set(key, value);
  if (key !== 'page') next.delete('page');
  return next.toString();
}

export function clearFilters(current: URLSearchParams): string {
  const next = new URLSearchParams(current);
  for (const key of FILTER_KEYS) next.delete(key);
  next.delete('page');
  return next.toString();
}
