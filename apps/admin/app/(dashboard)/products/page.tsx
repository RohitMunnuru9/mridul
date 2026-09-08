/**
 * Products.
 *
 * A list you can act on, not a report. Each row shows what a shopper would see
 * and links straight to the editor; the only other thing this page does is add
 * a new product.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { PackagePlus, PencilLine } from "lucide-react";
import { getAllCategories, getAllProducts } from "@mridul/database";
import { sessionClient } from "@mridul/supabase/server";
import { formatPaise } from "@mridul/utils";
import {
  createProduct,
  toggleProductActive,
  updateProductStock,
} from "../../actions/catalogue";
import { EditForm, Field, FieldRow, Select, TextArea } from "../../components/form";
import { InternalLink, MediaThumb, PageHead, Panel, Pill } from "../../components/ui";
import { StockEditor } from "../../components/stock-editor";

export const metadata: Metadata = { title: "Products | Mridul Admin" };

export default async function ProductsPage() {
  const db = await sessionClient();
  const [products, categories] = await Promise.all([getAllProducts(db), getAllCategories(db)]);

  const live = products.filter((product) => product.isActive).length;
  const outOfStock = products.filter((product) => product.stockTotal === 0).length;

  return (
    <>
      <PageHead
        title="Product catalogue"
        subtitle={`${products.length} saved · ${live} live · ${products.length - live} hidden · ${outOfStock} out of stock`}
      />

      <div className="catalogue-jump" aria-label="Product actions">
        <Link href="#existing-products">
          <PencilLine aria-hidden="true" /> Edit existing
        </Link>
        <Link href="#add-product">
          <PackagePlus aria-hidden="true" /> Add new product
        </Link>
      </div>

      <div id="existing-products" className="anchor-target" />
      <Panel
        title="Edit existing products"
        note="Hidden products stay saved here. They are faded so you can recognise and restore them."
      >
        <div className="product-admin-list">
          {products.map((product) => (
            <article
              className={`product-admin-row${!product.isActive ? " is-unlisted" : ""}`}
              key={product.id}
            >
              <div className="product-admin-image">
                <MediaThumb
                  url={product.images[0].url}
                  alt={product.images[0].alt}
                  focal={product.images[0].focal}
                  size={86}
                />
              </div>
              <div className="product-admin-info">
                <div className="product-admin-title">
                  <InternalLink href={`/products/${product.id}`}>{product.name}</InternalLink>
                  <Pill tone={product.isActive ? "ok" : "muted"}>
                    {product.isActive ? "Live" : "Hidden"}
                  </Pill>
                </div>
                <span>
                  {product.categorySlug || "No category"} · {product.fabric || "Fabric not set"}
                </span>
                <small>
                  {formatPaise(product.pricePaise)} · {product.stockTotal} units
                </small>
              </div>
              <div className="product-admin-actions">
                <Link className="btn-primary product-edit-link" href={`/products/${product.id}`}>
                  Edit everything
                </Link>
                <EditForm
                  action={toggleProductActive}
                  submitLabel={product.isActive ? "Hide from website" : "Put back on website"}
                  compact
                  danger={product.isActive}
                >
                  <input name="id" type="hidden" value={product.id} />
                  <input name="active" type="hidden" value={String(!product.isActive)} />
                </EditForm>
                <StockEditor
                  action={updateProductStock}
                  variants={product.variants.map((variant) => ({
                    id: variant.id,
                    label: variant.label,
                    stock: variant.stock,
                  }))}
                />
              </div>
            </article>
          ))}
        </div>
      </Panel>

      <div id="add-product" className="anchor-target" />
      <Panel
        title="Add a new product"
        note="It starts hidden, so you can finish details and photographs safely before publishing."
      >
        <EditForm action={createProduct} submitLabel="Create draft">
          <FieldRow>
            <Field label="Name" name="name" required placeholder="e.g. Saanjh Sage" />
            <Select
              label="Category"
              name="category_id"
              options={categories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
            />
          </FieldRow>
          <FieldRow>
            <Field label="Price" name="price" required hint="In rupees" placeholder="4650" />
            <Field
              label="Was price"
              name="compare_at"
              required
              hint="Struck through on the site. Higher than the price."
            />
          </FieldRow>
          <Field label="Subtitle" name="subtitle" placeholder="Saree with blouse piece" />
          <TextArea label="Description" name="description" rows={3} />
          <FieldRow>
            <Field label="Fabric" name="fabric" placeholder="Chanderi silk" />
            <Field label="Colour" name="colour_name" placeholder="Blush rose" />
          </FieldRow>
          <FieldRow>
            <Field label="Occasion" name="occasion" placeholder="Festive" />
            <Field label="Weave / technique" name="technique" placeholder="Handwoven" />
          </FieldRow>
          <Field
            label="First option"
            name="variant_label"
            placeholder="Saree only"
            hint="You can add more options after creating it"
          />
          <Field
            label="Opening stock"
            name="initial_stock"
            type="number"
            defaultValue={0}
            hint="Can be updated later"
          />
        </EditForm>
      </Panel>
    </>
  );
}

