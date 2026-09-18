/**
 * The paper that goes out with a parcel.
 *
 * One A4 sheet per order: an address label at the top to cut out and stick on
 * the box, and a delivery note underneath to drop inside it. Both are drawn
 * from the same `packingSlip`, so the figure a courier is told to collect and
 * the figure the customer reads in the box are the same figure by
 * construction rather than by proofreading.
 *
 * Nothing about the shop is written into this file. The name, the number to
 * ring and the return window all arrive as props from Settings, so changing
 * them changes the parcels without a deploy.
 */

import type { PackingSlip } from '@mridul/database';
import type { SiteSettings } from '@mridul/types';
import { formatDate, formatPaise, isPlaceholderPhone } from '@mridul/utils';

export type ShopDetails = {
  brandName: string;
  /** Already checked for the placeholder number; null means print nothing. */
  phone: string | null;
  email: string;
  returnWindowDays: number;
};

function AddressLabel({ slip, shop }: { slip: PackingSlip; shop: ShopDetails }) {
  return (
    <section className="label" aria-label="Address label">
      <header className="label-head">
        <span className="label-from">
          From <strong>{shop.brandName}</strong>
          {shop.phone && <> · {shop.phone}</>}
        </span>
        <span className="label-order">{slip.number}</span>
      </header>

      <div className="label-to">
        <span className="label-tag">Deliver to</span>
        <strong className="label-name">{slip.name}</strong>
        {slip.addressLines.map((line) => (
          <span className="label-line" key={line}>
            {line}
          </span>
        ))}
        {/*
          The pincode decides which van the parcel gets on, and it is the one
          thing on a label that is read by somebody in a hurry. It is set
          larger than the address it belongs to for that reason alone.
        */}
        <span className="label-pin">PIN {slip.pincode}</span>
        <span className="label-phone">{slip.phone}</span>
      </div>

      {slip.collectPaise === null ? (
        <p className="label-money is-prepaid">
          <span>{slip.paymentLine}</span>
        </p>
      ) : (
        <p className="label-money is-cash">
          <span>Collect on delivery</span>
          <strong>{formatPaise(slip.collectPaise)}</strong>
        </p>
      )}
    </section>
  );
}

function DeliveryNote({ slip, shop }: { slip: PackingSlip; shop: ShopDetails }) {
  return (
    <section className="note" aria-label="Delivery note">
      <header className="note-head">
        <div>
          <strong>{shop.brandName}</strong>
          <span>Delivery note</span>
        </div>
        <div className="note-ref">
          <strong>{slip.number}</strong>
          <span>Ordered {formatDate(slip.placedAt)}</span>
        </div>
      </header>

      <table className="note-items">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Packed</span>
            </th>
            <th scope="col">Piece</th>
            <th scope="col">Code</th>
            <th className="numeric" scope="col">
              Qty
            </th>
            <th className="numeric" scope="col">
              Each
            </th>
            <th className="numeric" scope="col">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {slip.lines.map((line) => (
            <tr key={line.id}>
              {/* Ticked by hand at the table as each piece goes in. A box to
                  draw in, so it is named for anyone who cannot see it. */}
              <td aria-label={`Tick when ${line.name} is in the box`}>
                <span className="tickbox" aria-hidden="true" />
              </td>
              <td>
                <strong>{line.name}</strong>
                {line.variantLabel && <small>{line.variantLabel}</small>}
              </td>
              <td className="note-sku">{line.sku}</td>
              <td className="numeric">{line.quantity}</td>
              <td className="numeric">{formatPaise(line.unitPricePaise)}</td>
              <td className="numeric">{formatPaise(line.lineTotalPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="note-foot">
        <p className="note-count">
          <strong>
            {slip.pieces} {slip.pieces === 1 ? 'piece' : 'pieces'}
          </strong>{' '}
          should be in this parcel.
        </p>

        <dl className="note-totals">
          {slip.totals.map((row) => (
            <div className={row.emphasis ? 'is-total' : undefined} key={row.label}>
              <dt>{row.label}</dt>
              <dd>
                {row.text ??
                  `${row.negative ? '− ' : ''}${formatPaise(row.amountPaise)}`}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="note-payment">{slip.paymentLine}</p>

      {slip.customerNote && (
        <p className="note-message">
          <span>Their note</span>
          {slip.customerNote}
        </p>
      )}

      <footer className="note-thanks">
        <p>
          Thank you for buying from {shop.brandName}. If something is not right,
          write to {shop.email}
          {shop.phone ? ` or message ${shop.phone}` : ''} within{' '}
          {shop.returnWindowDays} days of delivery and we will put it right.
        </p>
      </footer>
    </section>
  );
}

/** One order's paper: the label to stick on, the note to put in. */
export function ParcelSheet({ slip, shop }: { slip: PackingSlip; shop: ShopDetails }) {
  return (
    <article className="sheet">
      {slip.warning && (
        <p className="sheet-warning" role="alert">
          <strong>Stop.</strong> {slip.warning}
        </p>
      )}
      <AddressLabel slip={slip} shop={shop} />
      <p className="sheet-cut" aria-hidden="true">
        cut here
      </p>
      <DeliveryNote slip={slip} shop={shop} />
    </article>
  );
}

/**
 * The shop's own details, from Settings rather than from this file.
 *
 * The WhatsApp number is seeded as a placeholder and stays that way until
 * somebody saves a real one. A return address carrying a number that rings
 * nobody is worse than one carrying no number at all, so it is dropped until
 * it is real — the same decision every other surface makes about it.
 */
export function shopDetails(settings: SiteSettings): ShopDetails {
  return {
    brandName: settings.brandName,
    phone: isPlaceholderPhone(settings.contact.whatsapp)
      ? null
      : settings.contact.whatsapp,
    email: settings.contact.email,
    returnWindowDays: settings.returnWindowDays,
  };
}
