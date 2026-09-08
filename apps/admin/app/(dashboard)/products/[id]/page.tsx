/**
 * Edit a product.
 *
 * Everything a shopper sees is editable here: the words, the price, the
 * photographs, the stock per option, and whether it is live at all. Nothing
 * on this page is a read-only summary of something you have to change
 * elsewhere.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getProductById } from '@mridul/database';
import { formatPaise } from '@mridul/utils';
import { updateProduct, updateStock } from '../../../actions/catalogue';
import { removeProductImage, uploadProductImage } from '../../../actions/media';
import {
  EditForm,
  Field,
  FieldRow,
  FileField,
  Select,
  TextArea,
  Toggle,
} from '../../../components/form';
import { MediaThumb, PageHead, Panel, Pill, ViewOnSite } from '../../../components/ui';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);
  return { title: `${product?.name ?? 'Product'} | Mridul Admin` };
}

const BADGES = [
  { value: '', label: 'None' },
  { value: 'new', label: 'New' },
  { value: 'bestseller', label: 'Bestseller' },
  { value: 'limited', label: 'Limited' },
  { value: 'back_in_stock', label: 'Back in stock' },
];

export default async function ProductEditPage({ params }: PageProps) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();

  return (
    <>
      <Link className="back-link" href="/products">
        <ChevronLeft aria-hidden="true" /> All products
      </Link>

      <PageHead
        title={product.name}
        subtitle={`${product.fabric} · ${product.stockTotal} in stock`}
        actions={
          <>
            <Pill tone={product.isActive ? 'ok' : 'muted'}>
              {product.isActive ? 'Live' : 'Draft'}
            </Pill>
            <ViewOnSite href={`/product/${product.slug}`} label="View on site" />
          </>
        }
      />

      <Panel title="Photographs" note="The first image is the one shoppers see on a listing.">
        <div className="image-editor">
          {product.images.map((image, index) => (
            <div className="image-editor-item" key={image.id}>
              <MediaThumb url={image.url} alt={image.alt} focal={image.focal} size={140} />
              <span className="image-role">
                {index === 0 ? 'Thumbnail' : `Image ${index + 1}`}
              </span>
              <p className="image-alt">{image.alt}</p>
              <EditForm action={removeProductImage} submitLabel="Remove" compact danger>
                <input name="image_id" type="hidden" value={image.id} />
                <input name="product_id" type="hidden" value={product.id} />
              </EditForm>
            </div>
          ))}

          <div className="image-editor-add">
            <EditForm action={uploadProductImage} submitLabel="Upload image" compact>
              <input name="product_id" type="hidden" value={product.id} />
              <input name="product_slug" type="hidden" value={product.slug} />
              <FileField label="Add a photograph" name="file" hint="JPEG, PNG or WebP, up to 10MB" />
              <Field
                label="Describe it"
                name="alt"
                required
                placeholder="e.g. Ivory chanderi saree beside a window"
                hint="Read aloud by screen readers"
              />
            </EditForm>
          </div>
        </div>
      </Panel>

      <Panel title="Stock" note="Set to 0 to mark an option out of stock. It stays visible but cannot be bought.">
        <table>
          <thead>
            <tr>
              <th>Option</th>
              <th>SKU</th>
              <th className="numeric">Sells at</th>
              <th>In stock</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {product.variants.map((variant) => (
              <tr key={variant.id}>
                <td>
                  <strong>{variant.label}</strong>
                </td>
                <td>
                  <code>{variant.sku}</code>
                </td>
                <td className="numeric">
                  {formatPaise(product.pricePaise + variant.priceDeltaPaise)}
                </td>
                <td>
                  <Pill tone={variant.stock === 0 ? 'out' : variant.stock <= 5 ? 'low' : 'ok'}>
                    {variant.stock === 0 ? 'Out of stock' : `${variant.stock} left`}
                  </Pill>
                </td>
                <td>
                  <EditForm action={updateStock} submitLabel="Update" compact>
                    <input name="variant_id" type="hidden" value={variant.id} />
                    <input
                      className="stock-input"
                      defaultValue={variant.stock}
                      min={0}
                      name="on_hand"
                      type="number"
                      aria-label={`Stock for ${variant.label}`}
                    />
                  </EditForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Details" note="What a shopper reads on the product page.">
        <EditForm action={updateProduct}>
          <input name="id" type="hidden" value={product.id} />

          <FieldRow>
            <Field label="Name" name="name" defaultValue={product.name} required />
            <Field
              label="Subtitle"
              name="subtitle"
              defaultValue={product.subtitle}
              hint="Shown under the name"
            />
          </FieldRow>

          <FieldRow>
            <Field
              label="Price"
              name="price"
              defaultValue={product.pricePaise / 100}
              hint="In rupees"
              required
            />
            <Field
              label="Compare-at price"
              name="compare_at"
              defaultValue={product.compareAtPaise ? product.compareAtPaise / 100 : ''}
              hint="Leave empty for no offer"
            />
          </FieldRow>

          <TextArea
            label="Description"
            name="description"
            defaultValue={product.description}
            rows={4}
          />

          <TextArea
            label="Blouse details"
            name="blouse_details"
            defaultValue={product.blouseDetails ?? ''}
            rows={2}
            hint="Leave empty if not applicable"
          />

          <FieldRow>
            <Field label="Fabric" name="fabric" defaultValue={product.fabric} />
            <Field label="Colour" name="colour_name" defaultValue={product.colour.name} />
          </FieldRow>

          <FieldRow>
            <Field label="Occasion" name="occasion" defaultValue={product.occasion} />
            <Field label="Weave" name="technique" defaultValue={product.technique} />
          </FieldRow>

          <FieldRow>
            <Select
              label="Badge"
              name="badge"
              options={BADGES}
              defaultValue={product.badge ?? ''}
            />
            <Toggle
              label="Live on the storefront"
              name="is_active"
              defaultChecked={product.isActive}
              hint="Off keeps it as a draft"
            />
          </FieldRow>
        </EditForm>
      </Panel>
    </>
  );
}
