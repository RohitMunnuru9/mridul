/**
 * Inventory.
 *
 * Variant-level, because that is the level stock actually moves at: a saree
 * can be sold out with its blouse piece and still available on its own, and a
 * blouse can be missing exactly one size.
 */

import type { Metadata } from 'next';
import { getInventoryRows } from '@mridul/database';
import { formatPaise } from '@mridul/utils';
import { InternalLink, PageHead, Panel, Pill, StatCard, ViewOnSite } from '../components/ui';

export const metadata: Metadata = { title: 'Inventory | Mridul Admin' };

const LOW_STOCK_THRESHOLD = 5;

export default async function InventoryPage() {
  const rows = await getInventoryRows();

  const soldOut = rows.filter((row) => row.stock === 0);
  const low = rows.filter((row) => row.stock > 0 && row.stock <= LOW_STOCK_THRESHOLD);
  const units = rows.reduce((total, row) => total + row.stock, 0);
  const value = rows.reduce((total, row) => total + row.stock * row.unitPricePaise, 0);

  const attention = [...low, ...soldOut].sort((a, b) => a.stock - b.stock);

  return (
    <>
      <PageHead
        title="Inventory"
        subtitle={`${rows.length} variants across the catalogue.`}
      />

      <dl className="stat-grid">
        <StatCard label="Units on hand" value={units} note="all variants" />
        <StatCard label="Stock value" value={formatPaise(value)} note="at list price" />
        <StatCard label="Low stock" value={low.length} note={`${LOW_STOCK_THRESHOLD} or fewer`} />
        <StatCard label="Sold out" value={soldOut.length} note="variants at zero" />
      </dl>

      <Panel
        title="Needs attention"
        note="Sold-out variants disable their option on the product page rather than failing at checkout."
      >
        {attention.length === 0 ? (
          <p className="panel-empty">Everything is comfortably stocked.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Option</th>
                <th>SKU</th>
                <th className="numeric">Stock</th>
                <th>Status</th>
                <th />
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
                  <td>
                    <code>{row.sku}</code>
                  </td>
                  <td className="numeric">{row.stock}</td>
                  <td>
                    <Pill tone={row.stock === 0 ? 'out' : 'low'}>
                      {row.stock === 0 ? 'Sold out' : 'Low'}
                    </Pill>
                  </td>
                  <td>
                    <ViewOnSite href={`/product/${row.productSlug}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="All variants">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Option</th>
              <th>SKU</th>
              <th className="numeric">Sells at</th>
              <th className="numeric">Stock</th>
              <th className="numeric">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.variantId}>
                <td>
                  <InternalLink href={`/products/${row.productId}`}>
                    {row.productName}
                  </InternalLink>
                </td>
                <td>{row.categorySlug}</td>
                <td>{row.variantLabel}</td>
                <td>
                  <code>{row.sku}</code>
                </td>
                <td className="numeric">{formatPaise(row.unitPricePaise)}</td>
                <td className="numeric">{row.stock}</td>
                <td className="numeric">{formatPaise(row.stock * row.unitPricePaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="How stock will move" note="Once orders exist.">
        <div className="prose">
          <p>
            Stock is deducted after a payment is verified server-side, never when an
            item enters a bag — an abandoned bag must not hold inventory. Cancelled
            and refunded orders return their units.
          </p>
        </div>
      </Panel>
    </>
  );
}
