/**
 * Inventory.
 *
 * Every option in one editable list, sorted so the ones needing attention are
 * at the top. Set a count to 0 to mark it out of stock.
 */

import type { Metadata } from 'next';
import { getInventoryRows } from '@mridul/database';
import { sessionClient } from '@mridul/supabase/server';
import { formatPaise } from '@mridul/utils';
import { updateStock } from '../../actions/catalogue';
import { EditForm } from '../../components/form';
import { InternalLink, PageHead, Panel, Pill } from '../../components/ui';

export const metadata: Metadata = { title: 'Inventory | Mridul Admin' };

const LOW = 5;

export default async function InventoryPage() {
  const db = await sessionClient();
  const rows = await getInventoryRows(db);

  // Lowest first: the rows that need a decision should not be hunted for.
  const sorted = [...rows].sort((a, b) => a.stock - b.stock);
  const units = rows.reduce((total, row) => total + row.stock, 0);
  const out = rows.filter((row) => row.stock === 0).length;

  return (
    <>
      <PageHead
        title="Inventory"
        subtitle={`${units} units across ${rows.length} options · ${out} out of stock`}
      />

      <Panel title="All options" note="Lowest stock first. Type a new count and save.">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Option</th>
              <th className="numeric">Sells at</th>
              <th>Status</th>
              <th>Set stock</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.variantId}>
                <td>
                  <InternalLink href={`/products/${row.productId}`}>
                    {row.productName}
                  </InternalLink>
                </td>
                <td>{row.variantLabel}</td>
                <td className="numeric">{formatPaise(row.unitPricePaise)}</td>
                <td>
                  <Pill tone={row.stock === 0 ? 'out' : row.stock <= LOW ? 'low' : 'ok'}>
                    {row.stock === 0 ? 'Out of stock' : `${row.stock} left`}
                  </Pill>
                </td>
                <td>
                  <EditForm action={updateStock} submitLabel="Save" compact>
                    <input name="variant_id" type="hidden" value={row.variantId} />
                    {/* The count this row was drawn with. Sent back so the
                        save can refuse if a sale moved it in the meantime,
                        rather than quietly writing over the sale. */}
                    <input name="on_hand_was" type="hidden" value={row.stock} />
                    <input
                      aria-label={`Stock for ${row.productName} ${row.variantLabel}`}
                      className="stock-input"
                      defaultValue={row.stock}
                      min={0}
                      name="on_hand"
                      type="number"
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
