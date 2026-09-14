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
  getTestimonials,
  getHomepageSections,
  getMoodTiles,
  getOccasionPanels,
} from '@mridul/database';
import { sessionClient } from '@mridul/supabase/server';
import {
  removeTestimonialImage,
  uploadHeroImage,
  uploadTestimonialImage,
} from '../../actions/media';
import { ImageUploadField } from '../../components/image-upload';
import {
  createTestimonial,
  deleteTestimonial,
  setTestimonialPublished,
  updateHeroSlide,
  updateTestimonial,
  updateHomepageSection,
  updateMoodTile,
  updateOccasionPanel,
} from '../../actions/content';
import { EditForm, Field, FieldRow, TextArea, Toggle } from '../../components/form';
import { MediaThumb, PageHead, Panel, Pill, SubHead, ViewOnSite } from '../../components/ui';

export const metadata: Metadata = { title: 'Homepage | Mridul Admin' };

export default async function HomepagePage() {
  const db = await sessionClient();
  const [sections, slides, panels, tiles] = await Promise.all([
    getHomepageSections(true, db),
    getHeroSlides(true, db),
    getOccasionPanels(db),
    getMoodTiles(db),
  ]);
  // Drafts included: a review that has not been published yet must still be
  // findable, or it could never be finished.
  const reviews = await getTestimonials(true, db);

  return (
    <>
      <PageHead
        title="Homepage"
        subtitle="Edit the headings, banners and tiles a shopper sees first."
        actions={<ViewOnSite href="/" label="View homepage" />}
      />

      <Panel
        title="Hero banners"
        note="The full-bleed carousel at the top. Change the picture and the words in one place."
      >
        <div className="hero-admin-list">
          {slides.map((slide, index) => (
            <article className="hero-admin-card" key={slide.id}>
              {/* Which banner this is, and whether anyone can see it. Without
                  it two stacked banners on a phone are indistinguishable. */}
              <div className="hero-admin-head">
                <span className="slide-number">Banner {index + 1}</span>
                <Pill tone={slide.isActive ? 'ok' : 'low'}>
                  {slide.isActive ? 'On the website' : 'Hidden'}
                </Pill>
              </div>
              <div className="hero-admin-preview">
                <MediaThumb
                  url={slide.media.url}
                  alt={slide.media.alt}
                  focal={slide.media.focal}
                  size={180}
                />
                <ImageUploadField
                  action={uploadHeroImage}
                  altDefault={slide.media.alt}
                  altPlaceholder="e.g. Ivory saree against a lime-washed wall"
                  fields={{ slide_id: slide.id }}
                  maxLabel="JPEG, PNG or WebP, up to 15MB"
                  submitLabel="Change banner picture"
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
        title="Customer reviews"
        note="Shown above the journal. A review appears on the website only once you tick Published — nothing here is invented or seeded."
      >
        <div className="panel-stack">
          {reviews.length === 0 && (
            <p className="prose">
              No reviews yet. Paste a real one below and it appears on the
              homepage once you publish it.
            </p>
          )}
          {reviews.map((review) => (
            <div className="review-editor" key={review.id}>
              <div className="review-editor-state">
                <Pill tone={review.isPublished ? 'ok' : 'low'}>
                  {review.isPublished ? 'On the website' : 'Draft — not on the website'}
                </Pill>
                <EditForm
                  action={setTestimonialPublished}
                  submitLabel={review.isPublished ? 'Take off the website' : 'Publish now'}
                  compact
                  danger={review.isPublished}
                >
                  <input name="id" type="hidden" value={review.id} />
                  <input
                    name="published"
                    type="hidden"
                    value={review.isPublished ? 'false' : 'true'}
                  />
                </EditForm>
                {/* Removing this review belongs next to this review, not in a
                    list of "Remove <name>" buttons under an unrelated form. */}
                <EditForm
                  action={deleteTestimonial}
                  submitLabel="Remove"
                  title={`Remove the review from ${review.author}`}
                  compact
                  danger
                >
                  <input name="id" type="hidden" value={review.id} />
                </EditForm>
              </div>

              <div className="review-editor-photo">
                {review.media ? (
                  <>
                    <MediaThumb
                      alt={review.media.alt}
                      focal={review.media.focal}
                      size={110}
                      url={review.media.url}
                    />
                    <EditForm
                      action={removeTestimonialImage}
                      submitLabel="Remove picture"
                      compact
                      danger
                    >
                      <input name="testimonial_id" type="hidden" value={review.id} />
                    </EditForm>
                  </>
                ) : (
                  <ImageUploadField
                    action={uploadTestimonialImage}
                    altPlaceholder="e.g. Ananya in the Saanjh Sage saree"
                    fields={{ testimonial_id: review.id }}
                    maxLabel="Optional. JPEG, PNG or WebP, up to 10MB"
                    submitLabel="Add picture"
                  />
                )}
              </div>

              <EditForm action={updateTestimonial}>
              <input name="id" type="hidden" value={review.id} />
              <FieldRow>
                <Field label="Name" name="author" defaultValue={review.author} required />
                <Field
                  label="Where they are"
                  name="location"
                  defaultValue={review.location}
                  hint="Optional"
                />
              </FieldRow>
              <TextArea
                label="What they wrote"
                name="body"
                defaultValue={review.body}
                rows={3}
              />
              <FieldRow>
                <Field
                  label="Stars"
                  name="rating"
                  type="number"
                  defaultValue={review.rating}
                  hint="1 to 5"
                  required
                />
                <Field
                  label="Order"
                  name="position"
                  type="number"
                  defaultValue={review.position}
                />
              </FieldRow>
              {/* Publishing is the button above. A second control for the same
                  state, saved by a different button, is what made this
                  confusing — so the form keeps the state it was given. */}
              <input
                name="is_published"
                type="hidden"
                value={review.isPublished ? 'on' : ''}
              />
              </EditForm>
            </div>
          ))}
        </div>
        <SubHead
          title="Add a new review"
          note="A different form from the ones above: this one creates a review rather than editing an existing one. It starts as a draft."
        />
        <div className="panel-stack">
          <EditForm action={createTestimonial} submitLabel="Add review">
            <FieldRow>
              <Field label="Name" name="author" required placeholder="e.g. Ananya R." />
              <Field label="Where they are" name="location" placeholder="e.g. Chennai" />
            </FieldRow>
            <TextArea
              label="What they wrote"
              name="body"
              rows={3}
              hint="Paste their words. Do not write it for them."
            />
            <FieldRow>
              <Field label="Stars" name="rating" type="number" defaultValue={5} required />
              <Field label="Order" name="position" type="number" defaultValue={0} />
            </FieldRow>
          </EditForm>
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
              <th aria-label="Actions" />
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
