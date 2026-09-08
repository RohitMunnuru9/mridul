/**
 * Edit a product.
 *
 * Everything a shopper sees is editable here: the words, the price, the
 * photographs, the stock per option, and whether it is live at all. Nothing
 * on this page is a read-only summary of something you have to change
 * elsewhere.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getAllCategories, getProductById } from "@mridul/database";
import { sessionClient } from "@mridul/supabase/server";
import { formatPaise } from "@mridul/utils";
import { toggleProductActive, updateProduct, updateVariant } from "../../../actions/catalogue";
import {
  moveProductImage,
  removeProductImage,
  updateMedia,
  uploadProductImage,
} from "../../../actions/media";
import {
  EditForm,
  Field,
  FieldRow,
  FileField,
  Select,
  TextArea,
  Toggle,
} from "../../../components/form";
import { MediaThumb, PageHead, Panel, Pill, ViewOnSite } from "../../../components/ui";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id, await sessionClient());
  return { title: `${product?.name ?? "Product"} | Mridul Admin` };
}

const BADGES = [
  { value: "", label: "None" },
  { value: "new", label: "New" },
  { value: "bestseller", label: "Bestseller" },
  { value: "limited", label: "Limited" },
  { value: "back_in_stock", label: "Back in stock" },
];

export default async function ProductEditPage({ params }: PageProps) {
  const { id } = await params;
  const db = await sessionClient();
  const [product, categories] = await Promise.all([getProductById(id, db), getAllCategories(db)]);
  if (!product) notFound();
  const categoryId = categories.find((category) => category.slug === product.categorySlug)?.id;
  const realImages = product.images.filter((image) => image.id !== "missing");

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
            <Pill tone={product.isActive ? "ok" : "muted"}>
              {product.isActive ? "Live" : "Draft"}
            </Pill>
            <ViewOnSite href={`/product/${product.slug}`} label="View on site" />
          </>
        }
      />

      {!product.isActive && (
        <div className="unlisted-banner">
          <div>
            <strong>This product is hidden from the website</strong>
            <span>
              All details and images are safely retained. Restore it whenever it is ready.
            </span>
          </div>
          <EditForm action={toggleProductActive} submitLabel="Put back on website" compact>
            <input name="id" type="hidden" value={product.id} />
            <input name="active" type="hidden" value="true" />
          </EditForm>
        </div>
      )}

      <Panel title="Photographs" note="The first image is the one shoppers see on a listing.">
        <div className="image-editor">
          {realImages.map((image, index) => (
            <div className="image-editor-item" key={image.id}>
              <MediaThumb url={image.url} alt={image.alt} focal={image.focal} size={140} />
              <span className="image-role">{index === 0 ? "Thumbnail" : `Image ${index + 1}`}</span>
              <EditForm action={updateMedia} submitLabel="Save image details" compact>
                <input name="media_id" type="hidden" value={image.id} />
                <input name="product_id" type="hidden" value={product.id} />
                <Field label="Alt text" name="alt" defaultValue={image.alt} required />
                <Field
                  label="Crop position"
                  name="focal"
                  defaultValue={image.focal}
                  hint="Example: 50% center"
                />
              </EditForm>
              <div className="image-order-actions">
                {index > 0 && (
                  <EditForm action={moveProductImage} submitLabel="Move earlier" compact>
                    <input name="product_id" type="hidden" value={product.id} />
                    <input name="media_id" type="hidden" value={image.id} />
                    <input name="direction" type="hidden" value="up" />
                  </EditForm>
                )}
                {index < realImages.length - 1 && (
                  <EditForm action={moveProductImage} submitLabel="Move later" compact>
                    <input name="product_id" type="hidden" value={product.id} />
                    <input name="media_id" type="hidden" value={image.id} />
                    <input name="direction" type="hidden" value="down" />
                  </EditForm>
                )}
              </div>
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
              <FileField
                label="Add a photograph"
                name="file"
                hint="JPEG, PNG or WebP, up to 10MB"
              />
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

      <Panel
        title="Options and stock"
        note="Edit the option, SKU, price adjustment, and stock together. Zero stock stays saved but cannot be bought."
      >
        <table>
          <thead>
            <tr>
              <th>Option</th>
              <th>SKU</th>
              <th className="numeric">Sells at</th>
              <th>Edit option</th>
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
                  <EditForm action={updateVariant} submitLabel="Save option" compact>
                    <input name="product_id" type="hidden" value={product.id} />
                    <input name="variant_id" type="hidden" value={variant.id} />
                    <Field label="Option" name="label" defaultValue={variant.label} required />
                    <Field label="SKU" name="sku" defaultValue={variant.sku} required />
                    <Field
                      label="Extra price"
                      name="price_delta"
                      defaultValue={variant.priceDeltaPaise / 100}
                      hint="Rupees; 0 if none"
                    />
                    <Field
                      label="Stock"
                      name="on_hand"
                      defaultValue={variant.stock}
                      type="number"
                      required
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
            <Select
              label="Category"
              name="category_id"
              defaultValue={categoryId}
              options={categories.map((category) => ({ value: category.id, label: category.name }))}
            />
          </FieldRow>

          <Field
            label="Subtitle"
            name="subtitle"
            defaultValue={product.subtitle}
            hint="Shown under the name"
          />

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
              defaultValue={product.compareAtPaise ? product.compareAtPaise / 100 : ""}
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
            defaultValue={product.blouseDetails ?? ""}
            rows={2}
            hint="Leave empty if not applicable"
          />

          <FieldRow>
            <Field label="Fabric" name="fabric" defaultValue={product.fabric} />
            <Field label="Colour" name="colour_name" defaultValue={product.colour.name} />
          </FieldRow>

          <FieldRow>
            <Field
              label="Colour code"
              name="colour_hex"
              defaultValue={product.colour.hex}
              hint="Example: #c8a39a"
            />
            <Field
              label="Extra swatches"
              name="swatches"
              defaultValue={product.swatches.join(", ")}
              hint="Comma-separated colour codes"
            />
          </FieldRow>

          <FieldRow>
            <Field label="Occasion" name="occasion" defaultValue={product.occasion} />
            <Field label="Weave" name="technique" defaultValue={product.technique} />
          </FieldRow>

          <TextArea
            label="Care instructions"
            name="care"
            defaultValue={product.care.join("\n")}
            rows={3}
            hint="One instruction per line"
          />

          <FieldRow>
            <Select
              label="Badge"
              name="badge"
              options={BADGES}
              defaultValue={product.badge ?? ""}
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

