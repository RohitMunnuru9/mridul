/**
 * Categories.
 *
 * These are the storefront's navigation, so the name here is the word in the
 * header. The intro is what a shopper reads above the grid.
 */

import type { Metadata } from 'next';
import { getCategoriesWithCounts } from '@mridul/database';
import { updateCategory } from '../../actions/content';
import { EditForm, Field, TextArea, Toggle } from '../../components/form';
import { MediaThumb, PageHead, Panel, ViewOnSite } from '../../components/ui';

export const metadata: Metadata = { title: 'Categories | Mridul Admin' };

export default async function CategoriesPage() {
  const categories = await getCategoriesWithCounts();

  return (
    <>
      <PageHead
        title="Categories"
        subtitle="The words in your header, and the copy above each listing."
      />

      {categories.map((category) => (
        <Panel
          key={category.id}
          title={category.name}
          note={`${category.productCount} products · ${category.stockTotal} units`}
        >
          <div className="category-editor">
            <div className="category-editor-image">
              <MediaThumb
                url={category.heroImage.url}
                alt={category.heroImage.alt}
                focal={category.heroImage.focal}
                size={140}
              />
              <ViewOnSite href={`/shop/${category.slug}`} label="View listing" />
            </div>
            <EditForm action={updateCategory}>
              <input name="id" type="hidden" value={category.id} />
              <Field label="Name" name="name" defaultValue={category.name} required />
              <Field
                label="Small line above the heading"
                name="tagline"
                defaultValue={category.tagline}
              />
              <TextArea
                label="Intro"
                name="intro"
                defaultValue={category.intro}
                rows={2}
                hint="Sits under the heading"
              />
              <TextArea
                label="Longer description"
                name="description"
                defaultValue={category.description}
                rows={4}
                hint="Below the products"
              />
              <Toggle
                label="Show in the shop"
                name="is_active"
                defaultChecked={category.isActive}
              />
            </EditForm>
          </div>
        </Panel>
      ))}
    </>
  );
}
