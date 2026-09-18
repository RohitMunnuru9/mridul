/**
 * The journal, as it is written.
 *
 * Three posts have been on the homepage since the shop opened, each saying
 * "Read the story" and each leading to a shop listing, because none of them
 * had a story and there was nowhere to write one. This is where one is
 * written, given a picture, and published — and where a post with nothing to
 * say yet is left pointing at the listing it always pointed at.
 */

import type { Metadata } from 'next';
import {
  getJournalPosts,
  hasStory,
  journalHref,
  paragraphs,
  readingMinutes,
} from '@mridul/database';
import { can, currentAdmin, sessionClient } from '@mridul/supabase/server';
import { formatDate } from '@mridul/utils';
import { createPost, deletePost, setPostPublished, updatePost } from '../../actions/journal';
import { uploadJournalImage } from '../../actions/media';
import { EditForm, Field, FieldRow, TextArea } from '../../components/form';
import { ImageUploadField } from '../../components/image-upload';
import { MediaThumb, PageHead, Panel, Pill, ViewOnSite } from '../../components/ui';

export const metadata: Metadata = { title: 'Journal | Mridul Admin' };

export default async function JournalAdminPage() {
  const [db, admin] = await Promise.all([sessionClient(), currentAdmin()]);
  const posts = await getJournalPosts(true, db);
  const canWrite = can(admin, 'content_manager');

  const live = posts.filter((post) => post.isPublished).length;
  const withStory = posts.filter(hasStory).length;

  return (
    <>
      <PageHead
        title="Journal"
        subtitle={`${live} published · ${posts.length - live} drafts · ${withStory} with a story of their own`}
      />

      {posts.map((post) => {
        const story = hasStory(post);
        return (
          <Panel
            key={post.id}
            title={post.title}
            note={
              post.isPublished
                ? `Published ${post.publishedAt ? formatDate(post.publishedAt) : ''} · ${
                    story ? `${readingMinutes(post.body)} min read` : 'points at its shop link'
                  }`
                : 'Draft — only you can see it'
            }
          >
            <div className="category-editor">
              <div className="category-editor-image">
                <MediaThumb url={post.media.url} alt={post.media.alt} focal={post.media.focal} />
                {post.isPublished && (
                  <ViewOnSite
                    href={journalHref(post)}
                    label={story ? 'Read on site' : 'See where it goes'}
                  />
                )}
                {canWrite && (
                  <ImageUploadField
                    action={uploadJournalImage}
                    altDefault={post.media.alt}
                    altPlaceholder="e.g. A pleated pallu held against the light"
                    fields={{ post_id: post.id, post_slug: post.slug }}
                    submitLabel="Change picture"
                  />
                )}
              </div>

              <div>
                <ul className="order-facts">
                  <li>
                    <Pill tone={post.isPublished ? 'ok' : 'low'}>
                      {post.isPublished ? 'Published' : 'Draft'}
                    </Pill>
                    {story ? <Pill tone="ok">Has a story</Pill> : <Pill tone="low">No story yet</Pill>}
                  </li>
                  <li>
                    Address: <code>/journal/{post.slug}</code>
                  </li>
                </ul>

                {canWrite && (
                  <div className="return-decide">
                    <EditForm
                      action={setPostPublished}
                      submitLabel={post.isPublished ? 'Take down' : 'Publish'}
                      compact
                      danger={post.isPublished}
                    >
                      <input name="id" type="hidden" value={post.id} />
                      <input name="published" type="hidden" value={String(!post.isPublished)} />
                    </EditForm>
                    {!post.isPublished && (
                      <EditForm action={deletePost} submitLabel="Delete draft" compact danger>
                        <input name="id" type="hidden" value={post.id} />
                      </EditForm>
                    )}
                  </div>
                )}

                {canWrite ? (
                  <EditForm action={updatePost} submitLabel="Save">
                    <input name="id" type="hidden" value={post.id} />
                    <FieldRow>
                      <Field defaultValue={post.title} label="Title" name="title" required />
                      <Field
                        defaultValue={post.slug}
                        hint="Its address. Lowercase, hyphens."
                        label="Slug"
                        name="slug"
                      />
                    </FieldRow>
                    <TextArea
                      defaultValue={post.excerpt}
                      hint="One or two lines, shown on the homepage and the index."
                      label="Excerpt"
                      name="excerpt"
                      rows={2}
                    />
                    <TextArea
                      defaultValue={post.body}
                      hint="Plain text. A blank line starts a new paragraph. Leave empty and the post keeps pointing at its shop link."
                      label="The story"
                      name="body"
                      rows={14}
                    />
                    <FieldRow>
                      <Field
                        defaultValue={post.href}
                        hint="A page on this site — a category or a collection. Shown as “shop the pieces from this story”."
                        label="Shop link"
                        name="href"
                      />
                      <Field
                        defaultValue={post.position}
                        hint="Lowest first. The first one leads the homepage."
                        label="Order"
                        name="position"
                        type="number"
                      />
                    </FieldRow>
                  </EditForm>
                ) : (
                  <div className="story-preview">
                    {paragraphs(post.body).map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Panel>
        );
      })}

      {canWrite && (
        <Panel
          title="Write a new post"
          note="Saved as a draft. Give it a picture and publish it from the list above."
        >
          <EditForm action={createPost} submitLabel="Save the draft">
            <FieldRow>
              <Field label="Title" name="title" placeholder="Five ways to drape for today" required />
              <Field hint="Leave blank to make one from the title." label="Slug" name="slug" />
            </FieldRow>
            <TextArea hint="One or two lines." label="Excerpt" name="excerpt" rows={2} />
            <TextArea
              hint="Plain text. A blank line starts a new paragraph."
              label="The story"
              name="body"
              rows={12}
            />
            <FieldRow>
              <Field
                defaultValue="/shop"
                hint="Where “shop the pieces” goes."
                label="Shop link"
                name="href"
              />
              <Field defaultValue={posts.length + 1} label="Order" name="position" type="number" />
            </FieldRow>
          </EditForm>
        </Panel>
      )}
    </>
  );
}
