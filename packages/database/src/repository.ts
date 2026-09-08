/**
 * Catalogue repository — the single boundary between the storefront and the
 * data store.
 *
 * Everything here is async and returns plain DTOs, so replacing the seed
 * arrays with Supabase queries changes only the bodies of these functions.
 * Components never import the seed data directly.
 *
 * Filtering, sorting, faceting and pagination all run here rather than in the
 * browser. That is deliberate: the result set, the price shown and the stock
 * state are decided by the server, and the client is only ever handed the
 * answer. The same rule holds at checkout, where prices must be re-read from
 * the database and never taken from the request body.
 */

import { discountPercent, formatPaise } from '@mridul/utils';
import { categories, collections, coupons, products } from './seed-data';
import type {
  Category,
  Collection,
  CouponResult,
  Facet,
  FacetValue,
  NavGroup,
  NavMenu,
  Product,
  ProductListItem,
  ProductListResult,
  ProductQuery,
  ProductScope,
  SortKey,
} from '@mridul/types';

/** Total units across every variant. Becomes a sum over `inventory` later. */
function stockOf(product: Product): number {
  return product.variants.reduce((total, variant) => total + variant.stock, 0);
}

/** Attaches the fields the UI needs but must not compute for itself. */
function toListItem(product: Product): ProductListItem {
  const stockTotal = stockOf(product);
  return {
    ...product,
    inStock: stockTotal > 0,
    stockTotal,
    discountPercent: discountPercent(product.pricePaise, product.compareAtPaise),
  };
}

/** Every product, including inactive ones — the admin view of the catalogue. */
export async function getAllProducts(): Promise<ProductListItem[]> {
  return products.map(toListItem);
}

export async function getCategories(): Promise<Category[]> {
  return categories
    .filter((category) => category.isActive)
    .sort((a, b) => a.position - b.position);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const category = categories.find((item) => item.slug === slug && item.isActive);
  return category ?? null;
}

export async function getCollections(): Promise<Collection[]> {
  return collections;
}

export async function getCollectionBySlug(slug: string): Promise<Collection | null> {
  return collections.find((item) => item.slug === slug) ?? null;
}

/**
 * Rehydrates a list of ids into full products.
 *
 * The bag and the wishlist keep only ids in the browser, so the price, stock
 * and copy on those pages come from here rather than from whatever the browser
 * cached — a saved item that has since changed price shows the new price.
 */
export async function getProductsByIds(ids: string[]): Promise<ProductListItem[]> {
  const wanted = new Set(ids);
  return products
    .filter((product) => wanted.has(product.id) && product.isActive)
    .map(toListItem);
}

/** Free-text match across the fields a shopper would actually type. */
function matchesTerm(product: Product, term: string): boolean {
  const haystack = [
    product.name,
    product.subtitle,
    product.fabric,
    product.colour.name,
    product.occasion,
    product.technique,
    product.description,
  ]
    .join(' ')
    .toLowerCase();
  return term
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/** The starting pool for a listing, before any filter is applied. */
function poolFor(scope: ProductScope): Product[] {
  const live = products.filter((product) => product.isActive);
  switch (scope.kind) {
    case 'category':
      return live.filter((product) => product.categorySlug === scope.slug);
    case 'collection':
      return live.filter((product) => product.collectionSlugs.includes(scope.slug));
    case 'search':
      return scope.term.trim()
        ? live.filter((product) => matchesTerm(product, scope.term))
        : [];
  }
}

export async function getProductBySlug(slug: string): Promise<ProductListItem | null> {
  const product = products.find((item) => item.slug === slug && item.isActive);
  return product ? toListItem(product) : null;
}

/**
 * Products from the same category, excluding the one being viewed.
 * Ordered by rating so the strongest sellers surface first.
 */
export async function getRelatedProducts(
  product: ProductListItem,
  limit = 4,
): Promise<ProductListItem[]> {
  return products
    .filter(
      (item) =>
        item.isActive &&
        item.categorySlug === product.categorySlug &&
        item.id !== product.id,
    )
    .sort((a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0))
    .slice(0, limit)
    .map(toListItem);
}

/** Products belonging to a collection, for the homepage rails. */
export async function getProductsByCollection(
  collectionSlug: string,
  limit = 8,
): Promise<ProductListItem[]> {
  return products
    .filter((item) => item.isActive && item.collectionSlugs.includes(collectionSlug))
    .slice(0, limit)
    .map(toListItem);
}

/** One predicate per filter group, so facet counts can skip their own group. */
type Predicates = Record<string, (product: Product) => boolean>;

function buildPredicates(query: ProductQuery): Predicates {
  return {
    fabric: (product) =>
      query.fabrics.length === 0 || query.fabrics.includes(product.fabric),
    colour: (product) =>
      query.colours.length === 0 || query.colours.includes(product.colour.name),
    occasion: (product) =>
      query.occasions.length === 0 || query.occasions.includes(product.occasion),
    collection: (product) =>
      query.collections.length === 0 ||
      product.collectionSlugs.some((slug) => query.collections.includes(slug)),
    price: (product) =>
      (query.minPaise === undefined || product.pricePaise >= query.minPaise) &&
      (query.maxPaise === undefined || product.pricePaise <= query.maxPaise),
    availability: (product) => !query.inStockOnly || stockOf(product) > 0,
    sale: (product) =>
      !query.onSaleOnly ||
      discountPercent(product.pricePaise, product.compareAtPaise) > 0,
  };
}

/**
 * Applies every predicate except the named one. Used for facet counts, so
 * choosing "Linen" does not drop the other fabrics to zero and strand the
 * customer with no way back.
 */
function matches(product: Product, predicates: Predicates, except?: string): boolean {
  return Object.entries(predicates).every(
    ([key, predicate]) => key === except || predicate(product),
  );
}

function countBy(
  pool: Product[],
  predicates: Predicates,
  facetKey: string,
  valueOf: (product: Product) => string[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const product of pool) {
    if (!matches(product, predicates, facetKey)) continue;
    for (const value of valueOf(product)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return counts;
}

function toFacetValues(
  counts: Map<string, number>,
  label: (value: string) => string = (value) => value,
  hex?: (value: string) => string | undefined,
): FacetValue[] {
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: label(value), count, hex: hex?.(value) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

const SORTERS: Record<SortKey, (a: ProductListItem, b: ProductListItem) => number> = {
  // Curated order: in-stock first, then rating, then how recent it is.
  featured: (a, b) =>
    Number(b.inStock) - Number(a.inStock) ||
    (b.rating?.average ?? 0) - (a.rating?.average ?? 0) ||
    b.publishedAt.localeCompare(a.publishedAt),
  newest: (a, b) => b.publishedAt.localeCompare(a.publishedAt),
  price_asc: (a, b) => a.pricePaise - b.pricePaise,
  price_desc: (a, b) => b.pricePaise - a.pricePaise,
  discount: (a, b) => b.discountPercent - a.discountPercent,
};

/**
 * The listing query behind every category page.
 *
 * Returns the page of results plus the facets for the current filter state,
 * so the page renders complete on the server with no client round trip.
 */
export async function listProducts(query: ProductQuery): Promise<ProductListResult> {
  const pool = poolFor(query.scope);

  const predicates = buildPredicates(query);
  const filtered = pool.filter((product) => matches(product, predicates));

  const items = filtered.map(toListItem).sort(SORTERS[query.sort] ?? SORTERS.featured);

  const perPage = Math.max(1, query.perPage);
  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const start = (page - 1) * perPage;

  const prices = pool.map((product) => product.pricePaise);

  const colourHex = new Map(pool.map((p) => [p.colour.name, p.colour.hex]));
  const collectionNames = new Map(collections.map((c) => [c.slug, c.name]));

  const facets: Facet[] = [
    {
      key: 'fabric',
      label: 'Fabric',
      values: toFacetValues(countBy(pool, predicates, 'fabric', (p) => [p.fabric])),
    },
    {
      key: 'colour',
      label: 'Colour',
      values: toFacetValues(
        countBy(pool, predicates, 'colour', (p) => [p.colour.name]),
        undefined,
        (value) => colourHex.get(value),
      ),
    },
    {
      key: 'occasion',
      label: 'Occasion',
      values: toFacetValues(countBy(pool, predicates, 'occasion', (p) => [p.occasion])),
    },
    {
      key: 'collection',
      label: 'Collection',
      values: toFacetValues(
        countBy(pool, predicates, 'collection', (p) => p.collectionSlugs),
        (value) => collectionNames.get(value) ?? value,
      ),
    },
  ].filter((facet) => facet.values.length > 1);

  return {
    items: items.slice(start, start + perPage),
    facets,
    total: items.length,
    page,
    perPage,
    pageCount,
    priceBounds: {
      minPaise: prices.length ? Math.min(...prices) : 0,
      maxPaise: prices.length ? Math.max(...prices) : 0,
    },
  };
}

/**
 * Validates a coupon against a subtotal and returns the discount it earns.
 *
 * This runs on the server on purpose. The bag page calls it to show a figure,
 * and checkout must call it again against server-priced lines before the
 * Razorpay order is created — a discount the browser claims is worth nothing.
 */
export async function validateCoupon(
  rawCode: string,
  subtotalPaise: number,
): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, reason: 'Enter a code to apply.' };

  const coupon = coupons.find((item) => item.code === code);
  if (!coupon || !coupon.isActive) {
    return { ok: false, reason: 'That code is not valid.' };
  }
  if (subtotalPaise < coupon.minSubtotalPaise) {
    return {
      ok: false,
      reason: `Spend ${formatPaise(coupon.minSubtotalPaise)} to use this code.`,
    };
  }

  // Percentage discounts round down, so a rounding error can never favour the
  // customer over the recorded price.
  const discountPaise = coupon.percentOff
    ? Math.floor((subtotalPaise * coupon.percentOff) / 100)
    : Math.min(coupon.amountOffPaise ?? 0, subtotalPaise);

  return { ok: true, coupon, discountPaise };
}

/**
 * Builds the header dropdown for each category.
 *
 * The groups are derived from the catalogue rather than hand-written, so a new
 * fabric or occasion shows up in the menu the moment a product uses it, and a
 * link can never point at a filter that returns nothing.
 */
export async function getNavigationMenus(): Promise<NavMenu[]> {
  const live = products.filter((product) => product.isActive);

  return categories
    .filter((category) => category.isActive)
    .sort((a, b) => a.position - b.position)
    .map((category) => {
      const pool = live.filter((product) => product.categorySlug === category.slug);
      const base = `/shop/${category.slug}`;

      /** Distinct values for one facet, most common first. */
      const distinct = (pick: (product: Product) => string) => {
        const counts = new Map<string, number>();
        for (const product of pool) {
          const value = pick(product);
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        return [...counts.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([value]) => value);
      };

      const collectionSlugs = [
        ...new Set(pool.flatMap((product) => product.collectionSlugs)),
      ];

      const groups: NavGroup[] = [
        {
          label: 'By fabric',
          links: distinct((product) => product.fabric)
            .slice(0, 6)
            .map((fabric) => ({
              label: fabric,
              href: `${base}?fabric=${encodeURIComponent(fabric)}`,
            })),
        },
        {
          label: 'By occasion',
          links: distinct((product) => product.occasion).map((occasion) => ({
            label: occasion,
            href: `${base}?occasion=${encodeURIComponent(occasion)}`,
          })),
        },
        {
          label: 'Edits',
          links: [
            ...collections
              .filter((collection) => collectionSlugs.includes(collection.slug))
              .map((collection) => ({
                label: collection.name,
                href: `/collections/${collection.slug}`,
              })),
            { label: 'On offer', href: `${base}?sale=1` },
            { label: `All ${category.name.toLowerCase()}`, href: base },
          ],
        },
      ].filter((group) => group.links.length > 0);

      // Lead with something new, falling back to the best rated.
      const feature =
        [...pool].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0] ??
        pool[0];

      return {
        categorySlug: category.slug,
        categoryName: category.name,
        tagline: category.tagline,
        groups,
        feature: feature && {
          name: feature.name,
          href: `/product/${feature.slug}`,
          priceLabel: formatPaise(feature.pricePaise),
          image: feature.images[0],
        },
      };
    });
}

/**
 * Variant-level stock, flattened for the admin inventory table.
 *
 * Inventory is tracked per variant rather than per product — a saree can be
 * sold out with its blouse piece and still available on its own — so the admin
 * needs the rows, not the roll-up.
 */
export async function getInventoryRows(): Promise<
  {
    productId: string;
    productName: string;
    productSlug: string;
    categorySlug: string;
    variantId: string;
    sku: string;
    variantLabel: string;
    unitPricePaise: number;
    stock: number;
  }[]
> {
  return products.flatMap((product) =>
    product.variants.map((variant) => ({
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      categorySlug: product.categorySlug,
      variantId: variant.id,
      sku: variant.sku,
      variantLabel: variant.label,
      unitPricePaise: product.pricePaise + variant.priceDeltaPaise,
      stock: variant.stock,
    })),
  );
}

/** One product by its id, for the admin detail page. */
export async function getProductById(id: string): Promise<ProductListItem | null> {
  const product = products.find((item) => item.id === id);
  return product ? toListItem(product) : null;
}
