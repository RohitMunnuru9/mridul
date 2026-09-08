/**
 * Ports the seed catalogue and site content into Supabase.
 *
 * Run with:  npm run seed
 *
 * Idempotent — everything upserts on a natural key (slug, code, bucket+path),
 * so running it twice changes nothing. That matters because a seed you are
 * afraid to re-run is a seed you stop trusting.
 *
 * It uses the service-role client, which is the correct call here: seeding
 * writes catalogue rows that no anon or authenticated role may write, and it
 * runs from a terminal, never from a request.
 *
 * Images are uploaded to Storage rather than left in the storefront's `public`
 * folder, so the database is the single source of truth for media and the
 * admin can eventually replace a file without a deploy.
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

import { adminClient, type Client } from '../packages/supabase/src/index';
import {
  categories,
  collections,
  coupons,
  products,
} from '../packages/database/src/seed-data';
import {
  heroSlides,
  homepageSections,
  journalPosts,
  moodTiles,
  occasionPanels,
  siteSettings,
  storyPanel,
  valueProps,
} from '../packages/database/src/site-content';

const HERE = dirname(fileURLToPath(import.meta.url));

// dotenv reads .env by default; the keys live in .env.local, which is the
// file git ignores. Resolved from the script rather than the cwd so this
// works no matter where it is invoked from.
loadEnv({ path: join(HERE, '..', '.env.local') });
const PUBLIC_DIR = join(HERE, '..', 'apps', 'storefront', 'public');

/** Local `/images/...` path to the bucket it belongs in. */
function bucketFor(url: string): 'products' | 'banners' | 'homepage' | 'collections' {
  if (url.includes('/products/')) return 'products';
  return 'homepage';
}

/** '/images/products/drape-1.png' -> 'products/drape-1.png' */
function storagePath(url: string): string {
  return url.replace(/^\/images\//, '');
}

const step = (message: string) => console.log(`\n▸ ${message}`);
const done = (message: string) => console.log(`  ✓ ${message}`);

/**
 * Uploads every referenced image once and returns a map from the original
 * local URL to the media row id, so later inserts can reference it.
 */
async function seedMedia(db: Client): Promise<Map<string, string>> {
  step('Media');

  // Collect every distinct image the seed data references, keeping the first
  // alt text and crop seen for each file.
  const assets = new Map<string, { alt: string; focal: string }>();
  const remember = (url: string, alt: string, focal: string) => {
    if (!assets.has(url)) assets.set(url, { alt, focal });
  };

  for (const product of products) {
    for (const image of product.images) remember(image.url, image.alt, image.focal);
  }
  for (const category of categories) {
    remember(category.heroImage.url, category.heroImage.alt, category.heroImage.focal);
  }
  for (const slide of heroSlides) {
    remember(slide.media.url, slide.media.alt, slide.media.focal);
  }
  for (const post of journalPosts) {
    remember(post.media.url, post.media.alt, post.media.focal);
  }
  remember(storyPanel.media.url, storyPanel.media.alt, storyPanel.media.focal);

  const idByUrl = new Map<string, string>();

  for (const [url, meta] of assets) {
    const bucket = bucketFor(url);
    const path = storagePath(url);

    const file = await readFile(join(PUBLIC_DIR, url.replace(/^\//, '')));
    const { error: uploadError } = await db.storage
      .from(bucket)
      .upload(path, file, {
        contentType: url.endsWith('.png') ? 'image/png' : 'image/jpeg',
        upsert: true,
      });
    if (uploadError) throw new Error(`Upload ${bucket}/${path}: ${uploadError.message}`);

    const { data, error } = await db
      .from('media')
      .upsert(
        {
          bucket,
          path,
          alt: meta.alt,
          focal: meta.focal,
          mime_type: 'image/png',
          byte_size: file.byteLength,
        },
        { onConflict: 'bucket,path' },
      )
      .select('id')
      .single();
    if (error) throw new Error(`Media ${path}: ${error.message}`);

    idByUrl.set(url, data.id);
    done(`${bucket}/${path} (${Math.round(file.byteLength / 1024)}kB)`);
  }

  return idByUrl;
}

async function seedCategories(db: Client, media: Map<string, string>) {
  step('Categories');
  const idBySlug = new Map<string, string>();

  for (const category of categories) {
    const { data, error } = await db
      .from('categories')
      .upsert(
        {
          slug: category.slug,
          name: category.name,
          tagline: category.tagline,
          intro: category.intro,
          description: category.description,
          hero_media_id: media.get(category.heroImage.url) ?? null,
          size_chart: category.sizeChart,
          size_chart_note: category.sizeChartNote,
          position: category.position,
          is_active: category.isActive,
        },
        { onConflict: 'slug' },
      )
      .select('id')
      .single();
    if (error) throw new Error(`Category ${category.slug}: ${error.message}`);

    idBySlug.set(category.slug, data.id);
    done(category.name);
  }

  return idBySlug;
}

async function seedCollections(db: Client) {
  step('Collections');
  const idBySlug = new Map<string, string>();

  for (const [index, collection] of collections.entries()) {
    const { data, error } = await db
      .from('collections')
      .upsert(
        {
          slug: collection.slug,
          name: collection.name,
          tagline: collection.tagline,
          show_in_nav: collection.showInNav,
          position: index + 1,
          is_active: true,
        },
        { onConflict: 'slug' },
      )
      .select('id')
      .single();
    if (error) throw new Error(`Collection ${collection.slug}: ${error.message}`);

    idBySlug.set(collection.slug, data.id);
    done(collection.name);
  }

  return idBySlug;
}

async function seedProducts(
  db: Client,
  media: Map<string, string>,
  categoryIds: Map<string, string>,
  collectionIds: Map<string, string>,
) {
  step('Products');

  for (const product of products) {
    const { data: row, error } = await db
      .from('products')
      .upsert(
        {
          slug: product.slug,
          name: product.name,
          subtitle: product.subtitle,
          description: product.description,
          blouse_details: product.blouseDetails ?? null,
          care: product.care,
          primary_category_id: categoryIds.get(product.categorySlug) ?? null,
          price_paise: product.pricePaise,
          compare_at_paise: product.compareAtPaise ?? null,
          badge: product.badge ?? null,
          fabric: product.fabric,
          colour_name: product.colour.name,
          colour_hex: product.colour.hex,
          swatches: product.swatches,
          occasion: product.occasion,
          technique: product.technique,
          rating_average: product.rating?.average ?? null,
          rating_count: product.rating?.count ?? 0,
          is_active: product.isActive,
          published_at: new Date(product.publishedAt).toISOString(),
        },
        { onConflict: 'slug' },
      )
      .select('id')
      .single();
    if (error) throw new Error(`Product ${product.slug}: ${error.message}`);

    const productId = row.id;

    // Replace rather than merge: image order and membership are wholly owned
    // by the seed, and a stale row left behind would show on the storefront.
    await db.from('product_images').delete().eq('product_id', productId);
    for (const [index, image] of product.images.entries()) {
      const mediaId = media.get(image.url);
      if (!mediaId) continue;
      const { error: imageError } = await db.from('product_images').insert({
        product_id: productId,
        media_id: mediaId,
        position: index,
      });
      if (imageError) throw new Error(`Image ${product.slug}#${index}: ${imageError.message}`);
    }

    await db.from('product_collections').delete().eq('product_id', productId);
    for (const slug of product.collectionSlugs) {
      const collectionId = collectionIds.get(slug);
      if (!collectionId) continue;
      await db
        .from('product_collections')
        .insert({ product_id: productId, collection_id: collectionId });
    }

    const categoryId = categoryIds.get(product.categorySlug);
    if (categoryId) {
      await db
        .from('product_categories')
        .upsert(
          { product_id: productId, category_id: categoryId },
          { onConflict: 'product_id,category_id' },
        );
    }

    for (const [index, variant] of product.variants.entries()) {
      const { data: variantRow, error: variantError } = await db
        .from('product_variants')
        .upsert(
          {
            product_id: productId,
            sku: variant.sku,
            label: variant.label,
            price_delta_paise: variant.priceDeltaPaise,
            position: index,
            is_active: true,
          },
          { onConflict: 'sku' },
        )
        .select('id')
        .single();
      if (variantError) throw new Error(`Variant ${variant.sku}: ${variantError.message}`);

      // The insert trigger creates an inventory row at zero; set the real
      // figure here rather than inserting, so a re-run does not duplicate.
      const { error: stockError } = await db
        .from('inventory')
        .update({ on_hand: variant.stock })
        .eq('variant_id', variantRow.id);
      if (stockError) throw new Error(`Stock ${variant.sku}: ${stockError.message}`);
    }

    done(`${product.name} (${product.variants.length} variants)`);
  }
}

async function seedContent(
  db: Client,
  media: Map<string, string>,
  collectionIds: Map<string, string>,
) {
  step('Site content');

  // No natural key on hero_slides — a banner is identified by nothing but
  // itself — so the set is replaced wholesale rather than upserted.
  await db.from('hero_slides').delete().neq('title', '');
  for (const slide of heroSlides) {
    const { error } = await db.from('hero_slides').insert({
      media_id: media.get(slide.media.url)!,
      eyebrow: slide.eyebrow,
      title: slide.title,
      note: slide.note,
      cta_label: slide.ctaLabel,
      cta_href: slide.ctaHref,
      position: slide.position,
      is_active: slide.isActive,
    });
    if (error) throw new Error(`Hero ${slide.title}: ${error.message}`);
  }
  done(`${heroSlides.length} hero slides`);

  for (const section of homepageSections) {
    const { error } = await db.from('homepage_sections').upsert(
      {
        key: section.key,
        name: section.name,
        description: section.description,
        position: section.position,
        is_enabled: section.isEnabled,
        collection_id: section.collectionSlug
          ? (collectionIds.get(section.collectionSlug) ?? null)
          : null,
      },
      { onConflict: 'key' },
    );
    if (error) throw new Error(`Section ${section.key}: ${error.message}`);
  }
  done(`${homepageSections.length} homepage sections`);

  await db.from('mood_tiles').delete().neq('label', '');
  for (const tile of moodTiles) {
    const { error } = await db.from('mood_tiles').insert({
      label: tile.label,
      note: tile.note,
      href: tile.href,
      icon: tile.icon,
      tone: tile.tone,
      position: tile.position,
      is_active: true,
    });
    if (error) throw new Error(`Tile ${tile.label}: ${error.message}`);
  }
  done(`${moodTiles.length} mood tiles`);

  await db.from('occasion_panels').delete().neq('title', '');
  for (const panel of occasionPanels) {
    const { error } = await db.from('occasion_panels').insert({
      tone: panel.tone,
      eyebrow: panel.eyebrow,
      title: panel.title,
      body: panel.body ?? null,
      cta_label: panel.ctaLabel,
      cta_href: panel.ctaHref,
      position: panel.position,
      is_active: true,
    });
    if (error) throw new Error(`Panel ${panel.title}: ${error.message}`);
  }
  done(`${occasionPanels.length} curated edits`);

  await db.from('value_props').delete().neq('title', '');
  for (const value of valueProps) {
    const { error } = await db.from('value_props').insert({
      icon: value.icon,
      title: value.title,
      note: value.note,
      position: value.position,
      is_active: true,
    });
    if (error) throw new Error(`Value ${value.title}: ${error.message}`);
  }
  done(`${valueProps.length} value props`);

  for (const post of journalPosts) {
    const { error } = await db.from('journal_posts').upsert(
      {
        slug: post.id.replace(/^post_/, ''),
        title: post.title,
        excerpt: post.excerpt,
        media_id: media.get(post.media.url) ?? null,
        href: post.href,
        position: post.position,
        is_published: post.isPublished,
        published_at: new Date().toISOString(),
      },
      { onConflict: 'slug' },
    );
    if (error) throw new Error(`Journal ${post.title}: ${error.message}`);
  }
  done(`${journalPosts.length} journal posts`);

  const { error: storyError } = await db.from('story_panel').upsert({
    id: true,
    eyebrow: storyPanel.eyebrow,
    title: storyPanel.title,
    body: storyPanel.body,
    media_id: media.get(storyPanel.media.url) ?? null,
    stats: storyPanel.stats,
    cta_label: storyPanel.ctaLabel,
    cta_href: storyPanel.ctaHref,
  });
  if (storyError) throw new Error(`Story panel: ${storyError.message}`);
  done('story panel');

  const { error: settingsError } = await db.from('settings').upsert({
    id: true,
    brand_name: siteSettings.brandName,
    tagline: siteSettings.tagline,
    announcements: siteSettings.announcements,
    quotes: siteSettings.quotes,
    free_shipping_threshold_paise: siteSettings.freeShippingThresholdPaise,
    flat_shipping_paise: siteSettings.flatShippingPaise,
    return_window_days: siteSettings.returnWindowDays,
    whatsapp_number: siteSettings.contact.whatsapp,
    contact_email: siteSettings.contact.email,
    instagram_url: siteSettings.contact.instagram,
    youtube_url: siteSettings.contact.youtube,
    pending_policies: siteSettings.pendingPolicies,
  });
  if (settingsError) throw new Error(`Settings: ${settingsError.message}`);
  done('site settings');
}

/**
 * Editorial prose that used to be written into components. Keyed by a stable
 * slug the components look up, so rewording is an edit rather than a deploy.
 */
const CONTENT_BLOCKS = [
  {
    key: 'header_strapline',
    placement: 'header',
    title: 'Announcement bar strapline',
    body: 'Wear a story. Not just clothing.',
  },
  {
    key: 'footer_brand_line',
    placement: 'footer',
    title: 'Footer brand line',
    body: 'Timeless weaves. Thoughtful choices. Made for your life.',
  },
  {
    key: 'footer_quote',
    placement: 'footer',
    title: 'Footer pull quote',
    body: '“Beautiful things take time—and become part of yours.”',
  },
  {
    key: 'pdp_shipping_returns',
    placement: 'product',
    title: 'Shipping and returns',
    body:
      'Dispatched within two working days. Delivery charge is calculated from ' +
      'your pincode at checkout, and the tracking link reaches you on WhatsApp ' +
      'once the parcel is picked up. Returns accepted within seven days of ' +
      'delivery on unworn pieces with tags intact.',
  },
  {
    key: 'pdp_why_it_costs',
    placement: 'product',
    title: 'Why it costs what it costs',
    body:
      'Small runs on a handloom cost more per metre than a mill does, and we ' +
      'would rather pay that than shorten the weave. What you are paying for is ' +
      'the yarn, the weaver’s time, and a piece that stays in your wardrobe ' +
      'long enough to justify both.',
  },
];

async function seedContentBlocks(db: Client) {
  step('Editorial blocks');
  for (const block of CONTENT_BLOCKS) {
    const { error } = await db
      .from('content_blocks')
      .upsert({ ...block, is_active: true }, { onConflict: 'key' });
    if (error) throw new Error(`Block ${block.key}: ${error.message}`);
    done(block.key);
  }
}

async function seedCoupons(db: Client) {
  step('Coupons');
  for (const coupon of coupons) {
    const { error } = await db.from('coupons').upsert(
      {
        code: coupon.code,
        description: coupon.description,
        percent_off: coupon.percentOff ?? null,
        amount_off_paise: coupon.amountOffPaise ?? null,
        min_subtotal_paise: coupon.minSubtotalPaise,
        is_active: coupon.isActive,
      },
      { onConflict: 'code' },
    );
    if (error) throw new Error(`Coupon ${coupon.code}: ${error.message}`);
    done(coupon.code);
  }
}

async function main() {
  const db = adminClient();

  console.log('Seeding Supabase from the local seed data…');

  const media = await seedMedia(db);
  const categoryIds = await seedCategories(db, media);
  const collectionIds = await seedCollections(db);
  await seedProducts(db, media, categoryIds, collectionIds);
  await seedContent(db, media, collectionIds);
  await seedContentBlocks(db);
  await seedCoupons(db);

  console.log('\nDone.');
}

main().catch((error) => {
  console.error('\nSeed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
