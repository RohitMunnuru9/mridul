/**
 * Homepage merchandising.
 *
 * These are curated entry points into the catalogue, not a second taxonomy.
 * Each tile is a category plus a filter, so it resolves to a real listing URL
 * that the customer can then widen or narrow. This is the content the
 * `homepage_sections` table will own once the admin panel exists, which is why
 * the icon is stored as a key rather than an imported component.
 */

export type MoodTile = {
  id: string;
  label: string;
  note: string;
  /** Resolves against the live listing filters, so a tile can never dead-end. */
  href: string;
  /** Looked up against the icon map in the rail component. */
  icon: 'waves' | 'sparkles' | 'scissors' | 'gem' | 'flower' | 'gift';
  tone: string;
  position: number;
};

export const moodTiles: MoodTile[] = [
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
    href: '/shop/sarees?collection=wedding',
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
