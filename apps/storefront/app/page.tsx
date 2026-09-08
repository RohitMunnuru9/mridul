/**
 * Homepage.
 *
 * The order of the blocks and whether each one appears is read from
 * `homepage_sections`, not written here. Switching a section off or moving it
 * is a data change an admin makes, which is the whole point of the content
 * layer — nobody should need a deploy to reorder the homepage.
 */

import { CategoryRail } from './components/category-rail';
import { Hero } from './components/hero';
import { JournalSection } from './components/journal-section';
import { ModelContextTools } from './components/model-context-tools';
import { OccasionEdit } from './components/occasion-edit';
import { ProductShowcase } from './components/product-showcase';
import { StorySection } from './components/story-section';
import {
  getHeroSlides,
  getHomepageSections,
  getJournalPosts,
  getOccasionPanels,
  getProductsByCollection,
  getStoryPanel,
  getValueProps,
} from '@mridul/database';

export default async function Home() {
  const sections = await getHomepageSections();

  const [slides, occasions, story, values, journal] = await Promise.all([
    getHeroSlides(),
    getOccasionPanels(),
    getStoryPanel(),
    getValueProps(),
    getJournalPosts(),
  ]);

  // Which products lead the homepage is a merchandising decision, so it comes
  // from whichever collection the section points at.
  const productSection = sections.find((section) => section.key === 'featured_products');
  const showcase = productSection
    ? await getProductsByCollection(productSection.collectionSlug ?? 'new-arrivals', 8)
    : [];

  return (
    <>
      {sections.map((section) => {
        switch (section.key) {
          case 'hero':
            return <Hero key={section.id} slides={slides} />;
          case 'mood_tiles':
            return <CategoryRail key={section.id} />;
          case 'occasions':
            return <OccasionEdit key={section.id} panels={occasions} />;
          case 'featured_products':
            return <ProductShowcase key={section.id} products={showcase} />;
          case 'story':
            return <StorySection key={section.id} panel={story} values={values} />;
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
