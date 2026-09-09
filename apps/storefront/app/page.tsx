/**
 * Homepage.
 *
 * The order of the blocks and whether each one appears is read from
 * `homepage_sections`, not written here. Switching a section off or moving it
 * is a data change an admin makes, which is the whole point of the content
 * layer — nobody should need a deploy to reorder the homepage.
 */

import { CategoryRail } from './components/category-rail';
import { CampaignHero as Hero } from './components/campaign-hero';
import { JournalSection } from './components/journal-section';
import { ModelContextTools } from './components/model-context-tools';
import { OccasionEdit } from './components/occasion-edit';
import { ProductShowcase } from './components/product-showcase';
import { StorySection } from './components/story-section';
import {
  getCategories,
  getCollectionBySlug,
  getHomepageSections,
  getJournalPosts,
  getOccasionPanels,
  getProductsByCollection,
  getStoryPanel,
  getValueProps,
} from '@mridul/database';

export default async function Home() {
  const sections = await getHomepageSections();

  // Categories ride along so the Edits panel that leads into one can show
  // that category's own photograph instead of a path written into a component.
  // The story block previews a collection beside the brand copy. Which one is
  // the section row's business: it names best-sellers today, so the homepage
  // shows both nav collections rather than new-arrivals twice.
  const previewSlug =
    sections.find((section) => section.key === 'story')?.collectionSlug ?? 'best-sellers';

  const [occasions, story, values, journal, categories, previewCollection, previewProducts] =
    await Promise.all([
      getOccasionPanels(),
      getStoryPanel(),
      getValueProps(),
      getJournalPosts(),
      getCategories(),
      getCollectionBySlug(previewSlug),
      getProductsByCollection(previewSlug, 4),
    ]);
  const preview = previewCollection
    ? { name: previewCollection.name, slug: previewCollection.slug, products: previewProducts }
    : undefined;

  // Which products lead the homepage is a merchandising decision, so it comes
  // from whichever collection the section points at.
  const productSection = sections.find(
    (section) => section.key === 'featured_products',
  );
  const showcase = productSection
    ? await getProductsByCollection(
        productSection.collectionSlug ?? 'new-arrivals',
        8,
      )
    : [];

  return (
    <>
      {sections.map((section) => {
        switch (section.key) {
          case 'hero':
            return <Hero key={section.id} />;
          case 'mood_tiles':
            return <CategoryRail key={section.id} />;
          case 'occasions':
            return <OccasionEdit key={section.id} panels={occasions} categories={categories} />;
          case 'featured_products':
            return <ProductShowcase key={section.id} products={showcase} />;
          case 'story':
            return (
              <StorySection key={section.id} panel={story} values={values} preview={preview} />
            );
          case 'journal':
            return <JournalSection key={section.id} posts={journal} />;
          default:
            return null;
        }
      })}
      <ModelContextTools products={showcase} />
    </>
  );
}
