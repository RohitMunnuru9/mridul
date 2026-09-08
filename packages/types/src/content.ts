/**
 * Site content types.
 *
 * Everything the storefront shows that is not a product lives here: the hero
 * carousel, the homepage sections and their order, the journal, the story
 * panel and the site settings.
 *
 * The point of this file is that none of it is hardcoded in a component. A
 * banner, a headline or a hero image is a row an admin edits, which is the
 * difference between the content team shipping a change and a developer
 * having to. These map onto the planned `homepage_sections`, `banners`,
 * `media` and `settings` tables.
 */

import type { Money } from './catalog';

/** Which Supabase Storage bucket an asset belongs in. */
export type MediaBucket =
  | 'products'
  | 'collections'
  | 'banners'
  | 'homepage'
  | 'media';

/**
 * One image the site uses. Today `url` is a path under `/public`; once media
 * moves to Supabase Storage it becomes a bucket URL and nothing else changes.
 */
export type MediaAsset = {
  id: string;
  url: string;
  alt: string;
  /** CSS `object-position` for the crop. */
  focal: string;
  bucket: MediaBucket;
};

/** Where an asset appears, so nothing is deleted while still in use. */
export type MediaUsage = {
  /** What kind of record references it. */
  kind: 'Product' | 'Category' | 'Hero slide' | 'Journal' | 'Story' | 'Collection';
  label: string;
  /** Storefront URL where it can be seen, when there is one. */
  href?: string;
};

/**
 * An asset plus every reference to it — the media library row.
 *
 * `buckets` is a list rather than a single value because a file can legitimately
 * serve two purposes at once. While the catalogue is seeded with placeholder
 * art, one image is a product shot *and* a hero banner, and the library has to
 * say so rather than pick whichever it saw first.
 */
export type MediaRecord = Omit<MediaAsset, 'bucket'> & {
  buckets: MediaBucket[];
  usages: MediaUsage[];
};

/** One slide of the homepage hero carousel. Maps to `banners`. */
export type HeroSlide = {
  id: string;
  media: MediaAsset;
  eyebrow: string;
  title: string;
  note: string;
  ctaLabel: string;
  ctaHref: string;
  position: number;
  isActive: boolean;
};

/** Keys the storefront knows how to render. */
export type HomepageSectionKey =
  | 'hero'
  | 'mood_tiles'
  | 'occasions'
  | 'featured_products'
  | 'story'
  | 'journal';

/**
 * One block of the homepage. Order and visibility are data, so a section can
 * be moved or switched off without a deploy.
 */
export type HomepageSection = {
  id: string;
  key: HomepageSectionKey;
  name: string;
  description: string;
  position: number;
  isEnabled: boolean;
  /** Which collection feeds the section, where that applies. */
  collectionSlug?: string;
};

export type JournalPost = {
  id: string;
  title: string;
  excerpt: string;
  media: MediaAsset;
  href: string;
  position: number;
  isPublished: boolean;
};

/** The editorial panel about the brand. */
export type StoryPanel = {
  eyebrow: string;
  title: string;
  body: string;
  media: MediaAsset;
  stats: { label: string; value: string }[];
  ctaLabel: string;
  ctaHref: string;
};

/** The three curated panels between the mood tiles and the product rail. */
export type OccasionPanel = {
  id: string;
  tone: 'visual' | 'note' | 'impact';
  eyebrow: string;
  title: string;
  body?: string;
  ctaLabel: string;
  ctaHref: string;
  position: number;
};

/** Icon keys the value strip knows how to draw. */
export type ValueIcon = 'truck' | 'returns' | 'secure' | 'artisans';

export type ValueProp = {
  id: string;
  icon: ValueIcon;
  title: string;
  note: string;
  position: number;
};

/**
 * Site-wide settings. Maps to `settings`.
 *
 * The free-shipping threshold lives here as the single figure the announcement
 * bar, the bag meter and the shipping module all read, so they cannot drift.
 */
export type SiteSettings = {
  brandName: string;
  tagline: string;
  announcements: string[];
  /** Rotated above the header. Brand voice, not merchandising. */
  quotes: string[];
  /** The one free-shipping figure. Everything that quotes shipping reads it. */
  freeShippingThresholdPaise: Money;
  /** Charged below the threshold until a courier is contracted. */
  flatShippingPaise: Money;
  returnWindowDays: number;
  contact: {
    whatsapp: string;
    email: string;
    instagram: string;
    youtube: string;
  };
  /** Policy pages that still need writing, listed so the gap is visible. */
  pendingPolicies: string[];
};

/** A named piece of editorial prose, looked up by key. */
export type ContentBlock = {
  key: string;
  title: string;
  body: string;
  placement: string;
};

/** One row of a category's size chart. Measurements are of the garment. */
export type SizeChartRow = {
  size: string;
  bust: string;
  waist: string;
  shoulder: string;
};
