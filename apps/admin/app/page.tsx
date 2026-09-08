/**
 * Admin dashboard.
 *
 * Revenue and order tiles need the `orders` and `payments` tables, so they are
 * shown as pending rather than filled with invented numbers. Everything
 * catalogue- and content-side is real: it reads the same repositories the
 * storefront does, so the two can never disagree.
 */

import type { Metadata } from 'next';
import {
  getAllProducts,
  getCategoriesWithCounts,
  getCollectionsWithCounts,
  getHeroSlides,
  getHomepageSections,
  getInventoryRows,
  getMediaSummary,
} from '@mridul/database';
import { formatPaise } from '@mridul/utils';
import {
  InternalLink,
  MediaThumb,
  PageHead,
  Panel,
  Pill,
  StatCard,
  ViewOnSite,
} from './components/ui';

export const metadata: Metadata = { title: 'Dashboard | Mridul Admin' };

/** Below this many units a variant needs restocking. */
const LOW_STOCK_THRESHOLD = 5;

export default async function Dashboard() {
  const [products, categories, collections, inventory, media, sections, slides] =
    await Promise.all([
      getAllProducts(),
      getCategoriesWithCounts(),
      getCollectionsWithCounts(),
      getInventoryRows(),
      getMediaSummary(),
      getHomepageSections(true),
      getHeroSlides(true),
    ]);

  const live = products.filter((product) => product.isActive);
  const inventoryValue = inventory.reduce(
    (total, row) => total + row.stock * row.unitPricePaise,
    0,
  );
  const attention = inventory
    .filter((row) => row.stock <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 6);

  const topRated = [...live]
    .sort((a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0))
    .slice(0, 5);

  return (
    <>
      <PageHead
        title="Dashboard"
        subtitle="Catalogue, content and inventory across the storefront."
        actions={<ViewOnSite href="/" label="View storefront" />}
      />

      <dl className="stat-grid">
        <StatCard
          label="Live products"
          value={live.length}
          note={`${categories.length} categories · ${collections.length} collections`}
        />
        <StatCard
          label="Inventory value"
          value={formatPaise(inventoryValue)}
          note={`${inventory.reduce((t, r) => t + r.stock, 0)} units on hand`}
        />
        <StatCard
          label="Needs restocking"
          value={attention.length}
          note={`${LOW_STOCK_THRESHOLD} units or fewer`}
        />
        <StatCard
          label="Media files"
          value={media.files}
          note={`${media.references} references`}
        />
        <StatCard label="Revenue" value="" note="needs the orders table" pending />
        <StatCard label="Pending orders" value="" note="needs the orders table" pending />
      </dl>

      <div className="panel-row">
        <Panel
          title="Needs restocking"
          note="Variant level — a saree can be sold out with its blouse piece and still available on its own."
        >
          {attention.length === 0 ? (
            <p className="panel-empty">Everything is comfortably stocked.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Option</th>
                  <th className="numeric">Units</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attention.map((row) => (
                  <tr key={row.variantId}>
                    <td>
                      <InternalLink href={`/products/${row.productId}`}>
                        {row.productName}
                      </InternalLink>
                    </td>
                    <td>{row.variantLabel}</td>
                    <td className="numeric">{row.stock}</td>
                    <td>
                      <Pill tone={row.stock === 0 ? 'out' : 'low'}>
                        {row.stock === 0 ? 'Sold out' : 'Low'}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Best rated" note="Standing in for best sellers until orders exist.">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th className="numeric">Rating</th>
                <th className="numeric">Reviews</th>
                <th className="numeric">Price</th>
              </tr>
            </thead>
            <tbody>
              {topRated.map((product) => (
                <tr key={product.id}>
                  <td>
                    <InternalLink href={`/products/${product.id}`}>
                      {product.name}
                    </InternalLink>
                  </td>
                  <td className="numeric">{product.rating?.average.toFixed(1) ?? '—'}</td>
                  <td className="numeric">{product.rating?.count ?? 0}</td>
                  <td className="numeric">{formatPaise(product.pricePaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel
        title="Homepage right now"
        note="The hero banners and section order the storefront is rendering."
      >
        <div className="hero-strip">
          {slides.map((slide) => (
            <div className="hero-strip-item" key={slide.id}>
              <MediaThumb
                url={slide.media.url}
                alt={slide.media.alt}
                focal={slide.media.focal}
                size={110}
              />
              <div>
                <span className="slide-number">Slide {slide.position}</span>
                <strong>{slide.title}</strong>
                <small>{slide.eyebrow}</small>
                <Pill tone={slide.isActive ? 'ok' : 'muted'}>
                  {slide.isActive ? 'Live' : 'Hidden'}
                </Pill>
              </div>
            </div>
          ))}
        </div>
        <table>
          <thead>
            <tr>
              <th className="numeric">#</th>
              <th>Section</th>
              <th>Source</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <tr key={section.id}>
                <td className="numeric">{section.position}</td>
                <td>{section.name}</td>
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
        <div className="panel-foot">
          <InternalLink href="/homepage">Manage homepage content</InternalLink>
        </div>
      </Panel>

      <Panel title="Catalogue at a glance">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th className="numeric">Products</th>
              <th className="numeric">Units</th>
              <th>Nav position</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td>
                  <strong>{category.name}</strong>
                </td>
                <td className="numeric">{category.productCount}</td>
                <td className="numeric">{category.stockTotal}</td>
                <td>{category.position}</td>
                <td>
                  <ViewOnSite href={`/shop/${category.slug}`} />
                </td>
              </tr>
            ))}
            {collections.map((collection) => (
              <tr key={collection.id}>
                <td>
                  {collection.name} <span className="muted">(collection)</span>
                </td>
                <td className="numeric">{collection.productCount}</td>
                <td className="numeric">
                  <span className="muted">—</span>
                </td>
                <td>
                  <span className="muted">—</span>
                </td>
                <td>
                  <ViewOnSite href={`/collections/${collection.slug}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
