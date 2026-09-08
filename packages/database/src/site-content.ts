/**
 * Site content — the homepage and site-wide settings as data.
 *
 * Everything here was previously written into components. Moving it means the
 * hero image, the headline over it, the order of the homepage sections and the
 * WhatsApp number are all things an admin can see and, once Supabase is
 * connected, change. Stands in for `banners`, `homepage_sections` and
 * `settings`.
 */

import type {
  HeroSlide,
  HomepageSection,
  JournalPost,
  MediaAsset,
  OccasionPanel,
  SiteSettings,
  StoryPanel,
  ValueProp,
} from '@mridul/types';

const HERO_IMAGE = '/images/saree-homepage-hero.png';
const LOOM_IMAGE = '/images/artisan-loom-story.png';
const SHEET_IMAGE = '/images/saree-catalog-four-panel.png';

function asset(
  id: string,
  url: string,
  alt: string,
  focal: string,
  bucket: MediaAsset['bucket'],
): MediaAsset {
  return { id, url, alt, focal, bucket };
}

export const heroSlides: HeroSlide[] = [
  {
    id: 'hero_noor',
    media: asset(
      'media_hero_noor',
      HERO_IMAGE,
      'Woman wearing an ivory botanical saree beside a heritage window',
      '66% center',
      'banners',
    ),
    eyebrow: 'The Noor collection · 01',
    title: 'Tradition looks different here.',
    note: 'Timeless Indian wear, softened for the life you live now.',
    ctaLabel: 'Explore the collection',
    ctaHref: '/collections/new-arrivals',
    position: 1,
    isActive: true,
  },
  {
    id: 'hero_everyday',
    media: asset(
      'media_hero_everyday',
      SHEET_IMAGE,
      'A softly lit edit of four contemporary sarees',
      '17% center',
      'banners',
    ),
    eyebrow: 'The everyday edit · 02',
    title: 'Easy drapes. Lasting presence.',
    note: 'Handpicked textures that move beautifully from morning to evening.',
    ctaLabel: 'Shop everyday drapes',
    ctaHref: '/shop/sarees?occasion=Everyday',
    position: 2,
    isActive: true,
  },
  {
    id: 'hero_handloom',
    media: asset(
      'media_hero_handloom',
      LOOM_IMAGE,
      'Artisan hands working rose and moss threads on a handloom',
      '58% center',
      'banners',
    ),
    eyebrow: 'Made by hand · 03',
    title: 'A slower kind of beautiful.',
    note: 'Rooted in craft, considered in every detail, made to stay with you.',
    ctaLabel: 'See the handloom edit',
    ctaHref: '/collections/best-sellers',
    position: 3,
    isActive: true,
  },
];

export const homepageSections: HomepageSection[] = [
  {
    id: 'sec_hero',
    key: 'hero',
    name: 'Hero carousel',
    description: 'Full-bleed banners at the top of the homepage.',
    position: 1,
    isEnabled: true,
  },
  {
    id: 'sec_mood',
    key: 'mood_tiles',
    name: 'Shop by mood',
    description: 'Six tiles that open a pre-filtered listing.',
    position: 2,
    isEnabled: true,
  },
  {
    id: 'sec_occasions',
    key: 'occasions',
    name: 'Curated edits',
    description: 'Three editorial panels between the tiles and the products.',
    position: 3,
    isEnabled: true,
  },
  {
    id: 'sec_products',
    key: 'featured_products',
    name: 'Featured products',
    description: 'The product rail. Fed by a collection rather than a fixed list.',
    position: 4,
    isEnabled: true,
    collectionSlug: 'new-arrivals',
  },
  {
    id: 'sec_story',
    key: 'story',
    name: 'Brand story',
    description: 'The artisan panel and the value strip beneath it.',
    position: 5,
    isEnabled: true,
  },
  {
    id: 'sec_journal',
    key: 'journal',
    name: 'Style journal',
    description: 'Three editorial cards.',
    position: 6,
    isEnabled: true,
  },
];

export const occasionPanels: OccasionPanel[] = [
  {
    id: 'occ_everyday',
    tone: 'visual',
    eyebrow: 'Everyday, extraordinary',
    title: 'Quiet pieces with a little more feeling.',
    ctaLabel: 'Shop everyday sarees',
    ctaHref: '/shop/sarees?occasion=Everyday',
    position: 1,
  },
  {
    id: 'occ_blouses',
    tone: 'note',
    eyebrow: 'The blouse edit',
    title: 'Fits that feel like you.',
    body: 'Considered shapes, gentle structure, and details made to be seen.',
    ctaLabel: 'Explore blouses',
    ctaHref: '/shop/blouses',
    position: 2,
  },
  {
    id: 'occ_impact',
    tone: 'impact',
    eyebrow: 'Conscious choices',
    title: 'Brighter tomorrows.',
    ctaLabel: 'Our impact',
    ctaHref: '/shop',
    position: 3,
  },
];

export const storyPanel: StoryPanel = {
  eyebrow: 'Rooted in her',
  title: 'A more mindful kind of modern.',
  body: 'Every Mridul piece begins with a conversation—with a weaver, a landscape, and a feeling worth translating into cloth.',
  media: asset(
    'media_story_loom',
    LOOM_IMAGE,
    'Artisan hands weaving rose and moss threads on a wooden handloom',
    '50% center',
    'homepage',
  ),
  stats: [
    { value: '14', label: 'craft clusters' },
    { value: '280+', label: 'artisan partners' },
    { value: '100%', label: 'considered' },
  ],
  ctaLabel: 'Our story',
  ctaHref: '/shop',
};

export const valueProps: ValueProp[] = [
  { id: 'val_ship', icon: 'truck', title: 'Free shipping', note: 'Above ₹1,999', position: 1 },
  { id: 'val_return', icon: 'returns', title: 'Easy returns', note: 'Within 7 days', position: 2 },
  { id: 'val_secure', icon: 'secure', title: 'Secure payments', note: 'Protected, always', position: 3 },
  { id: 'val_artisan', icon: 'artisans', title: 'Support artisans', note: 'Weavers first', position: 4 },
];

export const journalPosts: JournalPost[] = [
  {
    id: 'post_drape',
    title: 'Five ways to drape for today',
    excerpt: 'The pleats, the pallu, and four small changes that shift the whole look.',
    media: asset(
      'media_journal_drape',
      SHEET_IMAGE,
      'Four contemporary sarees photographed side by side',
      '68% center',
      'homepage',
    ),
    href: '/shop/sarees',
    position: 1,
    isPublished: true,
  },
  {
    id: 'post_blouse',
    title: 'The art of the blouse',
    excerpt: 'Why the half you notice least decides how the whole drape reads.',
    media: asset(
      'media_journal_blouse',
      HERO_IMAGE,
      'A fitted ivory blouse under a botanical saree',
      '65% center',
      'homepage',
    ),
    href: '/shop/blouses',
    position: 2,
    isPublished: true,
  },
  {
    id: 'post_festive',
    title: 'Festive, without the fuss',
    excerpt: 'Dressing for a long day of ceremony without changing three times.',
    media: asset(
      'media_journal_festive',
      LOOM_IMAGE,
      'Festive threads being wound before weaving',
      '70% center',
      'homepage',
    ),
    href: '/collections/festive',
    position: 3,
    isPublished: true,
  },
];

/**
 * Homepage entry tiles. Each is a category plus a filter, so a tile always
 * resolves to a real listing and can never dead-end.
 */
export const moodTiles = [
  {
    id: 'mood_everyday',
    label: 'Everyday drapes',
    note: 'Airy and easy',
    href: '/shop/sarees?occasion=Everyday',
    icon: 'waves',
    tone: 'clay',
    position: 1,
  },
  {
    id: 'mood_silk',
    label: 'Silk stories',
    note: 'Quiet celebration',
    href: '/shop/sarees?fabric=Tussar+silk&fabric=Banarasi+silk&fabric=Kanjivaram+silk',
    icon: 'sparkles',
    tone: 'moss',
    position: 2,
  },
  {
    id: 'mood_blouses',
    label: 'Ready-to-wear blouses',
    note: 'Finish the drape',
    href: '/shop/blouses',
    icon: 'scissors',
    tone: 'rose',
    position: 3,
  },
  {
    id: 'mood_wedding',
    label: 'Wedding edit',
    note: 'For grand days',
    href: '/collections/wedding',
    icon: 'gem',
    tone: 'sand',
    position: 4,
  },
  {
    id: 'mood_handloom',
    label: 'Handloom',
    note: 'Made with time',
    href: '/shop/sarees?occasion=Work&occasion=Everyday',
    icon: 'flower',
    tone: 'ink',
    position: 5,
  },
  {
    id: 'mood_sale',
    label: 'On offer',
    note: 'Still in stock',
    href: '/shop/sarees?sale=1',
    icon: 'gift',
    tone: 'lilac',
    position: 6,
  },
];

export const siteSettings: SiteSettings = {
  brandName: 'Mridul by MR',
  tagline: 'Sarees made to stay with you',
  announcements: [
    'Free shipping above ₹1,999',
    'Easy 7-day returns',
    'Cash on delivery available',
    'Handwoven in small runs',
  ],
  freeShippingThresholdPaise: 199900,
  flatShippingPaise: 9900,
  returnWindowDays: 7,
  contact: {
    whatsapp: '+91 90000 00000',
    email: 'hello@mridulbymr.com',
    instagram: 'https://instagram.com',
    youtube: 'https://youtube.com',
  },
  pendingPolicies: [
    'Track order',
    'Shipping policy',
    'Return policy',
    'Privacy policy',
    'Terms and conditions',
  ],
};
