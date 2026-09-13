/**
 * Catalogue repository — the single boundary between the storefront and the
 * data store.
 *
 * The store is now Supabase. Everything below still returns plain DTOs, and
 * every component above it is unchanged, because they were written against the
 * domain types rather than against an array.
 *
 * Filtering, sorting, faceting and pagination still run here rather than in
 * the browser. That is deliberate: the result set, the price shown and the
 * stock state are decided server-side, and the client is only ever handed the
 * answer. The same rule holds at checkout, where prices must be re-read from
 * the database and never taken from the request body.
 *
 * Reads use the anon key, so row-level security decides what comes back. An
 * inactive product is invisible here because Postgres says so, not because
 * this file remembered to filter it out.
 */

import { discountPercent, formatPaise } from "@mridul/utils";
import type { Client } from "@mridul/supabase";
import {
  fetchCategories,
  fetchCollections,
  fetchCouponValidation,
  fetchProductById,
  fetchHelpProducts,
  fetchProductBySlug,
  fetchProducts,
} from "./supabase-source";
import type {
  Category,
  Collection,
  CouponResult,
  Facet,
  FacetValue,
  HelpProduct,
  NavGroup,
  NavMenu,
  Product,
  ProductListItem,
  ProductListResult,
  ProductQuery,
  ProductScope,
  SortKey,
} from "@mridul/types";

/** Total units across every variant. */
function stockOf(product: Product): number {
  return product.variants.reduce((total, variant) => total + variant.stock, 0);
}

/** Attaches the fields the UI needs but must not compute for itself. */
function toListItem(product: Product): ProductListItem {
  const stockTotal = stockOf(product);
  return {
    ...product,
    // Buyable needs both: stock on the shelf, and nobody having held it back.
    inStock: stockTotal > 0 && !product.isSoldOut,
    stockTotal,
    discountPercent: discountPercent(product.pricePaise, product.compareAtPaise),
  };
}

/** Every product the caller may see. RLS hides drafts from the public. */
export async function getAllProducts(client?: Client): Promise<ProductListItem[]> {
  return (await fetchProducts(client)).map(toListItem);
}

export async function getCategories(): Promise<Category[]> {
  return (await fetchCategories()).filter((category) => category.isActive);
}

/** Every category visible to a signed-in catalogue manager, including hidden ones. */
export async function getAllCategories(client?: Client): Promise<Category[]> {
  return fetchCategories(client);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const categories = await fetchCategories();
  return categories.find((item) => item.slug === slug && item.isActive) ?? null;
}

export async function getCollections(): Promise<Collection[]> {
  return fetchCollections();
}

export async function getCollectionBySlug(slug: string): Promise<Collection | null> {
  const collections = await fetchCollections();
  return collections.find((item) => item.slug === slug) ?? null;
}

export async function getProductBySlug(slug: string): Promise<ProductListItem | null> {
  const product = await fetchProductBySlug(slug);
  return product ? toListItem(product) : null;
}

/** One product by its id, for the admin detail page. */
export async function getProductById(id: string, client?: Client): Promise<ProductListItem | null> {
  const product = await fetchProductById(id, client);
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
  const all = await fetchProducts();
  return all
    .filter((item) => item.categorySlug === product.categorySlug && item.id !== product.id)
    .sort((a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0))
    .slice(0, limit)
    .map(toListItem);
}

/**
 * Products belonging to a collection, for the homepage and shop rails.
 *
 * The storefront calls this without a client and gets the public view, which
 * is what a rail should show. The admin passes its own, so a hidden draft
 * still appears in the collection it belongs to.
 */
export async function getProductsByCollection(
  collectionSlug: string,
  limit = 8,
  client?: Client,
): Promise<ProductListItem[]> {
  const all = await fetchProducts(client);
  return all
    .filter((item) => item.collectionSlugs.includes(collectionSlug))
    .slice(0, limit)
    .map(toListItem);
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
  const all = await fetchProducts();
  return all.filter((product) => wanted.has(product.id)).map(toListItem);
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
    .join(" ")
    .toLowerCase();
  return term
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/** The starting pool for a listing, before any filter is applied. */
function poolFor(all: Product[], scope: ProductScope): Product[] {
  switch (scope.kind) {
    case "category":
      return all.filter((product) => product.categorySlug === scope.slug);
    case "collection":
      return all.filter((product) => product.collectionSlugs.includes(scope.slug));
    case "search":
      return scope.term.trim() ? all.filter((product) => matchesTerm(product, scope.term)) : [];
  }
}

/** One predicate per filter group, so facet counts can skip their own group. */
type Predicates = Record<string, (product: Product) => boolean>;

function buildPredicates(query: ProductQuery): Predicates {
  return {
    fabric: (product) => query.fabrics.length === 0 || query.fabrics.includes(product.fabric),
    colour: (product) => query.colours.length === 0 || query.colours.includes(product.colour.name),
    occasion: (product) =>
      query.occasions.length === 0 || query.occasions.includes(product.occasion),
    collection: (product) =>
      query.collections.length === 0 ||
      product.collectionSlugs.some((slug) => query.collections.includes(slug)),
    price: (product) =>
      (query.minPaise === undefined || product.pricePaise >= query.minPaise) &&
      (query.maxPaise === undefined || product.pricePaise <= query.maxPaise),
    // "In stock only" means buyable, so a piece held back as sold out is
    // excluded even while its shelf count is above zero.
    availability: (product) =>
      !query.inStockOnly || (stockOf(product) > 0 && !product.isSoldOut),
    sale: (product) =>
      !query.onSaleOnly || discountPercent(product.pricePaise, product.compareAtPaise) > 0,
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
 * The listing query behind every category, collection and search page.
 *
 * Returns the page of results plus the facets for the current filter state,
 * so the page renders complete on the server with no client round trip.
 */
export async function listProducts(query: ProductQuery): Promise<ProductListResult> {
  const [all, collections] = await Promise.all([fetchProducts(), fetchCollections()]);

  const pool = poolFor(all, query.scope);
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
      key: "fabric",
      label: "Fabric",
      values: toFacetValues(countBy(pool, predicates, "fabric", (p) => [p.fabric])),
    },
    {
      key: "colour",
      label: "Colour",
      values: toFacetValues(
        countBy(pool, predicates, "colour", (p) => [p.colour.name]),
        undefined,
        (value) => colourHex.get(value),
      ),
    },
    {
      key: "occasion",
      label: "Occasion",
      values: toFacetValues(countBy(pool, predicates, "occasion", (p) => [p.occasion])),
    },
    {
      key: "collection",
      label: "Collection",
      values: toFacetValues(
        countBy(pool, predicates, "collection", (p) => p.collectionSlugs),
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
 * Delegates to the `validate_coupon` database function. The `coupons` table has
 * no read policy at all, so this is the only way a client learns anything about
 * a code — a shopper can test one they were given but cannot enumerate the
 * rest. Checkout must call it again against server-priced lines.
 */
export async function validateCoupon(
  rawCode: string,
  subtotalPaise: number,
): Promise<CouponResult> {
  const result = await fetchCouponValidation(rawCode, subtotalPaise);

  if (!result.ok) {
    return { ok: false, reason: result.reason || "That code is not valid." };
  }

  return {
    ok: true,
    coupon: {
      code: rawCode.trim().toUpperCase(),
      description: result.description,
      minSubtotalPaise: 0,
      isActive: true,
    },
    discountPaise: result.discountPaise,
  };
}

/**
 * Variant-level stock, flattened for the admin inventory table.
 *
 * Inventory is tracked per variant rather than per product — a saree can be
 * sold out with its blouse piece and still available on its own — so the admin
 * needs the rows, not the roll-up.
 *
 * Takes the caller's client for the same reason `getAllProducts` does: without
 * it this reads as the public, and RLS drops every hidden product, so a draft
 * being prepared for launch has no stock an admin can see or set.
 */
export async function getInventoryRows(client?: Client): Promise<
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
  const products = await fetchProducts(client);
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

/**
 * Builds the header dropdown for each category.
 *
 * The groups are derived from the catalogue rather than hand-written, so a new
 * fabric or occasion shows up in the menu the moment a product uses it, and a
 * link can never point at a filter that returns nothing.
 */
export async function getNavigationMenus(): Promise<NavMenu[]> {
  const [live, categories, collections] = await Promise.all([
    fetchProducts(),
    fetchCategories(),
    fetchCollections(),
  ]);

  return categories
    .filter((category) => category.isActive)
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

      const collectionSlugs = [...new Set(pool.flatMap((product) => product.collectionSlugs))];

      const groups: NavGroup[] = [
        {
          label: "By fabric",
          links: distinct((product) => product.fabric)
            .slice(0, 6)
            .map((fabric) => ({
              label: fabric,
              href: `${base}?fabric=${encodeURIComponent(fabric)}`,
            })),
        },
        {
          label: "By occasion",
          links: distinct((product) => product.occasion).map((occasion) => ({
            label: occasion,
            href: `${base}?occasion=${encodeURIComponent(occasion)}`,
          })),
        },
        {
          label: "Edits",
          links: [
            ...collections
              .filter((collection) => collectionSlugs.includes(collection.slug))
              .map((collection) => ({
                label: collection.name,
                href: `/collections/${collection.slug}`,
              })),
            { label: "On offer", href: `${base}?sale=1` },
            { label: `All ${category.name.toLowerCase()}`, href: base },
          ],
        },
      ].filter((group) => group.links.length > 0);

      // Lead with something new, falling back to the best rated.
      const feature =
        [...pool].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0] ?? pool[0];

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
 * The catalogue the help panel answers from.
 *
 * Read on every render rather than baked into the script, which is the whole
 * point: a product added in the admin is something the panel can talk about on
 * the next page load, and one hidden there stops being mentioned — without
 * anybody editing an answer or redeploying.
 */
export async function getHelpProducts(): Promise<HelpProduct[]> {
  return fetchHelpProducts();
}
