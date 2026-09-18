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

type Row = {
  productId: string;
  productName: string;
  variantId: string;
  variantLabel: string;
  unitPricePaise: number;
  stock: number;
};

/** How much is left, in the words the shop uses rather than a bare number. */
function Status({ stock }: { stock: number }) {
  return (
    <Pill tone={stock === 0 ? 'out' : stock <= LOW ? 'low' : 'ok'}>
      {stock === 0 ? 'Out of stock' : `${stock} left`}
    </Pill>
  );
}

/**
 * Written once and rendered in both layouts, so the two can never drift into
 * disagreeing about what a save sends — `on_hand_was` in particular, which is
 * what stops a save writing over a sale.
 */
function SetStock({ row }: { row: Row }) {
  return (
    <EditForm action={updateStock} submitLabel="Save" compact>
      <input name="variant_id" type="hidden" value={row.variantId} />
      {/* The count this row was drawn with. Sent back so the save can refuse
          if a sale moved it in the meantime, rather than quietly writing over
          the sale. */}
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
  );
}

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
        {/*
          Two layouts for the same rows, one shown at a time.
          
          Five columns do not fit a phone. Scrolling the table sideways kept
          them all, but put the one control that matters — the stock box — off
          the right edge of a page that gives no sign it continues, which is
          how you end up with an inventory screen you cannot edit on the thing
          you carry to the shelf.
          
          The hidden one is `display: none`, so a screen reader is given
          whichever layout is actually on screen, not both.
        */}
        <table className="inventory-table">
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
                  <Status stock={row.stock} />
                </td>
                <td>
                  <SetStock row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="inventory-cards">
          {sorted.map((row) => (
            <li key={row.variantId}>
              <div className="inventory-card-head">
                <InternalLink href={`/products/${row.productId}`}>
                  {row.productName}
                </InternalLink>
                <Status stock={row.stock} />
              </div>
              <p className="inventory-card-meta">
                {row.variantLabel}
                <span aria-hidden="true">·</span>
                <span className="inventory-card-price">
                  {formatPaise(row.unitPricePaise)}
                </span>
              </p>
              <div className="inventory-card-set">
                <span>Set stock</span>
                <SetStock row={row} />
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
