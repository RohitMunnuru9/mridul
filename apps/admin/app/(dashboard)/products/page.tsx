/**
 * Products.
 *
 * A list you can act on, not a report. Each row shows what a shopper would see
 * and links straight to the editor; the only other thing this page does is add
 * a new product.
 */

import type { Metadata } from 'next';
import { getAllProducts, getCategories } from '@mridul/database';
import { formatPaise } from '@mridul/utils';
import { createProduct, toggleProductActive } from '../../actions/catalogue';
import { EditForm, Field, FieldRow, Select } from '../../components/form';
import {
  InternalLink,
  MediaThumb,
  PageHead,
  Panel,
  Pill,
  ViewOnSite,
} from '../../components/ui';

export const metadata: Metadata = { title: 'Products | Mridul Admin' };

const LOW_STOCK = 6;

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([getAllProducts(), getCategories()]);

  const live = products.filter((product) => product.isActive).length;
  const outOfStock = products.filter((product) => product.stockTotal === 0).length;

  return (
    <>
      <PageHead
        title="Products"
        subtitle={`${products.length} products · ${live} live · ${outOfStock} out of stock`}
      />

      <Panel title="Add a product" note="Starts as a draft so nothing appears before it has photographs.">
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
              label="Subtitle"
              name="subtitle"
              placeholder="Saree with blouse piece"
            />
          </FieldRow>
          <Field
            label="First option"
            name="variant_label"
            placeholder="Saree only"
            hint="You can add more options after creating it"
          />
        </EditForm>
      </Panel>

      {categories.map((category) => {
        const rows = products.filter(
          (product) => product.categorySlug === category.slug,
        );
        if (rows.length === 0) return null;

        return (
          <Panel key={category.id} title={category.name} note={`${rows.length} products`}>
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Product</th>
                  <th className="numeric">Price</th>
                  <th className="numeric">Stock</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <MediaThumb
                        url={product.images[0].url}
                        alt={product.images[0].alt}
                        focal={product.images[0].focal}
                        size={44}
                      />
                    </td>
                    <td>
                      <InternalLink href={`/products/${product.id}`}>
                        {product.name}
                      </InternalLink>
                      <small className="row-sub">
                        {product.fabric} · {product.colour.name}
                      </small>
                    </td>
                    <td className="numeric">{formatPaise(product.pricePaise)}</td>
                    <td className="numeric">
                      <Pill
                        tone={
                          product.stockTotal === 0
                            ? 'out'
                            : product.stockTotal <= LOW_STOCK
                              ? 'low'
                              : 'ok'
                        }
                      >
                        {product.stockTotal}
                      </Pill>
                    </td>
                    <td>
                      <EditForm
                        action={toggleProductActive}
                        submitLabel={product.isActive ? 'Hide' : 'Make live'}
                        compact
                      >
                        <input name="id" type="hidden" value={product.id} />
                        <input
                          name="active"
                          type="hidden"
                          value={String(!product.isActive)}
                        />
                      </EditForm>
                    </td>
                    <td>
                      <ViewOnSite href={`/product/${product.slug}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        );
      })}
    </>
  );
}
