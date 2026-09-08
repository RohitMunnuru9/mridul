/**
 * Homepage content.
 *
 * The headings a customer actually reads, editable in place. The hero banners,
 * the three editorial panels and the mood tiles are all here — change a
 * heading, save, and the storefront shows it.
 */

import type { Metadata } from 'next';
import {
  getHeroSlides,
  getHomepageSections,
  getMoodTiles,
  getOccasionPanels,
} from '@mridul/database';
import {
  updateHeroSlide,
  updateHomepageSection,
  updateMoodTile,
  updateOccasionPanel,
} from '../../actions/content';
import { EditForm, Field, FieldRow, TextArea, Toggle } from '../../components/form';
import { MediaThumb, PageHead, Panel, ViewOnSite } from '../../components/ui';

export const metadata: Metadata = { title: 'Homepage | Mridul Admin' };

export default async function HomepagePage() {
  const [sections, slides, panels, tiles] = await Promise.all([
    getHomepageSections(true),
    getHeroSlides(true),
    getOccasionPanels(),
    getMoodTiles(),
  ]);

  return (
    <>
      <PageHead
        title="Homepage"
        subtitle="Edit the headings, banners and tiles a shopper sees first."
        actions={<ViewOnSite href="/" label="View homepage" />}
      />

      <Panel
        title="Hero banners"
        note="The full-bleed carousel at the top. Change the image from Media."
      >
        <div className="hero-admin-list">
          {slides.map((slide) => (
            <article className="hero-admin-card" key={slide.id}>
              <div className="hero-admin-preview">
                <MediaThumb
                  url={slide.media.url}
                  alt={slide.media.alt}
                  focal={slide.media.focal}
                  size={180}
                />
              </div>
              <div className="hero-admin-body">
                <EditForm action={updateHeroSlide}>
                  <input name="id" type="hidden" value={slide.id} />
                  <Field label="Small line above" name="eyebrow" defaultValue={slide.eyebrow} />
                  <Field label="Headline" name="title" defaultValue={slide.title} required />
                  <TextArea label="Sub-line" name="note" defaultValue={slide.note} rows={2} />
                  <FieldRow>
                    <Field label="Button text" name="cta_label" defaultValue={slide.ctaLabel} />
                    <Field label="Button goes to" name="cta_href" defaultValue={slide.ctaHref} />
                  </FieldRow>
                  <Toggle label="Show this banner" name="is_active" defaultChecked={slide.isActive} />
                </EditForm>
              </div>
            </article>
          ))}
        </div>
      </Panel>

      <Panel
        title="Editorial panels"
        note="The three blocks below the tiles. These are the big headings on the homepage."
      >
        <div className="panel-stack">
          {panels.map((panel) => (
            <EditForm action={updateOccasionPanel} key={panel.id}>
              <input name="id" type="hidden" value={panel.id} />
              <Field label="Small line above" name="eyebrow" defaultValue={panel.eyebrow} />
              <Field label="Heading" name="title" defaultValue={panel.title} required />
              <TextArea
                label="Body"
                name="body"
                defaultValue={panel.body ?? ''}
                rows={2}
                hint="Optional"
              />
              <FieldRow>
                <Field label="Button text" name="cta_label" defaultValue={panel.ctaLabel} />
                <Field label="Button goes to" name="cta_href" defaultValue={panel.ctaHref} />
              </FieldRow>
              <Toggle label="Show this panel" name="is_active" defaultChecked />
            </EditForm>
          ))}
        </div>
      </Panel>

      <Panel title="Shop by mood" note="The round tiles. Each opens a filtered listing.">
        <div className="panel-stack">
          {tiles.map((tile) => (
            <EditForm action={updateMoodTile} key={tile.id} compact>
              <input name="id" type="hidden" value={tile.id} />
              <FieldRow>
                <Field label="Label" name="label" defaultValue={tile.label} required />
                <Field label="Note" name="note" defaultValue={tile.note} />
              </FieldRow>
              <Field label="Goes to" name="href" defaultValue={tile.href} />
              <Toggle label="Show this tile" name="is_active" defaultChecked />
            </EditForm>
          ))}
        </div>
      </Panel>

      <Panel title="Section order" note="Turn a section off, or move it up and down the page.">
        <table>
          <thead>
            <tr>
              <th>Section</th>
              <th>What it shows</th>
              <th>Position</th>
              <th>Shown</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <tr key={section.id}>
                <td>
                  <strong>{section.name}</strong>
                </td>
                <td className="cell-wrap">{section.description}</td>
                <td colSpan={3}>
                  <EditForm action={updateHomepageSection} submitLabel="Update" compact>
                    <input name="id" type="hidden" value={section.id} />
                    <input
                      aria-label={`Position of ${section.name}`}
                      className="stock-input"
                      defaultValue={section.position}
                      min={1}
                      name="position"
                      type="number"
                    />
                    <Toggle
                      label="Shown"
                      name="is_enabled"
                      defaultChecked={section.isEnabled}
                    />
                  </EditForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}
