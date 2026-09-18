/**
 * What goes in the box, and what goes on the outside of it.
 *
 * The admin could already tell the shop that an order was ready and could
 * record the tracking number afterwards, but the step in between — writing the
 * address onto the parcel and putting a note inside it — happened on paper,
 * copied by hand off a screen. A mistyped pincode is a saree that comes back a
 * fortnight later; a mistyped cash-on-delivery figure is money simply lost.
 *
 * So this turns an order into the two documents a parcel needs, and decides
 * the things that are costly to get wrong:
 *
 *   - how much cash, if any, the courier must collect at the door,
 *   - whether this order should be going in a box at all,
 *   - which of the two notes on an order the customer is allowed to see.
 *
 * Pure on purpose, and it formats no money: amounts stay as paise so the rules
 * can be checked against numbers rather than against strings with a rupee sign
 * in them.
 */

import type { Order, OrderAddress } from './orders';
import { isPaidFor } from './orders';

export type SlipLine = {
  id: string;
  name: string;
  variantLabel: string;
  sku: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
};

export type SlipTotal = {
  label: string;
  amountPaise: number;
  /** Shown as a deduction rather than a charge. */
  negative?: boolean;
  /** The figure the whole slip is about. */
  emphasis?: boolean;
  /** Said instead of the amount. "₹0.00" for postage reads as a fault. */
  text?: string;
};

export type PackingSlip = {
  orderId: string;
  number: string;
  placedAt: string;
  /** Who the parcel is for, kept out of the address lines so a label can
   *  print it larger than the rest. */
  name: string;
  addressLines: string[];
  pincode: string;
  phone: string;
  /** Sorted for picking, not in the order they were added to the bag. */
  lines: SlipLine[];
  /** How many individual pieces should be in the box when it is sealed. */
  pieces: number;
  totals: SlipTotal[];
  /** Cash the courier must collect, or null when there is nothing to collect. */
  collectPaise: number | null;
  paymentLine: string;
  /** The customer's own words from checkout. Never the shop's private note. */
  customerNote: string | null;
  /** Set when this parcel should not be made up at all. */
  warning: string | null;
};

/**
 * Whether the money question is settled well enough to put this in a box.
 *
 * Cash on delivery is settled by definition — the money arrives with the
 * parcel. Anything else has to have actually been paid, by the same test the
 * database applies before it will accept a dispatch, so a screen can never
 * offer to send something Postgres would refuse to mark as sent.
 */
export function readyToSend(order: Order): boolean {
  return order.paymentMethod === 'cod' || isPaidFor(order);
}

/** The address as it should be written on a parcel, with no blank lines. */
export function deliveryLines(address: OrderAddress): string[] {
  return [
    address.line1,
    address.line2 ?? '',
    address.landmark ? `Near ${address.landmark}` : '',
    [address.city, address.state].filter(Boolean).join(', '),
  ]
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function totalsFor(order: Order): SlipTotal[] {
  const totals: SlipTotal[] = [
    { label: 'Subtotal', amountPaise: order.subtotalPaise },
  ];

  if (order.discountPaise > 0) {
    totals.push({
      label: order.couponCode ? `Discount (${order.couponCode})` : 'Discount',
      amountPaise: order.discountPaise,
      negative: true,
    });
  }

  totals.push({
    label: 'Delivery',
    amountPaise: order.shippingPaise,
    // A shop that prints "₹0.00" beside Delivery looks like it failed to
    // charge. It didn't: it gave the postage away, and should say so.
    text: order.shippingPaise === 0 ? 'Free' : undefined,
  });

  totals.push({ label: 'Total', amountPaise: order.totalPaise, emphasis: true });
  return totals;
}

function warningFor(order: Order): string | null {
  if (order.status === 'cancelled') {
    return 'This order was cancelled. Nothing should be packed.';
  }
  if (order.status === 'returned' || order.status === 'refunded') {
    return `This order was ${order.status}. Nothing should be packed.`;
  }
  if (!readyToSend(order)) {
    return 'The money for this order has not arrived. Nothing should be packed.';
  }
  return null;
}

function paymentLineFor(order: Order, collectPaise: number | null): string {
  if (collectPaise !== null) return 'Cash on delivery — collect the full amount';
  if (order.paymentMethod === 'cod') return 'Cash on delivery — already collected';
  if (isPaidFor(order)) return 'Paid online — collect nothing';
  return 'Payment not received';
}

export function packingSlip(order: Order): PackingSlip {
  /*
   * Cash to collect is the single most expensive figure on the page, so it is
   * derived rather than assumed: only a cash order owes anything at the door,
   * and only until it has actually been collected. Everything paid online
   * collects nothing, and saying so in as many words is the point — a blank
   * space beside "collect" is what gets a customer charged twice.
   */
  const collectPaise =
    order.paymentMethod === 'cod' && !isPaidFor(order) ? order.totalPaise : null;

  const lines: SlipLine[] = order.lines
    .map((line) => ({
      id: line.id,
      name: line.name,
      variantLabel: line.variantLabel,
      sku: line.sku,
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
      lineTotalPaise: line.lineTotalPaise,
    }))
    // Picked off a shelf, not read down a receipt: two colours of the same
    // saree should be next to each other in the hand as well as on the page.
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name) || a.variantLabel.localeCompare(b.variantLabel),
    );

  return {
    orderId: order.id,
    number: order.number,
    placedAt: order.placedAt,
    name: order.address.fullName,
    addressLines: deliveryLines(order.address),
    pincode: order.address.pincode,
    phone: order.phone ?? order.address.phone,
    lines,
    pieces: lines.reduce((count, line) => count + line.quantity, 0),
    totals: totalsFor(order),
    collectPaise,
    paymentLine: paymentLineFor(order, collectPaise),
    // `staffNotes` is deliberately not reachable from here. It is where the
    // shop writes things about a customer, and it must not travel in the
    // customer's own parcel.
    customerNote: order.notes?.trim() || null,
    warning: warningFor(order),
  };
}

/**
 * The parcels waiting to be made up, oldest first.
 *
 * Oldest first because the point of a pick list is the person who has been
 * waiting longest, which is the opposite of every other list in the admin.
 */
export function packingQueue(orders: Order[]): Order[] {
  return orders
    .filter(
      (order) =>
        ['confirmed', 'processing', 'packed'].includes(order.status) &&
        readyToSend(order),
    )
    .slice()
    .sort((a, b) => a.placedAt.localeCompare(b.placedAt));
}
