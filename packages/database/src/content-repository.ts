/**
 * Content repository — the boundary for everything that is not a product.
 *
 * Same contract as the catalogue repository: async, plain DTOs, and the only
 * place that touches the underlying rows. Swapping to Supabase is a change
 * inside these function bodies.
 *
 * `getMediaLibrary` is the one worth reading twice. It walks every source of
 * imagery in the project — product shots, category heroes, hero banners,
 * journal cards, the story panel — and returns one deduplicated row per file
 * with a list of everywhere it is used. That means the admin can answer "what
 * is this image doing?" before anyone replaces or deletes it.
 */

import type {
  Category,
  HeroSlide,
  HomepageSection,
  JournalPost,
  MediaAsset,
  MediaRecord,
  MediaUsage,
  OccasionPanel,
  Product,
  SiteSettings,
  StoryPanel,
  ValueProp,
} from '@mridul/types';
import { categories, collections, products } from './seed-data';
import {
  heroSlides,
  homepageSections,
  journalPosts,
  occasionPanels,
  siteSettings,
  storyPanel,
  valueProps,
} from './site-content';

export async function getHeroSlides(includeInactive = false): Promise<HeroSlide[]> {
  return heroSlides
    .filter((slide) => includeInactive || slide.isActive)
    .sort((a, b) => a.position - b.position);
}

export async function getHomepageSections(
  includeDisabled = false,
): Promise<HomepageSection[]> {
  return homepageSections
    .filter((section) => includeDisabled || section.isEnabled)
    .sort((a, b) => a.position - b.position);
}

export async function getOccasionPanels(): Promise<OccasionPanel[]> {
  return [...occasionPanels].sort((a, b) => a.position - b.position);
}

export async function getStoryPanel(): Promise<StoryPanel> {
  return storyPanel;
}

export async function getValueProps(): Promise<ValueProp[]> {
  return [...valueProps].sort((a, b) => a.position - b.position);
}

export async function getJournalPosts(
  includeDrafts = false,
): Promise<JournalPost[]> {
  return journalPosts
    .filter((post) => includeDrafts || post.isPublished)
    .sort((a, b) => a.position - b.position);
}

export async function getSiteSettings(): Promise<SiteSettings> {
  return siteSettings;
}

/** Product images carry their own shape; normalise them into the media type. */
function fromProduct(product: Product): { asset: MediaAsset; usage: MediaUsage }[] {
  return product.images.map((image, index) => ({
    asset: {
      id: image.id,
      url: image.url,
      alt: image.alt,
      focal: image.focal,
      bucket: 'products' as const,
    },
    usage: {
      kind: 'Product' as const,
      label: `${product.name}${index === 0 ? ' (thumbnail)' : ` (image ${index + 1})`}`,
      href: `/product/${product.slug}`,
    },
  }));
}

function fromCategory(category: Category): { asset: MediaAsset; usage: MediaUsage } {
  return {
    asset: {
      id: category.heroImage.id,
      url: category.heroImage.url,
      alt: category.heroImage.alt,
      focal: category.heroImage.focal,
      bucket: 'collections',
    },
    usage: {
      kind: 'Category',
      label: `${category.name} header`,
      href: `/shop/${category.slug}`,
    },
  };
}

/**
 * Every image the site uses, keyed by file.
 *
 * Deduplication is by URL rather than by asset id on purpose: the same file
 * is deliberately reused in several places while the catalogue is seeded with
 * placeholder art, and the admin needs to see that one file is doing five
 * jobs before anyone swaps it.
 */
export async function getMediaLibrary(): Promise<MediaRecord[]> {
  const entries: { asset: MediaAsset; usage: MediaUsage }[] = [
    ...products.flatMap(fromProduct),
    ...categories.map(fromCategory),
    ...heroSlides.map((slide) => ({
      asset: slide.media,
      usage: {
        kind: 'Hero slide' as const,
        label: `${slide.title} (slide ${slide.position})`,
        href: '/',
      },
    })),
    ...journalPosts.map((post) => ({
      asset: post.media,
      usage: { kind: 'Journal' as const, label: post.title, href: post.href },
    })),
    {
      asset: storyPanel.media,
      usage: { kind: 'Story' as const, label: storyPanel.title, href: '/' },
    },
  ];

  const byUrl = new Map<string, MediaRecord>();
  for (const { asset, usage } of entries) {
    const existing = byUrl.get(asset.url);
    if (existing) {
      existing.usages.push(usage);
      if (!existing.buckets.includes(asset.bucket)) {
        existing.buckets.push(asset.bucket);
      }
    } else {
      const { bucket, ...rest } = asset;
      byUrl.set(asset.url, { ...rest, buckets: [bucket], usages: [usage] });
    }
  }

  return [...byUrl.values()].sort(
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
  return collections.map((collection) => ({
    ...collection,
    productCount: products.filter(
      (product) => product.isActive && product.collectionSlugs.includes(collection.slug),
    ).length,
  }));
}

/** Categories with product and stock totals, for the admin category list. */
export async function getCategoriesWithCounts(): Promise<
  (Category & { productCount: number; stockTotal: number })[]
> {
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
