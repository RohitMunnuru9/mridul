/**
 * Loads the catalogue and site content out of Supabase and maps it into the
 * domain types the app already speaks.
 *
 * This is the file that replaces `seed-data.ts`. Everything above it — the
 * filtering, faceting, sorting and paging in `repository.ts` — is unchanged,
 * because it was written against the domain types rather than against an
 * array. That was the point of the repository boundary.
 *
 * SCALING NOTE, stated plainly: a listing loads its whole category pool and
 * filters in memory. At twenty products that is one small query and exactly
 * matches the previous behaviour. It will not hold at ten thousand — at that
 * point the filters, facet counts and paging move into SQL, and only this file
 * changes. The boundary is already in the right place; the query behind it is
 * deliberately simple for now.
 */

import { cache } from "react";
import { publicClient, storageUrl, type Client } from "@mridul/supabase";
import type {
  HelpProduct,
  Category,
  Collection,
  Coupon,
  HeroSlide,
  JournalPost,
  MediaAsset,
  OccasionPanel,
  Product,
  ProductImage,
  SiteSettings,
  StoryPanel,
  Testimonial,
  ValueProp,
  HomepageSection,
} from "@mridul/types";

/** A media row as the queries below select it. */
type MediaRow = {
  id: string;
  bucket: string;
  path: string;
  alt: string;
  focal: string;
} | null;

function toImage(media: MediaRow, position = 0): ProductImage | null {
  if (!media) return null;
  return {
    id: media.id,
    url: storageUrl(media.bucket, media.path),
    alt: media.alt,
    focal: media.focal,
    position,
  };
}

function toAsset(media: MediaRow): MediaAsset | null {
  if (!media) return null;
  return {
    id: media.id,
    url: storageUrl(media.bucket, media.path),
    alt: media.alt,
    focal: media.focal,
    bucket: media.bucket as MediaAsset["bucket"],
  };
}

/** Placeholder used only if a row somehow has no image, so nothing crashes. */
const MISSING_IMAGE: ProductImage = {
  id: "missing",
  url: "/images/saree-homepage-hero.webp",
  alt: "",
  focal: "50% center",
  position: 0,
};

const PRODUCT_SELECT = `
  id, slug, name, subtitle, description, blouse_details, care,
  price_paise, compare_at_paise, badge, fabric, colour_name, colour_hex,
  swatches, occasion, technique, rating_average, rating_count,
  is_active, is_sold_out, published_at,
  primary_category:categories!products_primary_category_id_fkey(slug),
  product_images(position, media(id, bucket, path, alt, focal)),
  product_variants(id, sku, label, price_delta_paise, position, inventory(on_hand)),
  product_collections(collections(slug))
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function toProduct(row: any): Product {
  const images: ProductImage[] = (row.product_images ?? [])
    .slice()
    .sort((a: any, b: any) => a.position - b.position)
    .map((entry: any, index: number) => toImage(entry.media, index))
    .filter(Boolean);

  const variants = (row.product_variants ?? [])
    .slice()
    .sort((a: any, b: any) => a.position - b.position)
    .map((variant: any) => ({
      id: variant.id,
      sku: variant.sku,
      label: variant.label,
      priceDeltaPaise: variant.price_delta_paise,
      // Inventory is a one-to-one row created by trigger; treat a missing one
      // as zero rather than as unlimited.
      stock: variant.inventory?.on_hand ?? 0,
    }));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    subtitle: row.subtitle,
    categorySlug: row.primary_category?.slug ?? "",
    collectionSlugs: (row.product_collections ?? [])
      .map((entry: any) => entry.collections?.slug)
      .filter(Boolean),
    pricePaise: row.price_paise,
    compareAtPaise: row.compare_at_paise ?? undefined,
    badge: row.badge ?? undefined,
    fabric: row.fabric,
    colour: { name: row.colour_name, hex: row.colour_hex },
    swatches: row.swatches ?? [],
    occasion: row.occasion,
    technique: row.technique,
    images: images.length > 0 ? images : [MISSING_IMAGE],
    variants,
    description: row.description,
    care: row.care ?? [],
    blouseDetails: row.blouse_details ?? undefined,
    rating: row.rating_average
      ? { average: Number(row.rating_average), count: row.rating_count }
      : undefined,
    isActive: row.is_active,
    isSoldOut: row.is_sold_out ?? false,
    publishedAt: row.published_at,
  };
}

/**
 * Every product the caller may see.
 *
 * Read with the anon key, so row-level security decides what comes back: a
 * shopper gets active products, and nothing else, without this code having to
 * remember to filter.
 */
async function loadProducts(client: Client = publicClient()): Promise<Product[]> {
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_SELECT)
    .order("published_at", { ascending: false });

  if (error) throw new Error(`Loading products: ${error.message}`);
  return (data ?? []).map(toProduct);
}

export async function fetchProductBySlug(
  slug: string,
  client: Client = publicClient(),
): Promise<Product | null> {
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Loading product ${slug}: ${error.message}`);
  return data ? toProduct(data) : null;
}

export async function fetchProductById(
  id: string,
  client: Client = publicClient(),
): Promise<Product | null> {
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Loading product ${id}: ${error.message}`);
  return data ? toProduct(data) : null;
}

async function loadCategories(client: Client = publicClient()): Promise<Category[]> {
  const { data, error } = await client
    .from("categories")
    .select(
      "id, slug, name, tagline, intro, description, position, is_active, " +
        "size_chart, size_chart_note, " +
        "hero:media!categories_hero_media_id_fkey(id, bucket, path, alt, focal)",
    )
    .order("position");

  if (error) throw new Error(`Loading categories: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    intro: row.intro,
    description: row.description,
    heroImage: toImage(row.hero) ?? MISSING_IMAGE,
    sizeChart: Array.isArray(row.size_chart) ? row.size_chart : [],
    sizeChartNote: row.size_chart_note ?? "",
    position: row.position,
    isActive: row.is_active,
  }));
}

async function loadCollections(): Promise<Collection[]> {
  const { data, error } = await publicClient()
    .from("collections")
    .select("id, slug, name, tagline, show_in_nav")
    .order("position");

  if (error) throw new Error(`Loading collections: ${error.message}`);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    showInNav: row.show_in_nav,
  }));
}

async function loadHeroSlides(client: Client = publicClient()): Promise<HeroSlide[]> {
  const { data, error } = await client
    .from("hero_slides")
    .select(
      "id, eyebrow, title, note, cta_label, cta_href, position, is_active, " +
        "media(id, bucket, path, alt, focal)",
    )
    .order("position");

  if (error) throw new Error(`Loading hero slides: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    media: toAsset(row.media) ?? { ...MISSING_IMAGE, bucket: "banners" as const },
    eyebrow: row.eyebrow,
    title: row.title,
    note: row.note,
    ctaLabel: row.cta_label,
    ctaHref: row.cta_href,
    position: row.position,
    isActive: row.is_active,
  }));
}

async function loadHomepageSections(client: Client = publicClient()): Promise<HomepageSection[]> {
  const { data, error } = await client
    .from("homepage_sections")
    .select("id, key, name, description, position, is_enabled, collection:collections(slug)")
    .order("position");

  if (error) throw new Error(`Loading homepage sections: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    position: row.position,
    isEnabled: row.is_enabled,
    collectionSlug: row.collection?.slug ?? undefined,
  }));
}

async function loadOccasionPanels(client: Client = publicClient()): Promise<OccasionPanel[]> {
  const { data, error } = await client
    .from("occasion_panels")
    .select("id, tone, eyebrow, title, body, cta_label, cta_href, position")
    .order("position");

  if (error) throw new Error(`Loading curated edits: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    tone: row.tone,
    eyebrow: row.eyebrow,
    title: row.title,
    body: row.body ?? undefined,
    ctaLabel: row.cta_label,
    ctaHref: row.cta_href,
    position: row.position,
  }));
}

async function loadValueProps(client: Client = publicClient()): Promise<ValueProp[]> {
  const { data, error } = await client
    .from("value_props")
    .select("id, icon, title, note, position")
    .order("position");

  if (error) throw new Error(`Loading value props: ${error.message}`);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    icon: row.icon,
    title: row.title,
    note: row.note,
    position: row.position,
  }));
}

async function loadJournalPosts(client: Client = publicClient()): Promise<JournalPost[]> {
  const { data, error } = await client
    .from("journal_posts")
    .select(
      "id, title, excerpt, href, position, is_published, " + "media(id, bucket, path, alt, focal)",
    )
    .order("position");

  if (error) throw new Error(`Loading journal: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    media: toAsset(row.media) ?? { ...MISSING_IMAGE, bucket: "homepage" as const },
    href: row.href,
    position: row.position,
    isPublished: row.is_published,
  }));
}

async function loadStoryPanel(client: Client = publicClient()): Promise<StoryPanel> {
  const { data, error } = await client
    .from("story_panel")
    .select(
      "eyebrow, title, body, stats, cta_label, cta_href, " + "media(id, bucket, path, alt, focal)",
    )
    .maybeSingle();

  if (error) throw new Error(`Loading story panel: ${error.message}`);

  const row = data as any;
  return {
    eyebrow: row?.eyebrow ?? "",
    title: row?.title ?? "",
    body: row?.body ?? "",
    media: toAsset(row?.media) ?? { ...MISSING_IMAGE, bucket: "homepage" as const },
    stats: row?.stats ?? [],
    ctaLabel: row?.cta_label ?? "",
    ctaHref: row?.cta_href ?? "/",
  };
}

async function loadSiteSettings(client: Client = publicClient()): Promise<SiteSettings> {
  const { data, error } = await client.from("settings").select("*").maybeSingle();

  if (error) throw new Error(`Loading settings: ${error.message}`);

  const row = data as any;
  return {
    brandName: row?.brand_name ?? "Mridul by MR",
    tagline: row?.tagline ?? "",
    announcements: row?.announcements ?? [],
    quotes: row?.quotes ?? [],
    freeShippingThresholdPaise: row?.free_shipping_threshold_paise ?? 199900,
    flatShippingPaise: row?.flat_shipping_paise ?? 9900,
    returnWindowDays: row?.return_window_days ?? 7,
    contact: {
      whatsapp: row?.whatsapp_number ?? "",
      email: row?.contact_email ?? "",
      instagram: row?.instagram_url ?? "",
      youtube: row?.youtube_url ?? "",
    },
    pendingPolicies: row?.pending_policies ?? [],
  };
}

/** Named editorial prose, keyed by slug. */
async function loadContentBlocks(client: Client = publicClient()): Promise<Record<string, string>> {
  const { data, error } = await client.from("content_blocks").select("key, body");

  if (error) throw new Error(`Loading content blocks: ${error.message}`);

  return Object.fromEntries((data ?? []).map((row: any) => [row.key, row.body]));
}

async function loadTestimonials(
  client: Client = publicClient(),
): Promise<Testimonial[]> {
  const { data, error } = await client
    .from("testimonials")
    .select(
      "id, author, location, body, rating, position, is_published, " +
        "media(id, bucket, path, alt, focal), product:products(name, slug)",
    )
    .order("position");

  if (error) throw new Error(`Loading testimonials: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    author: row.author,
    location: row.location,
    body: row.body,
    rating: Number(row.rating),
    media: toAsset(row.media) ?? undefined,
    productName: row.product?.name ?? undefined,
    productSlug: row.product?.slug ?? undefined,
    position: row.position,
    isPublished: row.is_published,
  }));
}

async function loadMoodTiles(client: Client = publicClient()) {
  const { data, error } = await client
    .from("mood_tiles")
    .select("id, label, note, href, icon, tone, position")
    .order("position");

  if (error) throw new Error(`Loading mood tiles: ${error.message}`);
  return (data ?? []) as any[];
}

/**
 * Coupon validation, delegated to the database function.
 *
 * The `coupons` table has no read policy, so this RPC is the only way a client
 * learns anything about a code. The discount it returns is for display; the
 * server must call it again against server-priced lines at checkout.
 */
export async function fetchCouponValidation(
  code: string,
  subtotalPaise: number,
): Promise<{ ok: boolean; reason: string; discountPaise: number; description: string }> {
  const { data, error } = await publicClient().rpc("validate_coupon", {
    p_code: code,
    p_subtotal: subtotalPaise,
  });

  if (error) throw new Error(`Validating coupon: ${error.message}`);

  const row = (Array.isArray(data) ? data[0] : data) as any;
  return {
    ok: Boolean(row?.ok),
    reason: row?.reason ?? "",
    discountPaise: Number(row?.discount_paise ?? 0),
    description: row?.description ?? "",
  };
}

/** Every image and where it is used, straight from the `media_usage` view. */
export async function fetchMediaUsage() {
  const { data, error } = await publicClient()
    .from("media_usage")
    .select("media_id, bucket, path, alt, focal, kind, label, href");

  if (error) throw new Error(`Loading media usage: ${error.message}`);
  return (data ?? []) as any[];
}

/** Coupons for the admin. Kept here so the seed types stay in one place. */
export type CouponRow = Coupon;

/**
 * The smallest description of the catalogue that is still useful to answer a
 * question with — no images, no variants, no prose.
 *
 * It exists because the help panel is rendered on every page, and it must not
 * cost a full catalogue read to tell somebody what arrived this week. Fifteen
 * short fields for twenty products is a few kilobytes; the real query is the
 * one it avoids.
 *
 * Inactive products never leave here, so a piece hidden in the admin stops
 * being mentioned without anybody editing an answer.
 */
async function loadHelpProducts(
  client: Client = publicClient(),
): Promise<HelpProduct[]> {
  const { data, error } = await client
    .from("products")
    .select(
      "slug, name, price_paise, fabric, colour_name, occasion, is_sold_out, " +
        "published_at, primary_category:categories!products_primary_category_id_fkey(slug, name)",
    )
    .eq("is_active", true)
    .order("published_at", { ascending: false });

  if (error) throw new Error(`Loading the help catalogue: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    slug: row.slug,
    name: row.name,
    pricePaise: row.price_paise,
    fabric: row.fabric ?? "",
    colourName: row.colour_name ?? "",
    occasion: row.occasion ?? "",
    soldOut: Boolean(row.is_sold_out),
    categorySlug: row.primary_category?.slug ?? "",
    categoryName: row.primary_category?.name ?? "",
  }));
}

/* ---------------------------------------------------------------------------
 * One read per request, not one per caller
 * ---------------------------------------------------------------------------
 * These are pure reads of a catalogue that cannot change while a single page
 * is being rendered, and several were being asked for again and again inside
 * one render. The admin's Collections page was the worst: it wants the
 * membership of five collections and the counts, and every one of those went
 * and fetched the entire catalogue — products, images, variants, inventory.
 *
 * React's `cache` is per request and only per request. That distinction is the
 * whole reason it is safe: two shoppers never share a result, and a page
 * rendered after an edit never sees the version from before it. It asks the
 * same question once rather than remembering the answer.
 *
 * `perRequest` exists because `cache` keys on the exact argument list, and
 * these functions all take an optional client. `fetchProducts()` and
 * `fetchProducts(undefined)` are the same question asked two ways, and without
 * trimming they became two cache entries and two round trips — which is most
 * of what the first attempt at this left on the table.
 *
 * Only trailing undefined is dropped, so `fetchTestimonials(true, undefined)`
 * still differs from `fetchTestimonials(undefined, client)`. And a real client
 * argument is kept: the admin's session sees rows the anonymous one does not,
 * because row-level security says so, and those must never share an answer.
 * ------------------------------------------------------------------------- */

function perRequest<A extends unknown[], R>(load: (...args: A) => Promise<R>) {
  const once = cache(load);
  return (...args: A): Promise<R> => {
    const trimmed = [...args];
    while (trimmed.length > 0 && trimmed[trimmed.length - 1] === undefined) {
      trimmed.pop();
    }
    return once(...(trimmed as A));
  };
}

export const fetchProducts = perRequest(loadProducts);
export const fetchCategories = perRequest(loadCategories);
export const fetchCollections = perRequest(loadCollections);
export const fetchSiteSettings = perRequest(loadSiteSettings);
export const fetchContentBlocks = perRequest(loadContentBlocks);
export const fetchHelpProducts = perRequest(loadHelpProducts);
export const fetchHeroSlides = perRequest(loadHeroSlides);
export const fetchHomepageSections = perRequest(loadHomepageSections);
export const fetchMoodTiles = perRequest(loadMoodTiles);
export const fetchOccasionPanels = perRequest(loadOccasionPanels);
export const fetchValueProps = perRequest(loadValueProps);
export const fetchJournalPosts = perRequest(loadJournalPosts);
export const fetchStoryPanel = perRequest(loadStoryPanel);
export const fetchTestimonials = perRequest(loadTestimonials);
