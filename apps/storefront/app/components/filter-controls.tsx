'use client';

/**
 * Filter, sort and pagination controls.
 *
 * Every control writes to the query string and lets the server re-run the
 * search. Nothing filters in the browser, so what the customer sees is always
 * the same result the server would return for that URL — shareable, and
 * correct even before the JavaScript loads.
 *
 * The current query arrives as a string prop rather than through
 * `useSearchParams`, which keeps these components free of a Suspense boundary
 * and keeps the server as the only reader of the URL.
 */

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ChevronDown, LayoutGrid, Rows3, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { formatPaise } from '@mridul/utils';
import { clearFilters, setParam, toggleParam, SORT_OPTIONS } from '@mridul/validation';
import type { Facet, ProductListResult, ProductQuery } from '@mridul/types';

type ControlProps = {
  basePath: string;
  search: string;
  query: ProductQuery;
  result: ProductListResult;
};

function useNavigate(basePath: string) {
  const router = useRouter();
  return (nextSearch: string) => {
    router.push(nextSearch ? `${basePath}?${nextSearch}` : basePath, { scroll: false });
  };
}

/** Which values are currently selected in a given facet group. */
function selectedFor(query: ProductQuery, key: string): string[] {
  switch (key) {
    case 'fabric':
      return query.fabrics;
    case 'colour':
      return query.colours;
    case 'occasion':
      return query.occasions;
    case 'collection':
      return query.collections;
    default:
      return [];
  }
}

function FacetGroup({
  facet,
  query,
  search,
  basePath,
}: {
  facet: Facet;
} & Omit<ControlProps, 'result'>) {
  const navigate = useNavigate(basePath);
  const selected = selectedFor(query, facet.key);
  const params = new URLSearchParams(search);

  return (
    <fieldset className="facet-group">
      <legend>{facet.label}</legend>
      <div className="facet-values">
        {facet.values.map((value) => {
          const isOn = selected.includes(value.value);
          return (
            <label
              className={`facet-option${isOn ? ' is-on' : ''}`}
              key={value.value}
              data-empty={value.count === 0 ? 'true' : undefined}
            >
              <input
                type="checkbox"
                checked={isOn}
                disabled={value.count === 0 && !isOn}
                onChange={() => navigate(toggleParam(params, facet.key, value.value))}
              />
              <span className="facet-box" aria-hidden="true">
                <Check />
              </span>
              {value.hex && (
                <span
                  className="facet-swatch"
                  aria-hidden="true"
                  style={{ background: value.hex }}
                />
              )}
              <span className="facet-label">{value.label}</span>
              <span className="facet-count">{value.count}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The full filter body, shared by the desktop rail and the mobile drawer. */
export function FilterPanel({ basePath, search, query, result }: ControlProps) {
  const navigate = useNavigate(basePath);
  const params = new URLSearchParams(search);
  const { minPaise, maxPaise } = result.priceBounds;

  // Four evenly spaced price bands across the category, rounded to ₹100 so the
  // labels read cleanly whatever the catalogue happens to contain.
  const step = Math.max(1, Math.ceil((maxPaise - minPaise) / 4 / 10000) * 10000);
  const bands = Array.from({ length: 4 }, (_, index) => {
    const from = minPaise + index * step;
    const to = index === 3 ? undefined : from + step;
    return { from, to };
  }).filter((band) => band.from <= maxPaise);

  function applyBand(from: number, to?: number) {
    let next = setParam(params, 'min', String(Math.floor(from / 100)));
    next = setParam(new URLSearchParams(next), 'max', to ? String(Math.floor(to / 100)) : undefined);
    navigate(next);
  }

  const activeBand = (from: number, to?: number) =>
    query.minPaise === from && query.maxPaise === (to ?? undefined);

  return (
    <div className="filter-panel">
      <fieldset className="facet-group">
        <legend>Availability</legend>
        <div className="facet-values">
          <label className={`facet-option${query.inStockOnly ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={query.inStockOnly}
              onChange={() =>
                navigate(setParam(params, 'stock', query.inStockOnly ? undefined : 'in'))
              }
            />
            <span className="facet-box" aria-hidden="true">
              <Check />
            </span>
            <span className="facet-label">In stock only</span>
          </label>
          <label className={`facet-option${query.onSaleOnly ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={query.onSaleOnly}
              onChange={() =>
                navigate(setParam(params, 'sale', query.onSaleOnly ? undefined : '1'))
              }
            />
            <span className="facet-box" aria-hidden="true">
              <Check />
            </span>
            <span className="facet-label">On offer</span>
          </label>
        </div>
      </fieldset>

      {bands.length > 1 && (
        <fieldset className="facet-group">
          <legend>Price</legend>
          <div className="facet-values">
            {bands.map((band) => (
              <label
                className={`facet-option${activeBand(band.from, band.to) ? ' is-on' : ''}`}
                key={band.from}
              >
                <input
                  type="checkbox"
                  checked={activeBand(band.from, band.to)}
                  onChange={() =>
                    activeBand(band.from, band.to)
                      ? navigate(
                          setParam(
                            new URLSearchParams(setParam(params, 'min', undefined)),
                            'max',
                            undefined,
                          ),
                        )
                      : applyBand(band.from, band.to)
                  }
                />
                <span className="facet-box" aria-hidden="true">
                  <Check />
                </span>
                <span className="facet-label">
                  {band.to
                    ? `${formatPaise(band.from)} – ${formatPaise(band.to)}`
                    : `${formatPaise(band.from)} and above`}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {result.facets.map((facet) => (
        <FacetGroup
          key={facet.key}
          facet={facet}
          query={query}
          search={search}
          basePath={basePath}
        />
      ))}
    </div>
  );
}

/** Mobile entry point: the same panel inside a drawer. */
export function FilterDrawer({
  activeCount,
  ...props
}: ControlProps & { activeCount: number }) {
  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="outline" className="toolbar-button" />}
      >
        <SlidersHorizontal aria-hidden="true" />
        Filter
        {activeCount > 0 && <b className="toolbar-count">{activeCount}</b>}
      </SheetTrigger>
      <SheetContent side="left" className="filter-drawer-panel">
        <SheetHeader>
          <SheetTitle>Filter</SheetTitle>
        </SheetHeader>
        <div className="filter-drawer-body">
          <FilterPanel {...props} />
        </div>
        <div className="filter-drawer-footer">
          <Link
            className="filter-clear"
            href={
              clearFilters(new URLSearchParams(props.search))
                ? `${props.basePath}?${clearFilters(new URLSearchParams(props.search))}`
                : props.basePath
            }
          >
            Clear all
          </Link>
          <span>
            {props.result.total} {props.result.total === 1 ? 'piece' : 'pieces'}
          </span>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function SortSelect({ basePath, search, query }: Omit<ControlProps, 'result'>) {
  const navigate = useNavigate(basePath);
  const params = new URLSearchParams(search);

  return (
    <label className="sort-select">
      <span className="sr-only">Sort products</span>
      <select
        value={query.sort}
        onChange={(event) => navigate(setParam(params, 'sort', event.target.value))}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" />
    </label>
  );
}

/** Removable chips for whatever is currently narrowing the results. */
export function ActiveFilters({ basePath, search, query, result }: ControlProps) {
  const navigate = useNavigate(basePath);
  const params = new URLSearchParams(search);

  const labelFor = (key: string, value: string) =>
    result.facets
      .find((facet) => facet.key === key)
      ?.values.find((item) => item.value === value)?.label ?? value;

  const chips: { key: string; value: string; label: string }[] = [
    ...query.fabrics.map((value) => ({
      key: 'fabric',
      value,
      label: labelFor('fabric', value),
    })),
    ...query.colours.map((value) => ({
      key: 'colour',
      value,
      label: labelFor('colour', value),
    })),
    ...query.occasions.map((value) => ({
      key: 'occasion',
      value,
      label: labelFor('occasion', value),
    })),
    ...query.collections.map((value) => ({
      key: 'collection',
      value,
      label: labelFor('collection', value),
    })),
  ];

  if (query.inStockOnly) chips.push({ key: 'stock', value: 'in', label: 'In stock' });
  if (query.onSaleOnly) chips.push({ key: 'sale', value: '1', label: 'On offer' });

  const hasPrice = query.minPaise !== undefined || query.maxPaise !== undefined;
  if (chips.length === 0 && !hasPrice) return null;

  function drop(key: string, value: string) {
    navigate(
      key === 'stock' || key === 'sale'
        ? setParam(params, key, undefined)
        : toggleParam(params, key, value),
    );
  }

  return (
    <div className="active-filters" aria-label="Active filters">
      {chips.map((chip) => (
        <button
          className="filter-chip"
          key={`${chip.key}:${chip.value}`}
          onClick={() => drop(chip.key, chip.value)}
          type="button"
        >
          {chip.label}
          <X aria-hidden="true" />
        </button>
      ))}
      {hasPrice && (
        <button
          className="filter-chip"
          onClick={() =>
            navigate(
              setParam(
                new URLSearchParams(setParam(params, 'min', undefined)),
                'max',
                undefined,
              ),
            )
          }
          type="button"
        >
          {query.minPaise !== undefined ? formatPaise(query.minPaise) : 'Under'}
          {query.maxPaise !== undefined ? ` – ${formatPaise(query.maxPaise)}` : '+'}
          <X aria-hidden="true" />
        </button>
      )}
      <Link
        className="filter-chip is-clear"
        href={
          clearFilters(params) ? `${basePath}?${clearFilters(params)}` : basePath
        }
      >
        Clear all
      </Link>
    </div>
  );
}

/**
 * Grid density toggle. Two columns reads like a lookbook, four like a
 * catalogue; which one a shopper wants depends on whether they are browsing or
 * hunting, so it stays in the URL alongside the filters.
 */
export function GridDensity({
  basePath,
  search,
  density,
}: {
  basePath: string;
  search: string;
  density: 'compact' | 'large';
}) {
  const navigate = useNavigate(basePath);
  const params = new URLSearchParams(search);

  return (
    <div className="grid-density" role="group" aria-label="Grid density">
      <button
        aria-label="Show more per row"
        aria-pressed={density === 'compact'}
        className={density === 'compact' ? 'is-on' : undefined}
        onClick={() => navigate(setParam(params, 'view', undefined))}
        type="button"
      >
        <LayoutGrid aria-hidden="true" />
      </button>
      <button
        aria-label="Show larger images"
        aria-pressed={density === 'large'}
        className={density === 'large' ? 'is-on' : undefined}
        onClick={() => navigate(setParam(params, 'view', 'large'))}
        type="button"
      >
        <Rows3 aria-hidden="true" />
      </button>
    </div>
  );
}
