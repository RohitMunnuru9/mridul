/**
 * Media.
 *
 * Every image, with alt text and crop editable in place, and the file itself
 * replaceable. Because everything points at the media row rather than at a
 * path, replacing a file updates every place it appears at once — which is why
 * each row lists where it is used before you change it.
 */

import type { Metadata } from 'next';
import { getMediaLibrary } from '@mridul/database';
import { replaceMediaFile, updateMedia } from '../../actions/media';
import { EditForm, Field, FieldRow, FileField } from '../../components/form';
import { MediaThumb, PageHead, Panel, ViewOnSite } from '../../components/ui';

export const metadata: Metadata = { title: 'Media | Mridul Admin' };

export default async function MediaPage() {
  const library = await getMediaLibrary();

  return (
    <>
      <PageHead
        title="Media"
        subtitle={`${library.length} images. Replacing a file changes every place it appears.`}
      />

      {library.map((record) => (
        <Panel
          key={record.url}
          title={record.path}
          note={`Used in ${record.usages.length} ${record.usages.length === 1 ? 'place' : 'places'}`}
        >
          <div className="media-editor">
            <div className="media-editor-preview">
              <MediaThumb
                url={record.url}
                alt={record.alt}
                focal={record.focal}
                size={150}
              />
              <ul className="media-usages">
                {record.usages.map((usage, index) => (
                  <li key={`${usage.kind}-${index}`}>
                    <span className="usage-kind">{usage.kind}</span>
                    <span className="usage-label">{usage.label}</span>
                    {usage.href && <ViewOnSite href={usage.href} />}
                  </li>
                ))}
              </ul>
            </div>

            <div className="media-editor-forms">
              <EditForm action={updateMedia} submitLabel="Save text">
                <input name="media_id" type="hidden" value={record.id} />
                <Field
                  label="Describe the image"
                  name="alt"
                  defaultValue={record.alt}
                  required
                  hint="Read aloud by screen readers"
                />
                <Field
                  label="Crop"
                  name="focal"
                  defaultValue={record.focal}
                  hint="e.g. 50% center, or 66% center to favour the right"
                />
              </EditForm>

              <EditForm action={replaceMediaFile} submitLabel="Replace file" compact>
                <input name="media_id" type="hidden" value={record.id} />
                <input name="bucket" type="hidden" value={record.buckets[0]} />
                <input name="path" type="hidden" value={record.path} />
                <FileField
                  label="Replace this photograph"
                  name="file"
                  hint="Updates everywhere it is used"
                />
              </EditForm>
            </div>
          </div>
        </Panel>
      ))}
    </>
  );
}
