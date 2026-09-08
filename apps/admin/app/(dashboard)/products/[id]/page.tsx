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
import {
  deleteVariant,
  toggleProductActive,
  updateProduct,
  updateVariant,
} from "../../../actions/catalogue";
import {
  removeProductImage,
  replaceProductImage,
  setThumbnail,
  updateMedia,
  uploadProductImage,
} from "../../../actions/media";
import {
  ColourSelect,
  EditForm,
  Field,
  FieldRow,
  Select,
  SwatchPicker,
  TextArea,
  Toggle,
} from "../../../components/form";
import { PageHead, Panel, Pill, ViewOnSite } from "../../../components/ui";
import { ReplaceableImage } from "../../../components/image-tile";
import { ImageUploadField } from "../../../components/image-upload";

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
            <article className="image-editor-item" key={image.id}>
              <header>
                <span className="image-role">
                  {index === 0 ? "Thumbnail" : `Image ${index + 1}`}
                </span>
                {index === 0 && <small>Shown on listings</small>}
              </header>
              <ReplaceableImage
                action={replaceProductImage}
                alt={image.alt}
                focal={image.focal}
                label={index === 0 ? "the thumbnail" : `image ${index + 1}`}
                mediaId={image.id}
                productId={product.id}
                productSlug={product.slug}
                url={image.url}
              />
              <EditForm action={updateMedia} submitLabel="Save description" compact>
                <input name="media_id" type="hidden" value={image.id} />
                <input name="product_id" type="hidden" value={product.id} />
                <input name="focal" type="hidden" value={image.focal} />
                <Field label="Alt text" name="alt" defaultValue={image.alt} required />
              </EditForm>
              <footer className="image-editor-actions">
                {index > 0 && (
                  <EditForm action={setThumbnail} submitLabel="Make thumbnail" compact>
                    <input name="product_id" type="hidden" value={product.id} />
                    <input name="media_id" type="hidden" value={image.id} />
                  </EditForm>
                )}
                <EditForm action={removeProductImage} submitLabel="Remove" compact danger>
                  <input name="image_id" type="hidden" value={image.id} />
                  <input name="product_id" type="hidden" value={product.id} />
                </EditForm>
              </footer>
            </article>
          ))}

          <div className="image-editor-add">
            <ImageUploadField
              action={uploadProductImage}
              productId={product.id}
              productSlug={product.slug}
            />
          </div>
        </div>
      </Panel>

      <Panel
        title="Options and stock"
        note="One card per option. Change the name, code, extra price or how many are left, then save that option."
      >
        <div className="variant-editor-grid">
          {product.variants.map((variant) => (
            <article className="variant-editor" key={variant.id}>
              <header>
                <strong>{variant.label}</strong>
                <span>
                  Sells at {formatPaise(product.pricePaise + variant.priceDeltaPaise)}
                </span>
                {product.variants.length > 1 && (
                  <EditForm
                    action={deleteVariant}
                    submitLabel="−"
                    title={`Remove the ${variant.label} option`}
                    compact
                    danger
                  >
                    <input name="product_id" type="hidden" value={product.id} />
                    <input name="variant_id" type="hidden" value={variant.id} />
                  </EditForm>
                )}
              </header>
              <EditForm action={updateVariant} submitLabel="Save option" compact>
                <input name="product_id" type="hidden" value={product.id} />
                <input name="variant_id" type="hidden" value={variant.id} />
                <FieldRow>
                  <Field label="Option" name="label" defaultValue={variant.label} required />
                  <Field label="Code" name="sku" defaultValue={variant.sku} required />
                </FieldRow>
                <FieldRow>
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
                    hint="0 marks it sold out"
                  />
                </FieldRow>
              </EditForm>
            </article>
          ))}
        </div>
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
              label="Was price"
              name="compare_at"
              defaultValue={product.compareAtPaise ? product.compareAtPaise / 100 : ""}
              required
              hint="Struck through on the site. Must be higher than the price."
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
            <ColourSelect
              label="Colour"
              name="colour_name"
              hexName="colour_hex"
              defaultHex={product.colour.hex}
              defaultName={product.colour.name}
              hint="Shown as the swatch on the listing"
            />
          </FieldRow>

          <SwatchPicker
            label="Also available in"
            name="swatches"
            defaultValues={product.swatches}
            hint="Tick every other colour this piece comes in"
          />

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

