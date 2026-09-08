/**
 * Storefront domain types.
 *
 * These mirror the planned Supabase tables one-to-one so that swapping the
 * seed data in `data.ts` for real queries is a change inside `repository.ts`
 * only — no component touches the database shape directly.
 *
 *   Category        -> categories
 *   Collection      -> collections
 *   Product         -> products
 *   ProductImage    -> product_images
 *   ProductVariant  -> product_variants + inventory
 *
 * Money is always stored as an integer number of paise, never a float and
 * never a pre-formatted string. Razorpay expects paise, and integer maths
 * keeps totals exact. Formatting for display happens in `lib/format.ts`.
 */

export type Money = number;

/** `products.badge` — a merchandising flag, not a computed state. */
export type ProductBadge = 'new' | 'bestseller' | 'limited' | 'back_in_stock';

/** Maps to `categories`. Admin-managed; never hardcoded in a component. */
export type Category = {
  id: string;
  slug: string;
  name: string;
  /** Short line used in nav and category rails. */
  tagline: string;
  /** Editorial intro shown at the top of the listing page. */
  intro: string;
  /** Longer copy rendered below the grid, mainly for SEO. */
  description: string;
  heroImage: ProductImage;
  /** Garment measurements, empty for categories that are not sized. */
  sizeChart: { size: string; bust: string; waist: string; shoulder: string }[];
  sizeChartNote: string;
  /** Display order in navigation. Lower sorts first. */
  position: number;
  /** `categories.is_active` — hidden categories 404 on the storefront. */
  isActive: boolean;
};

/** Maps to `collections` (New Arrivals, Festive, Wedding, ...). */
export type Collection = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
};

/** Maps to `product_images`. */
export type ProductImage = {
  id: string;
  /**
   * Today a path under `/public`. Once media moves to Supabase Storage this
   * becomes a signed or public bucket URL — the shape does not change.
   */
  url: string;
  alt: string;
  /**
   * CSS `object-position` for the crop. The seed art is a multi-panel sheet,
   * so each product points at its own panel. Real uploads will use '50% 50%'.
   */
  focal: string;
  position: number;
};

/** Maps to `product_variants` joined with `inventory`. */
export type ProductVariant = {
  id: string;
  sku: string;
  /** Variant axis label, e.g. a blouse size or a saree border width. */
  label: string;
  /** Paise to add to the product's base price for this variant. */
  priceDeltaPaise: Money;
  stock: number;
};

/** Maps to `products`, with its images/variants/taxonomy joined in. */
export type Product = {
  id: string;
  slug: string;
  name: string;
  /** One-line descriptor under the name on a card, e.g. 'Saree with blouse piece'. */
  subtitle: string;
  categorySlug: string;
  collectionSlugs: string[];
  pricePaise: Money;
  /** `products.compare_at_price` — the struck-through original. */
  compareAtPaise?: Money;
  badge?: ProductBadge;
  fabric: string;
  /** Human-readable colour name plus the hex used for the swatch dot. */
  colour: { name: string; hex: string };
  /** Secondary swatch dots shown on the card. */
  swatches: string[];
  occasion: string;
  technique: string;
  images: ProductImage[];
  variants: ProductVariant[];
  description: string;
  care: string[];
  /** Blouse/stitching details — nullable because blouses themselves have none. */
  blouseDetails?: string;
  rating?: { average: number; count: number };
  isActive: boolean;
  /** ISO date. Drives the 'newest' sort; convert to a timestamp column later. */
  publishedAt: string;
};

/** A product with its derived, server-computed presentation fields. */
export type ProductListItem = Product & {
  inStock: boolean;
  /** Units across every variant. Drives low-stock alerts in the admin. */
  stockTotal: number;
  /** Whole-percent discount, or 0 when there is no compare-at price. */
  discountPercent: number;
};

export type SortKey =
  | 'featured'
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'discount';

/**
 * What a listing is drawn from. Categories, collections and search all run
 * through the same filter/sort/page engine — only the starting pool differs.
 */
export type ProductScope =
  | { kind: 'category'; slug: string }
  | { kind: 'collection'; slug: string }
  | { kind: 'search'; term: string };

/**
 * A parsed listing query. Built from the URL on the server so a filtered
 * listing is shareable, crawlable, and rendered without client JS.
 */
export type ProductQuery = {
  scope: ProductScope;
  fabrics: string[];
  colours: string[];
  occasions: string[];
  collections: string[];
  /** Inclusive paise bounds. */
  minPaise?: number;
  maxPaise?: number;
  inStockOnly: boolean;
  onSaleOnly: boolean;
  sort: SortKey;
  page: number;
  perPage: number;
};

/** One selectable value in a filter group, with its live result count. */
export type FacetValue = {
  value: string;
  label: string;
  count: number;
  /** Swatch colour, present only on the colour facet. */
  hex?: string;
};

export type Facet = {
  /** Query-string key this group writes to, e.g. 'fabric'. */
  key: string;
  label: string;
  values: FacetValue[];
};

export type ProductListResult = {
  items: ProductListItem[];
  facets: Facet[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
  priceBounds: { minPaise: number; maxPaise: number };
};

/** Maps to `coupons`. Validated on the server; never trusted from the client. */
export type Coupon = {
  code: string;
  description: string;
  /** Percent off the subtotal, or a flat paise amount — never both. */
  percentOff?: number;
  amountOffPaise?: Money;
  /** Minimum subtotal in paise before the code applies. */
  minSubtotalPaise: Money;
  isActive: boolean;
};

export type CouponResult =
  | { ok: true; coupon: Coupon; discountPaise: Money }
  | { ok: false; reason: string };

/** One column of links inside a navigation dropdown. */
export type NavGroup = {
  label: string;
  links: { label: string; href: string }[];
};

/** Everything a category's dropdown needs, resolved on the server. */
export type NavMenu = {
  categorySlug: string;
  categoryName: string;
  tagline: string;
  groups: NavGroup[];
  /** A single product used as the visual anchor of the dropdown. */
  feature?: {
    name: string;
    href: string;
    priceLabel: string;
    image: ProductImage;
  };
};
