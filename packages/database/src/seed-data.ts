/**
 * Seed catalogue.
 *
 * This module stands in for the `categories` / `collections` / `products`
 * tables until Supabase is wired up. Nothing outside `repository.ts` should
 * import it — components read through the repository so the swap to real
 * queries touches one file.
 *
 * Image URLs point at the placeholder art in `/public`. When media moves to
 * Supabase Storage these become bucket URLs and `focal` collapses to the
 * default centre crop.
 */

import type {
  Category,
  Collection,
  Coupon,
  Product,
  ProductImage,
} from '@mridul/types';

/** One file per drape, the way Supabase Storage will hold them. */
const DRAPE = [
  '/images/products/drape-1.png',
  '/images/products/drape-2.png',
  '/images/products/drape-3.png',
  '/images/products/drape-4.png',
];
const CENTRE = '50% center';
const PORTRAIT = '/images/saree-homepage-hero.png';
const LOOM = '/images/artisan-loom-story.png';

function img(
  id: string,
  url: string,
  focal: string,
  alt: string,
  position: number,
): ProductImage {
  return { id, url, focal, alt, position };
}

export const categories: Category[] = [
  {
    id: 'cat_sarees',
    slug: 'sarees',
    name: 'Sarees',
    tagline: 'Weaves for every kind of day',
    intro:
      'Handloom, silk and everyday cotton drapes, woven in small runs with the weavers we have worked with for years.',
    description:
      'Every Mridul saree begins on a loom rather than a spreadsheet. We buy in small runs, which keeps the weaving unhurried and the colour true, and it means a drape you love may not return in the same shade twice. Expect mul cotton and kota for the warm months, linen and tussar through the middle of the year, and Banarasi and Kanjivaram silk when the calendar turns to weddings. Each listing tells you the fabric, the weave and whether a blouse piece is included, so nothing about the drape is a surprise when it reaches you.',
    heroImage: img(
      'cat_sarees_hero',
      PORTRAIT,
      '66% center',
      'A woman in an ivory botanical saree beside a heritage window',
      0,
    ),
    // A drape is not cut to a size, so there is nothing to chart.
    sizeChart: [],
    sizeChartNote: '',
    position: 1,
    isActive: true,
  },
  {
    id: 'cat_blouses',
    slug: 'blouses',
    name: 'Blouses',
    tagline: 'The half that finishes the drape',
    intro:
      'Ready-to-wear blouses cut to sit well on their own, in fabrics chosen to work across the sarees you already own.',
    description:
      'A blouse decides how a saree reads, so we treat it as a garment in its own right rather than an afterthought stitched from a leftover strip. These are cut on standard sizes and finished with a side zip or dori ties, in fabrics that hold their shape through a long evening. The neutrals are drafted to sit quietly under a busy weave; the embroidered and zari pieces are meant to carry a plain drape on their own. Every listing states the lining and the closure, and most pieces leave a small seam allowance for a local alteration.',
    heroImage: img(
      'cat_blouses_hero',
      LOOM,
      '58% center',
      'Artisan hands working rose and moss threads on a handloom',
      0,
    ),
    // Garment measurements in inches, not body measurements.
    sizeChart: [
      { size: 'XS', bust: '32', waist: '26', shoulder: '13' },
      { size: 'S', bust: '34', waist: '28', shoulder: '13.5' },
      { size: 'M', bust: '36', waist: '30', shoulder: '14' },
      { size: 'L', bust: '38', waist: '32', shoulder: '14.5' },
      { size: 'XL', bust: '40', waist: '34', shoulder: '15' },
      { size: 'XXL', bust: '42', waist: '36', shoulder: '15.5' },
    ],
    sizeChartNote:
      'Measurements are of the garment, not the body. Every piece leaves a small seam allowance if you want a local alteration.',
    position: 2,
    isActive: true,
  },
];

export const collections: Collection[] = [
  {
    id: 'col_new',
    slug: 'new-arrivals',
    name: 'New Arrivals',
    tagline: 'Fresh from the loom',
  },
  {
    id: 'col_best',
    slug: 'best-sellers',
    name: 'Best Sellers',
    tagline: 'Loved on repeat',
  },
  {
    id: 'col_festive',
    slug: 'festive',
    name: 'Festive Collection',
    tagline: 'For the bright days',
  },
  {
    id: 'col_wedding',
    slug: 'wedding',
    name: 'Wedding Collection',
    tagline: 'For the grand ones',
  },
  {
    id: 'col_everyday',
    slug: 'everyday',
    name: 'Everyday Edit',
    tagline: 'Easy, all week',
  },
];

/** Standard saree variant axis: the drape alone, or with its blouse piece. */
function sareeVariants(sku: string, stock: number, withPieceStock: number) {
  return [
    {
      id: `${sku}-only`,
      sku: `${sku}-SO`,
      label: 'Saree only',
      priceDeltaPaise: 0,
      stock,
    },
    {
      id: `${sku}-piece`,
      sku: `${sku}-BP`,
      label: 'With unstitched blouse piece',
      priceDeltaPaise: 45000,
      stock: withPieceStock,
    },
  ];
}

/** Standard blouse variant axis: stocked sizes. */
function blouseSizes(sku: string, stock: number[]) {
  return ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((size, index) => ({
    id: `${sku}-${size.toLowerCase()}`,
    sku: `${sku}-${size}`,
    label: size,
    priceDeltaPaise: size === 'XXL' ? 15000 : 0,
    stock: stock[index] ?? 0,
  }));
}

const SAREE_CARE = [
  'Dry clean recommended for the first wash.',
  'Hand wash separately in cold water thereafter.',
  'Dry in shade; direct sun dulls natural dyes.',
  'Press on medium heat with a cotton cloth over the zari.',
];

const BLOUSE_CARE = [
  'Hand wash separately in cold water.',
  'Do not bleach or wring.',
  'Dry flat in shade to hold the shape.',
  'Warm iron on the reverse, avoiding embroidery.',
];

export const products: Product[] = [
  {
    id: 'prd_saanjh_sage',
    slug: 'saanjh-sage-saree',
    name: 'Saanjh Sage',
    subtitle: 'Saree with blouse piece',
    categorySlug: 'sarees',
    collectionSlugs: ['new-arrivals', 'everyday'],
    pricePaise: 465000,
    badge: 'new',
    fabric: 'Linen silk',
    colour: { name: 'Sage', hex: '#9ca081' },
    swatches: ['#9ca081', '#caa58e', '#e8dfd1'],
    occasion: 'Everyday',
    technique: 'Handloom',
    images: [
      img('prd_saanjh_1', DRAPE[0], CENTRE, 'Saanjh Sage saree draped in full length', 0),
      img('prd_saanjh_2', PORTRAIT, '40% center', 'Saanjh Sage saree pallu detail', 1),
      img('prd_saanjh_3', LOOM, '30% center', 'The sage weave on the loom', 2),
    ],
    variants: sareeVariants('SAANJH', 14, 9),
    description:
      'A quiet sage drape in handwoven linen silk, with a slub that catches light along the pallu. Light enough for a long working day, structured enough to hold a clean pleat.',
    care: SAREE_CARE,
    blouseDetails:
      'Comes with a 0.8m unstitched blouse piece in matching linen silk.',
    rating: { average: 4.7, count: 132 },
    isActive: true,
    publishedAt: '2026-08-28',
  },
  {
    id: 'prd_raatri_ink',
    slug: 'raatri-ink-saree',
    name: 'Raatri Ink',
    subtitle: 'Saree',
    categorySlug: 'sarees',
    collectionSlugs: ['new-arrivals', 'everyday'],
    pricePaise: 520000,
    fabric: 'Cotton silk',
    colour: { name: 'Ink', hex: '#1f302a' },
    swatches: ['#1f302a', '#6e4b42', '#b9aa92'],
    occasion: 'Work',
    technique: 'Handloom',
    images: [
      img('prd_raatri_1', DRAPE[1], CENTRE, 'Raatri Ink saree in deep green black', 0),
      img('prd_raatri_2', LOOM, '52% center', 'Ink cotton silk yarn on the loom', 1),
    ],
    variants: sareeVariants('RAATRI', 11, 6),
    description:
      'Deep ink green that reads almost black indoors and opens up in daylight. Cotton silk gives it body without weight, so it pleats sharply and travels well.',
    care: SAREE_CARE,
    blouseDetails: 'Sold as the drape alone. Pair it with the Saada Scoop blouse.',
    rating: { average: 4.6, count: 88 },
    isActive: true,
    publishedAt: '2026-07-14',
  },
  {
    id: 'prd_gulab_mist',
    slug: 'gulab-mist-saree',
    name: 'Gulab Mist',
    subtitle: 'Saree with blouse piece',
    categorySlug: 'sarees',
    collectionSlugs: ['best-sellers', 'festive'],
    pricePaise: 435000,
    compareAtPaise: 485000,
    badge: 'bestseller',
    fabric: 'Organza',
    colour: { name: 'Rose', hex: '#b77f78' },
    swatches: ['#b77f78', '#dcc4bc', '#8a4d58'],
    occasion: 'Festive',
    technique: 'Embroidery',
    images: [
      img('prd_gulab_1', DRAPE[2], CENTRE, 'Gulab Mist organza saree with rose embroidery', 0),
      img('prd_gulab_2', PORTRAIT, '75% center', 'Rose embroidery along the organza border', 1),
    ],
    variants: sareeVariants('GULAB', 7, 12),
    description:
      'Featherlight organza carrying a scatter of hand-embroidered roses that thin out towards the pleats. It holds its shape all evening and folds back to almost nothing.',
    care: SAREE_CARE,
    blouseDetails:
      'Comes with a 0.8m unstitched blouse piece in dusty rose satin.',
    rating: { average: 4.9, count: 341 },
    isActive: true,
    publishedAt: '2026-06-02',
  },
  {
    id: 'prd_noor_ivory',
    slug: 'noor-ivory-saree',
    name: 'Noor Ivory',
    subtitle: 'Saree with blouse piece',
    categorySlug: 'sarees',
    collectionSlugs: ['wedding', 'festive'],
    pricePaise: 585000,
    fabric: 'Chanderi tissue',
    colour: { name: 'Ivory', hex: '#e8dfd1' },
    swatches: ['#e8dfd1', '#b79c68', '#c49a92'],
    occasion: 'Wedding',
    technique: 'Zari weave',
    images: [
      img('prd_noor_1', DRAPE[3], CENTRE, 'Noor Ivory chanderi tissue saree with gold zari', 0),
      img('prd_noor_2', PORTRAIT, '66% center', 'Ivory chanderi drape by a heritage window', 1),
      img('prd_noor_3', LOOM, '70% center', 'Gold zari being woven into the border', 2),
    ],
    variants: sareeVariants('NOOR', 5, 8),
    description:
      'The house ivory, in chanderi tissue with a fine gold zari running the length of the border. Made for the ceremonies where you want light rather than colour.',
    care: SAREE_CARE,
    blouseDetails: 'Comes with a 0.8m unstitched blouse piece in gold tissue.',
    rating: { average: 4.8, count: 205 },
    isActive: true,
    publishedAt: '2026-05-19',
  },
  {
    id: 'prd_mitti_clay',
    slug: 'mitti-clay-saree',
    name: 'Mitti Clay',
    subtitle: 'Saree',
    categorySlug: 'sarees',
    collectionSlugs: ['new-arrivals', 'everyday'],
    pricePaise: 289000,
    fabric: 'Mul cotton',
    colour: { name: 'Clay', hex: '#b08268' },
    swatches: ['#b08268', '#e3cdbd', '#7a5240'],
    occasion: 'Everyday',
    technique: 'Block print',
    images: [
      img('prd_mitti_1', DRAPE[0], CENTRE, 'Mitti Clay block printed mul cotton saree', 0),
      img('prd_mitti_2', LOOM, '25% center', 'Clay dye on cotton yarn', 1),
    ],
    variants: sareeVariants('MITTI', 22, 15),
    description:
      'Soft mul cotton block printed in a small repeating motif, in the warm clay we keep coming back to. The lightest drape we make, and the easiest to wash.',
    care: SAREE_CARE,
    rating: { average: 4.5, count: 156 },
    isActive: true,
    publishedAt: '2026-08-11',
  },
  {
    id: 'prd_neelam_dusk',
    slug: 'neelam-dusk-saree',
    name: 'Neelam Dusk',
    subtitle: 'Saree with blouse piece',
    categorySlug: 'sarees',
    collectionSlugs: ['best-sellers', 'festive'],
    pricePaise: 612000,
    badge: 'bestseller',
    fabric: 'Tussar silk',
    colour: { name: 'Indigo', hex: '#3c4a72' },
    swatches: ['#3c4a72', '#8f9bc0', '#c9b48a'],
    occasion: 'Festive',
    technique: 'Handloom',
    images: [
      img('prd_neelam_1', DRAPE[1], CENTRE, 'Neelam Dusk indigo tussar silk saree', 0),
      img('prd_neelam_2', PORTRAIT, '30% center', 'Indigo tussar pallu in evening light', 1),
    ],
    variants: sareeVariants('NEELAM', 9, 13),
    description:
      'Indigo tussar with the faint gold cast that only raw silk gives. The texture is deliberately uneven, which is what makes the colour move as you do.',
    care: SAREE_CARE,
    blouseDetails: 'Comes with a 0.8m unstitched blouse piece in raw tussar.',
    rating: { average: 4.8, count: 412 },
    isActive: true,
    publishedAt: '2026-04-30',
  },
  {
    id: 'prd_haldi_bloom',
    slug: 'haldi-bloom-saree',
    name: 'Haldi Bloom',
    subtitle: 'Saree',
    categorySlug: 'sarees',
    collectionSlugs: ['festive'],
    pricePaise: 318000,
    compareAtPaise: 398000,
    fabric: 'Kota doria',
    colour: { name: 'Turmeric', hex: '#d0a13f' },
    swatches: ['#d0a13f', '#f0dfae', '#9a6b28'],
    occasion: 'Celebration',
    technique: 'Handpainted',
    images: [
      img('prd_haldi_1', DRAPE[2], CENTRE, 'Haldi Bloom turmeric kota doria saree', 0),
      img('prd_haldi_2', LOOM, '45% center', 'Turmeric dye drying in the shade', 1),
    ],
    variants: sareeVariants('HALDI', 0, 6),
    description:
      'Turmeric kota doria with hand-painted blooms placed along the pallu and one shoulder. The open weave keeps it cool through a full day of ceremony.',
    care: SAREE_CARE,
    rating: { average: 4.4, count: 74 },
    isActive: true,
    publishedAt: '2026-03-22',
  },
  {
    id: 'prd_champa_cream',
    slug: 'champa-cream-saree',
    name: 'Champa Cream',
    subtitle: 'Saree with blouse piece',
    categorySlug: 'sarees',
    collectionSlugs: ['new-arrivals', 'everyday'],
    pricePaise: 352000,
    badge: 'new',
    fabric: 'Mul cotton',
    colour: { name: 'Cream', hex: '#efe3cd' },
    swatches: ['#efe3cd', '#c8b391', '#8d7f66'],
    occasion: 'Everyday',
    technique: 'Block print',
    images: [
      img('prd_champa_1', DRAPE[3], CENTRE, 'Champa Cream block printed mul cotton saree', 0),
      img('prd_champa_2', PORTRAIT, '20% center', 'Cream mul cotton drape in daylight', 1),
    ],
    variants: sareeVariants('CHAMPA', 18, 18),
    description:
      'Cream mul cotton with a champa vine block printed in a slightly deeper shade, so the pattern shows up close and reads as plain from across a room.',
    care: SAREE_CARE,
    blouseDetails: 'Comes with a 0.8m unstitched blouse piece in undyed cotton.',
    rating: { average: 4.6, count: 61 },
    isActive: true,
    publishedAt: '2026-09-01',
  },
  {
    id: 'prd_kesar_ember',
    slug: 'kesar-ember-saree',
    name: 'Kesar Ember',
    subtitle: 'Saree with blouse piece',
    categorySlug: 'sarees',
    collectionSlugs: ['wedding', 'festive'],
    pricePaise: 1240000,
    badge: 'limited',
    fabric: 'Banarasi silk',
    colour: { name: 'Saffron', hex: '#c2622e' },
    swatches: ['#c2622e', '#e5a15c', '#7c3b1c'],
    occasion: 'Wedding',
    technique: 'Zari weave',
    images: [
      img('prd_kesar_1', DRAPE[0], CENTRE, 'Kesar Ember saffron Banarasi silk saree', 0),
      img('prd_kesar_2', LOOM, '62% center', 'Zari brocade on the Banarasi loom', 1),
      img('prd_kesar_3', PORTRAIT, '80% center', 'Saffron Banarasi pallu detail', 2),
    ],
    variants: sareeVariants('KESAR', 3, 4),
    description:
      'A saffron Banarasi with a full zari brocade pallu, woven over roughly six weeks on a single loom. We take twelve of these a year, which is as many as the weave allows.',
    care: SAREE_CARE,
    blouseDetails:
      'Comes with a 0.8m unstitched blouse piece in matching brocade.',
    rating: { average: 5, count: 29 },
    isActive: true,
    publishedAt: '2026-02-08',
  },
  {
    id: 'prd_baadal_grey',
    slug: 'baadal-grey-saree',
    name: 'Baadal Grey',
    subtitle: 'Saree',
    categorySlug: 'sarees',
    collectionSlugs: ['new-arrivals', 'everyday'],
    pricePaise: 398000,
    fabric: 'Linen',
    colour: { name: 'Grey', hex: '#8d8f92' },
    swatches: ['#8d8f92', '#cfd1d3', '#5b5d61'],
    occasion: 'Work',
    technique: 'Handloom',
    images: [
      img('prd_baadal_1', DRAPE[1], CENTRE, 'Baadal Grey handloom linen saree', 0),
      img('prd_baadal_2', LOOM, '15% center', 'Grey linen yarn on the loom', 1),
    ],
    variants: sareeVariants('BAADAL', 16, 10),
    description:
      'Pure linen in an overcast grey, woven a little denser than our summer drapes so it holds a crisp pleat straight out of the fold.',
    care: SAREE_CARE,
    rating: { average: 4.5, count: 97 },
    isActive: true,
    publishedAt: '2026-07-03',
  },
  {
    id: 'prd_amrit_olive',
    slug: 'amrit-olive-saree',
    name: 'Amrit Olive',
    subtitle: 'Saree with blouse piece',
    categorySlug: 'sarees',
    collectionSlugs: ['everyday', 'best-sellers'],
    pricePaise: 336000,
    compareAtPaise: 420000,
    fabric: 'Handloom cotton',
    colour: { name: 'Olive', hex: '#6f7448' },
    swatches: ['#6f7448', '#b9bd93', '#464a2b'],
    occasion: 'Everyday',
    technique: 'Handloom',
    images: [
      img('prd_amrit_1', DRAPE[2], CENTRE, 'Amrit Olive handloom cotton saree', 0),
      img('prd_amrit_2', PORTRAIT, '10% center', 'Olive cotton drape with a plain border', 1),
    ],
    variants: sareeVariants('AMRIT', 12, 12),
    description:
      'Deep olive handloom cotton with a narrow undyed border. One of the few colours that sits well against almost any blouse in the wardrobe.',
    care: SAREE_CARE,
    blouseDetails: 'Comes with a 0.8m unstitched blouse piece in undyed cotton.',
    rating: { average: 4.7, count: 188 },
    isActive: true,
    publishedAt: '2026-06-25',
  },
  {
    id: 'prd_surma_night',
    slug: 'surma-night-saree',
    name: 'Surma Night',
    subtitle: 'Saree with blouse piece',
    categorySlug: 'sarees',
    collectionSlugs: ['best-sellers', 'wedding'],
    pricePaise: 1480000,
    badge: 'bestseller',
    fabric: 'Kanjivaram silk',
    colour: { name: 'Black', hex: '#25211f' },
    swatches: ['#25211f', '#b79c68', '#7d2a3a'],
    occasion: 'Wedding',
    technique: 'Zari weave',
    images: [
      img('prd_surma_1', DRAPE[3], CENTRE, 'Surma Night black Kanjivaram silk saree', 0),
      img('prd_surma_2', LOOM, '85% center', 'Gold zari against black Kanjivaram silk', 1),
    ],
    variants: sareeVariants('SURMA', 4, 7),
    description:
      'Black Kanjivaram with a contrast gold border and a temple motif repeating through the pallu. Heavy in the way this weave should be, and it will outlast most of what you own.',
    care: SAREE_CARE,
    blouseDetails:
      'Comes with a 0.8m unstitched blouse piece in contrast gold silk.',
    rating: { average: 4.9, count: 267 },
    isActive: true,
    publishedAt: '2026-01-16',
  },
  {
    id: 'prd_tara_wrap',
    slug: 'tara-wrap-blouse',
    name: 'Tara Wrap Blouse',
    subtitle: 'Ready-to-wear blouse',
    categorySlug: 'blouses',
    collectionSlugs: ['new-arrivals', 'everyday'],
    pricePaise: 189000,
    badge: 'new',
    fabric: 'Cotton',
    colour: { name: 'Ivory', hex: '#efe6da' },
    swatches: ['#efe6da', '#d8c4ab', '#a08d76'],
    occasion: 'Everyday',
    technique: 'Handloom',
    images: [
      img('prd_tara_1', DRAPE[0], CENTRE, 'Tara ivory cotton wrap blouse', 0),
      img('prd_tara_2', LOOM, '35% center', 'Ivory cotton being finished by hand', 1),
    ],
    variants: blouseSizes('TARA', [6, 12, 14, 11, 7, 3]),
    description:
      'A wrap blouse in handloom cotton that ties at the side rather than hooking at the back, so it sits well across a range of shapes without alteration.',
    care: BLOUSE_CARE,
    rating: { average: 4.6, count: 54 },
    isActive: true,
    publishedAt: '2026-09-03',
  },
  {
    id: 'prd_jaal_embroidered',
    slug: 'jaal-embroidered-blouse',
    name: 'Jaal Embroidered Blouse',
    subtitle: 'Ready-to-wear blouse',
    categorySlug: 'blouses',
    collectionSlugs: ['best-sellers', 'festive'],
    pricePaise: 298000,
    badge: 'bestseller',
    fabric: 'Raw silk',
    colour: { name: 'Berry', hex: '#8a4d58' },
    swatches: ['#8a4d58', '#c58f95', '#5a2b34'],
    occasion: 'Festive',
    technique: 'Embroidery',
    images: [
      img('prd_jaal_1', DRAPE[1], CENTRE, 'Jaal berry raw silk embroidered blouse', 0),
      img('prd_jaal_2', PORTRAIT, '48% center', 'Jaal embroidery across the shoulder', 1),
    ],
    variants: blouseSizes('JAAL', [4, 9, 13, 10, 5, 2]),
    description:
      'Raw silk carrying an all-over jaal in tonal thread, dense at the shoulder and thinning towards the waist. Built to carry a plain drape on its own.',
    care: BLOUSE_CARE,
    rating: { average: 4.8, count: 176 },
    isActive: true,
    publishedAt: '2026-05-07',
  },
  {
    id: 'prd_peepal_back',
    slug: 'peepal-back-blouse',
    name: 'Peepal Back Blouse',
    subtitle: 'Ready-to-wear blouse',
    categorySlug: 'blouses',
    collectionSlugs: ['new-arrivals', 'everyday'],
    pricePaise: 224000,
    fabric: 'Cotton silk',
    colour: { name: 'Moss', hex: '#6b7358' },
    swatches: ['#6b7358', '#a8b092', '#43492f'],
    occasion: 'Work',
    technique: 'Handloom',
    images: [
      img(
        'prd_peepal_1',
        DRAPE[2],
        CENTRE,
        'Peepal moss cotton silk blouse with a leaf-shaped back',
        0,
      ),
    ],
    variants: blouseSizes('PEEPAL', [5, 10, 12, 9, 6, 4]),
    description:
      'Cotton silk with a peepal-leaf cutout at the back, closed with a single covered button at the nape. Quiet from the front, and the reason you will not want a dupatta.',
    care: BLOUSE_CARE,
    rating: { average: 4.5, count: 82 },
    isActive: true,
    publishedAt: '2026-06-18',
  },
  {
    id: 'prd_dori_tie',
    slug: 'dori-tie-blouse',
    name: 'Dori Tie Blouse',
    subtitle: 'Ready-to-wear blouse',
    categorySlug: 'blouses',
    collectionSlugs: ['everyday'],
    pricePaise: 168000,
    compareAtPaise: 210000,
    fabric: 'Mul cotton',
    colour: { name: 'Rose', hex: '#c99a95' },
    swatches: ['#c99a95', '#ecd3cf', '#96625d'],
    occasion: 'Everyday',
    technique: 'Block print',
    images: [
      img('prd_dori_1', DRAPE[3], CENTRE, 'Dori rose mul cotton blouse with tie back', 0),
      img('prd_dori_2', LOOM, '55% center', 'Rose dori ties finished by hand', 1),
    ],
    variants: blouseSizes('DORI', [8, 14, 16, 12, 8, 5]),
    description:
      'The lightest blouse we make, in mul cotton with two dori ties at the back. Adjustable through the ties, which is why it survives a change of size.',
    care: BLOUSE_CARE,
    rating: { average: 4.4, count: 121 },
    isActive: true,
    publishedAt: '2026-04-12',
  },
  {
    id: 'prd_kalam_print',
    slug: 'kalam-print-blouse',
    name: 'Kalam Print Blouse',
    subtitle: 'Ready-to-wear blouse',
    categorySlug: 'blouses',
    collectionSlugs: ['everyday', 'festive'],
    pricePaise: 205000,
    fabric: 'Cotton',
    colour: { name: 'Clay', hex: '#b08268' },
    swatches: ['#b08268', '#e0c5b0', '#75503c'],
    occasion: 'Celebration',
    technique: 'Handpainted',
    images: [
      img(
        'prd_kalam_1',
        DRAPE[0],
        CENTRE,
        'Kalam clay cotton blouse with hand-painted motifs',
        0,
      ),
    ],
    variants: blouseSizes('KALAM', [3, 8, 11, 8, 4, 0]),
    description:
      'Cotton hand-painted in the kalamkari way, one panel at a time, so no two sleeves carry quite the same line. Pairs best with the plainest drape you own.',
    care: BLOUSE_CARE,
    rating: { average: 4.6, count: 66 },
    isActive: true,
    publishedAt: '2026-03-30',
  },
  {
    id: 'prd_zari_edge',
    slug: 'zari-edge-blouse',
    name: 'Zari Edge Blouse',
    subtitle: 'Ready-to-wear blouse',
    categorySlug: 'blouses',
    collectionSlugs: ['wedding', 'festive'],
    pricePaise: 385000,
    badge: 'limited',
    fabric: 'Brocade',
    colour: { name: 'Gold', hex: '#b79c68' },
    swatches: ['#b79c68', '#e2cf9f', '#7c6534'],
    occasion: 'Wedding',
    technique: 'Zari weave',
    images: [
      img('prd_zari_1', DRAPE[1], CENTRE, 'Zari Edge gold brocade blouse', 0),
      img('prd_zari_2', LOOM, '75% center', 'Gold zari brocade close up', 1),
    ],
    variants: blouseSizes('ZARI', [2, 5, 7, 6, 3, 1]),
    description:
      'Gold brocade cut close, with a zari-bound neckline and armhole. Made in the same runs as our Banarasi drapes, so the metal matches exactly.',
    care: BLOUSE_CARE,
    rating: { average: 4.9, count: 43 },
    isActive: true,
    publishedAt: '2026-02-20',
  },
  {
    id: 'prd_saada_scoop',
    slug: 'saada-scoop-blouse',
    name: 'Saada Scoop Blouse',
    subtitle: 'Ready-to-wear blouse',
    categorySlug: 'blouses',
    collectionSlugs: ['new-arrivals', 'everyday', 'best-sellers'],
    pricePaise: 175000,
    fabric: 'Linen',
    colour: { name: 'Grey', hex: '#8d8f92' },
    swatches: ['#8d8f92', '#c5c7c9', '#5f6165'],
    occasion: 'Work',
    technique: 'Handloom',
    images: [
      img('prd_saada_1', DRAPE[2], CENTRE, 'Saada grey linen scoop neck blouse', 0),
    ],
    variants: blouseSizes('SAADA', [7, 13, 15, 12, 9, 6]),
    description:
      'A plain linen blouse with a deep scoop and a side zip. This is the one we suggest first, because it disappears under a busy weave and lasts through the wash.',
    care: BLOUSE_CARE,
    rating: { average: 4.7, count: 214 },
    isActive: true,
    publishedAt: '2026-07-22',
  },
  {
    id: 'prd_rang_colourblock',
    slug: 'rang-colourblock-blouse',
    name: 'Rang Colourblock Blouse',
    subtitle: 'Ready-to-wear blouse',
    categorySlug: 'blouses',
    collectionSlugs: ['best-sellers', 'festive'],
    pricePaise: 242000,
    compareAtPaise: 290000,
    badge: 'bestseller',
    fabric: 'Cotton silk',
    colour: { name: 'Indigo', hex: '#3c4a72' },
    swatches: ['#3c4a72', '#c2622e', '#e8dfd1'],
    occasion: 'Festive',
    technique: 'Handloom',
    images: [
      img('prd_rang_1', DRAPE[3], CENTRE, 'Rang indigo and saffron colourblock blouse', 0),
      img('prd_rang_2', PORTRAIT, '55% center', 'Colourblock sleeve detail', 1),
    ],
    variants: blouseSizes('RANG', [5, 11, 14, 10, 6, 3]),
    description:
      'Indigo cotton silk with a saffron sleeve and an ivory bound neck. Three of our house colours on one blouse, which is why it works with so many drapes.',
    care: BLOUSE_CARE,
    rating: { average: 4.8, count: 159 },
    isActive: true,
    publishedAt: '2026-05-28',
  },
];

/**
 * Seed coupons, standing in for the `coupons` table.
 *
 * Codes are validated on the server only. The browser may show a discount it
 * believes applies, but the amount charged is always recomputed from these
 * rows at checkout.
 */
export const coupons: Coupon[] = [
  {
    code: 'FIRSTDRAPE',
    description: '10% off your first order',
    percentOff: 10,
    minSubtotalPaise: 250000,
    isActive: true,
  },
  {
    code: 'FESTIVE500',
    description: 'Flat ₹500 off orders above ₹5,000',
    amountOffPaise: 50000,
    minSubtotalPaise: 500000,
    isActive: true,
  },
  {
    code: 'LOOM15',
    description: '15% off handloom orders above ₹8,000',
    percentOff: 15,
    minSubtotalPaise: 800000,
    isActive: true,
  },
];
