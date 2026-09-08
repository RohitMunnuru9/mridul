/**
 * Categories.
 *
 * These drive the storefront navigation. The header, footer, mobile bar and
 * dropdown menus all render from this list, so adding a row here adds it to
 * every one of them.
 */

import type { Metadata } from 'next';
import { getCategoriesWithCounts } from '@mridul/database';
import { MediaThumb, PageHead, Panel, Pill, StatCard, ViewOnSite } from '../components/ui';

export const metadata: Metadata = { title: 'Categories | Mridul Admin' };

export default async function CategoriesPage() {
  const categories = await getCategoriesWithCounts();

  return (
    <>
      <PageHead
        title="Categories"
        subtitle="The storefront navigation is rendered from these rows, in this order."
      />

      <dl className="stat-grid">
        <StatCard label="Categories" value={categories.length} note="in the nav" />
        <StatCard
          label="Active"
          value={categories.filter((category) => category.isActive).length}
          note="visible to customers"
        />
        <StatCard
          label="Products"
          value={categories.reduce((total, category) => total + category.productCount, 0)}
          note="assigned"
        />
        <StatCard
          label="Units"
          value={categories.reduce((total, category) => total + category.stockTotal, 0)}
          note="in stock"
        />
      </dl>

      {categories.map((category) => (
        <Panel key={category.id} title={category.name} note={category.tagline}>
          <div className="story-admin">
            <MediaThumb
              url={category.heroImage.url}
              alt={category.heroImage.alt}
              focal={category.heroImage.focal}
              size={150}
            />
            <dl className="field-list">
              <div>
                <dt>Slug</dt>
                <dd>
                  <code>{category.slug}</code>
                </dd>
              </div>
              <div>
                <dt>Nav position</dt>
                <dd>{category.position}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <Pill tone={category.isActive ? 'ok' : 'muted'}>
                    {category.isActive ? 'Active' : 'Hidden'}
                  </Pill>
                </dd>
              </div>
              <div>
                <dt>Products</dt>
                <dd>
                  {category.productCount} products · {category.stockTotal} units
                </dd>
              </div>
              <div>
                <dt>Header image</dt>
                <dd>
                  <code>{category.heroImage.url}</code>
                </dd>
              </div>
              <div>
                <dt>Crop</dt>
                <dd>
                  <code>{category.heroImage.focal}</code>
                </dd>
              </div>
              <div>
                <dt>Alt text</dt>
                <dd>{category.heroImage.alt}</dd>
              </div>
              <div>
                <dt>Intro</dt>
                <dd>{category.intro}</dd>
              </div>
              <div>
                <dt>Long description</dt>
                <dd className="field-long">{category.description}</dd>
              </div>
            </dl>
          </div>
          <div className="panel-foot">
            <ViewOnSite href={`/shop/${category.slug}`} label="View listing" />
          </div>
        </Panel>
      ))}
    </>
  );
}
