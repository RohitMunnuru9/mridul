/**
 * Content repository — the boundary for everything that is not a product.
 *
 * Same contract as the catalogue repository: async, plain DTOs, reads through
 * the anon key so row-level security decides what comes back. A hero banner
 * outside its scheduling window is invisible here because the policy says so.
 *
 * `getMediaLibrary` now reads the `media_usage` view rather than walking the
 * catalogue in application code. That means "where is this image used?" is
 * answered by the real foreign keys and cannot drift out of date.
 */

import type {
  Category,
  HeroSlide,
  HomepageSection,
  JournalPost,
  MediaBucket,
  MediaRecord,
  MediaUsage,
  OccasionPanel,
  SiteSettings,
  StoryPanel,
  ValueProp,
} from '@mridul/types';
import {
  fetchCategories,
  fetchCollections,
  fetchContentBlocks,
  fetchHeroSlides,
  fetchHomepageSections,
  fetchJournalPosts,
  fetchMediaUsage,
  fetchMoodTiles,
  fetchOccasionPanels,
  fetchProducts,
  fetchSiteSettings,
  fetchStoryPanel,
  fetchValueProps,
} from './supabase-source';
import { storageUrl } from '@mridul/supabase';
import type { MoodTile } from './homepage';

export async function getHeroSlides(includeInactive = false): Promise<HeroSlide[]> {
  const slides = await fetchHeroSlides();
  return includeInactive ? slides : slides.filter((slide) => slide.isActive);
}

export async function getHomepageSections(
  includeDisabled = false,
): Promise<HomepageSection[]> {
  const sections = await fetchHomepageSections();
  return includeDisabled ? sections : sections.filter((section) => section.isEnabled);
}

export async function getOccasionPanels(): Promise<OccasionPanel[]> {
  return fetchOccasionPanels();
}

export async function getStoryPanel(): Promise<StoryPanel> {
  return fetchStoryPanel();
}

export async function getValueProps(): Promise<ValueProp[]> {
  return fetchValueProps();
}

export async function getJournalPosts(includeDrafts = false): Promise<JournalPost[]> {
  const posts = await fetchJournalPosts();
  return includeDrafts ? posts : posts.filter((post) => post.isPublished);
}

export async function getSiteSettings(): Promise<SiteSettings> {
  return fetchSiteSettings();
}

/**
 * Editorial prose by key, with a fallback so a missing row shows nothing
 * rather than the word "undefined" on a customer-facing page.
 */
export async function getContentBlocks(): Promise<Record<string, string>> {
  return fetchContentBlocks();
}

/** Homepage entry tiles. Rows now, so a tile can be edited without a deploy. */
export async function getMoodTiles(): Promise<MoodTile[]> {
  const rows = await fetchMoodTiles();
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    note: row.note,
    href: row.href,
    icon: row.icon,
    tone: row.tone,
    position: row.position,
  }));
}

/**
 * Every image the site uses, keyed by file, with every reference to it.
 *
 * Deduplication is by storage path rather than by media id, because while the
 * catalogue is seeded with placeholder art the same file deliberately does
 * several jobs — and the admin needs to see that before anyone swaps it.
 */
export async function getMediaLibrary(): Promise<MediaRecord[]> {
  const rows = await fetchMediaUsage();
  const byPath = new Map<string, MediaRecord>();

  for (const row of rows) {
    const url = storageUrl(row.bucket, row.path);
    const usage: MediaUsage = {
      kind: row.kind,
      label: row.label,
      href: row.href ?? undefined,
    };

    const existing = byPath.get(url);
    if (existing) {
      existing.usages.push(usage);
      if (!existing.buckets.includes(row.bucket)) {
        existing.buckets.push(row.bucket as MediaBucket);
      }
    } else {
      byPath.set(url, {
        id: row.media_id,
        url,
        path: row.path,
        alt: row.alt,
        focal: row.focal,
        buckets: [row.bucket as MediaBucket],
        usages: [usage],
      });
    }
  }

  return [...byPath.values()].sort(
    (a, b) => b.usages.length - a.usages.length || a.url.localeCompare(b.url),
  );
}

/** Counts per bucket, for the media page header. */
export async function getMediaSummary(): Promise<{
  files: number;
  references: number;
  buckets: { bucket: string; files: number }[];
}> {
  const library = await getMediaLibrary();
  const buckets = new Map<string, number>();
  for (const record of library) {
    for (const bucket of record.buckets) {
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }
  }

  return {
    files: library.length,
    references: library.reduce((total, record) => total + record.usages.length, 0),
    buckets: [...buckets.entries()]
      .map(([bucket, files]) => ({ bucket, files }))
      .sort((a, b) => b.files - a.files),
  };
}

/** Collections with the number of products currently in each. */
export async function getCollectionsWithCounts(): Promise<
  { id: string; slug: string; name: string; tagline: string; productCount: number }[]
> {
  const [collections, products] = await Promise.all([
    fetchCollections(),
    fetchProducts(),
  ]);

  return collections.map((collection) => ({
    ...collection,
    productCount: products.filter((product) =>
      product.collectionSlugs.includes(collection.slug),
    ).length,
  }));
}

/** Categories with product and stock totals, for the admin category list. */
export async function getCategoriesWithCounts(): Promise<
  (Category & { productCount: number; stockTotal: number })[]
> {
  const [categories, products] = await Promise.all([
    fetchCategories(),
    fetchProducts(),
  ]);

  return categories.map((category) => {
    const pool = products.filter((product) => product.categorySlug === category.slug);
    return {
      ...category,
      productCount: pool.length,
      stockTotal: pool.reduce(
        (total, product) =>
          total + product.variants.reduce((sum, variant) => sum + variant.stock, 0),
        0,
      ),
    };
  });
}
