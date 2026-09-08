/**
 * Homepage content.
 *
 * Everything the homepage renders is a row, including the hero: its image, the
 * eyebrow, the headline, the sub-line and where the button goes. The storefront
 * reads exactly these records, so what is listed here is what is live.
 */

import type { Metadata } from 'next';
import {
  getHeroSlides,
  getHomepageSections,
  getJournalPosts,
  getOccasionPanels,
  getProductsByCollection,
  getStoryPanel,
  getValueProps,
  moodTiles,
} from '@mridul/database';
import { MediaThumb, PageHead, Panel, Pill, StatCard, ViewOnSite } from '../components/ui';

export const metadata: Metadata = { title: 'Homepage | Mridul Admin' };

export default async function HomepagePage() {
  const [sections, slides, occasions, story, values, journal] = await Promise.all([
    getHomepageSections(true),
    getHeroSlides(true),
    getOccasionPanels(),
    getStoryPanel(),
    getValueProps(),
    getJournalPosts(true),
  ]);

  const productSection = sections.find((section) => section.key === 'featured_products');
  const featured = await getProductsByCollection(
    productSection?.collectionSlug ?? 'new-arrivals',
    8,
  );

  return (
    <>
      <PageHead
        title="Homepage"
        subtitle="Sections, hero banners and editorial content, in the order the storefront renders them."
        actions={<ViewOnSite href="/" label="View homepage" />}
      />

      <dl className="stat-grid">
        <StatCard
          label="Sections"
          value={`${sections.filter((s) => s.isEnabled).length}/${sections.length}`}
          note="enabled"
        />
        <StatCard
          label="Hero slides"
          value={`${slides.filter((s) => s.isActive).length}/${slides.length}`}
          note="active"
        />
        <StatCard label="Journal posts" value={journal.length} note="published" />
        <StatCard
          label="Featured from"
          value={productSection?.collectionSlug ?? '—'}
          note={`${featured.length} products in the rail`}
        />
      </dl>

      <Panel
        title="Section order"
        note="The homepage renders these top to bottom. Position and the enabled flag are data, so reordering is not a deploy."
      >
        <table>
          <thead>
            <tr>
              <th className="numeric">#</th>
              <th>Section</th>
              <th>Key</th>
              <th>What it shows</th>
              <th>Source</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <tr key={section.id}>
                <td className="numeric">{section.position}</td>
                <td>
                  <strong>{section.name}</strong>
                </td>
                <td>
                  <code>{section.key}</code>
                </td>
                <td className="cell-wrap">{section.description}</td>
                <td>
                  {section.collectionSlug ? (
                    <code>{section.collectionSlug}</code>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <Pill tone={section.isEnabled ? 'ok' : 'muted'}>
                    {section.isEnabled ? 'Enabled' : 'Hidden'}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel
        title="Hero banners"
        note="The full-bleed carousel at the top of the homepage. Image, crop, copy and destination all belong to the slide."
      >
        <div className="hero-admin-list">
          {slides.map((slide) => (
            <article className="hero-admin-card" key={slide.id}>
              <div className="hero-admin-preview">
                <MediaThumb
                  url={slide.media.url}
                  alt={slide.media.alt}
                  focal={slide.media.focal}
                  size={190}
                />
              </div>
              <div className="hero-admin-body">
                <div className="hero-admin-head">
                  <span className="slide-number">Slide {slide.position}</span>
                  <Pill tone={slide.isActive ? 'ok' : 'muted'}>
                    {slide.isActive ? 'Live' : 'Hidden'}
                  </Pill>
                </div>
                <dl className="field-list">
                  <div>
                    <dt>Eyebrow</dt>
                    <dd>{slide.eyebrow}</dd>
                  </div>
                  <div>
                    <dt>Headline</dt>
                    <dd className="field-strong">{slide.title}</dd>
                  </div>
                  <div>
                    <dt>Sub-line</dt>
                    <dd>{slide.note}</dd>
                  </div>
                  <div>
                    <dt>Button</dt>
                    <dd>
                      {slide.ctaLabel} → <code>{slide.ctaHref}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Image</dt>
                    <dd>
                      <code>{slide.media.url}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Crop</dt>
                    <dd>
                      <code>{slide.media.focal}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Alt text</dt>
                    <dd>{slide.media.alt}</dd>
                  </div>
                </dl>
                <ViewOnSite href={slide.ctaHref} label="Open destination" />
              </div>
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="Shop by mood" note="Six tiles that open a pre-filtered listing.">
        <table>
          <thead>
            <tr>
              <th className="numeric">#</th>
              <th>Label</th>
              <th>Note</th>
              <th>Destination</th>
              <th>Icon</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {[...moodTiles]
              .sort((a, b) => a.position - b.position)
              .map((tile) => (
                <tr key={tile.id}>
                  <td className="numeric">{tile.position}</td>
                  <td>
                    <strong>{tile.label}</strong>
                  </td>
                  <td>{tile.note}</td>
                  <td className="cell-wrap">
                    <code>{tile.href}</code>
                  </td>
                  <td>
                    <code>{tile.icon}</code>
                  </td>
                  <td>
                    <ViewOnSite href={tile.href} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Curated edits" note="The three editorial panels below the tiles.">
        <table>
          <thead>
            <tr>
              <th className="numeric">#</th>
              <th>Eyebrow</th>
              <th>Title</th>
              <th>Body</th>
              <th>Button</th>
              <th>Style</th>
            </tr>
          </thead>
          <tbody>
            {occasions.map((panel) => (
              <tr key={panel.id}>
                <td className="numeric">{panel.position}</td>
                <td>{panel.eyebrow}</td>
                <td>
                  <strong>{panel.title}</strong>
                </td>
                <td className="cell-wrap">
                  {panel.body ?? <span className="muted">—</span>}
                </td>
                <td className="cell-wrap">
                  {panel.ctaLabel} → <code>{panel.ctaHref}</code>
                </td>
                <td>
                  <code>{panel.tone}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Brand story" note="The artisan panel and the value strip under it.">
        <div className="story-admin">
          <MediaThumb
            url={story.media.url}
            alt={story.media.alt}
            focal={story.media.focal}
            size={150}
          />
          <dl className="field-list">
            <div>
              <dt>Eyebrow</dt>
              <dd>{story.eyebrow}</dd>
            </div>
            <div>
              <dt>Title</dt>
              <dd className="field-strong">{story.title}</dd>
            </div>
            <div>
              <dt>Body</dt>
              <dd>{story.body}</dd>
            </div>
            <div>
              <dt>Stats</dt>
              <dd>
                {story.stats.map((stat) => `${stat.value} ${stat.label}`).join(' · ')}
              </dd>
            </div>
            <div>
              <dt>Button</dt>
              <dd>
                {story.ctaLabel} → <code>{story.ctaHref}</code>
              </dd>
            </div>
            <div>
              <dt>Image</dt>
              <dd>
                <code>{story.media.url}</code>
              </dd>
            </div>
          </dl>
        </div>
        <table>
          <thead>
            <tr>
              <th className="numeric">#</th>
              <th>Value</th>
              <th>Note</th>
              <th>Icon</th>
            </tr>
          </thead>
          <tbody>
            {values.map((value) => (
              <tr key={value.id}>
                <td className="numeric">{value.position}</td>
                <td>
                  <strong>{value.title}</strong>
                </td>
                <td>{value.note}</td>
                <td>
                  <code>{value.icon}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Style journal" note="Three editorial cards at the foot of the homepage.">
        <table>
          <thead>
            <tr>
              <th>Image</th>
              <th>Title</th>
              <th>Excerpt</th>
              <th>Links to</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {journal.map((post) => (
              <tr key={post.id}>
                <td>
                  <MediaThumb
                    url={post.media.url}
                    alt={post.media.alt}
                    focal={post.media.focal}
                  />
                </td>
                <td>
                  <strong>{post.title}</strong>
                </td>
                <td className="cell-wrap">{post.excerpt}</td>
                <td>
                  <code>{post.href}</code>
                </td>
                <td>
                  <Pill tone={post.isPublished ? 'ok' : 'muted'}>
                    {post.isPublished ? 'Published' : 'Draft'}
                  </Pill>
                </td>
                <td>
                  <ViewOnSite href={post.href} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel
        title="Featured product rail"
        note={`Currently fed by the "${productSection?.collectionSlug ?? 'new-arrivals'}" collection rather than a hand-picked list, so adding a product to that collection puts it on the homepage.`}
      >
        <table>
          <thead>
            <tr>
              <th>Image</th>
              <th>Product</th>
              <th>Category</th>
              <th className="numeric">Stock</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {featured.map((product) => (
              <tr key={product.id}>
                <td>
                  <MediaThumb
                    url={product.images[0].url}
                    alt={product.images[0].alt}
                    focal={product.images[0].focal}
                  />
                </td>
                <td>
                  <strong>{product.name}</strong>
                </td>
                <td>{product.categorySlug}</td>
                <td className="numeric">{product.stockTotal}</td>
                <td>
                  <ViewOnSite href={`/product/${product.slug}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
