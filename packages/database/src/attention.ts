/**
 * What needs doing today.
 *
 * The admin has grown a lot of places where something can be waiting — an
 * unpaid order holding a saree, a return nobody has answered, a parcel that
 * left a fortnight ago and was never marked delivered — and no single place
 * that says so. This turns what the shop already knows into a short ranked
 * list, and nothing more: every item links to the page where it is dealt
 * with.
 *
 * Pure on purpose. It is handed rows and returns sentences, so the rules —
 * how long a parcel may be out before it is worth a look, what counts as low
 * stock — can be pinned down in tests rather than discovered on a Monday.
 */

import type { JournalPost } from '@mridul/types';
import type { Coupon } from './coupons';
import { couponState } from './coupons';
import type { Order } from './orders';
import { readyToSend } from './packing';
import type { ReturnRequest } from './returns';

export type AttentionTone = 'urgent' | 'soon' | 'note';

export type Attention = {
  key: string;
  count: number;
  /** "3 orders to pack" — the number is in the sentence, not beside it. */
  title: string;
  /** What to do about it. */
  detail: string;
  href: string;
  tone: AttentionTone;
};

/** Below this, an option is "running low". Matches the inventory page. */
export const LOW_STOCK = 5;

/** A parcel out longer than this without being marked delivered is worth a
 *  look: either it arrived and nobody said so, or it is lost. */
export const STALE_SHIPMENT_DAYS = 7;

export type StockRow = { stock: number };

export type AttentionInput = {
  orders: Order[];
  returns: ReturnRequest[];
  stock: StockRow[];
  posts: JournalPost[];
  coupons: Coupon[];
  products: { isActive: boolean }[];
  now?: Date;
};

const TONE_RANK: Record<AttentionTone, number> = { urgent: 0, soon: 1, note: 2 };

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function daysBetween(from: string, to: Date): number {
  return (to.getTime() - new Date(from).getTime()) / 86_400_000;
}

export function attentionItems(input: AttentionInput): Attention[] {
  const now = input.now ?? new Date();
  const items: Attention[] = [];

  const open = input.orders.filter(
    (order) => !['cancelled', 'returned', 'refunded'].includes(order.status),
  );

  // ---- money and stock held hostage -------------------------------------
  const unpaid = open.filter(
    (order) => order.paymentMethod !== 'cod' && order.status === 'pending_payment',
  );
  if (unpaid.length > 0) {
    items.push({
      key: 'unpaid',
      count: unpaid.length,
      title: `${plural(unpaid.length, 'order', 'orders')} unpaid, holding stock`,
      detail:
        'The pieces are off the shelf for a sale that has not happened. Cancel any that are not going to pay.',
      href: unpaid.length === 1 ? `/orders/${unpaid[0].id}` : '/orders?status=pending_payment',
      tone: 'urgent',
    });
  }

  // ---- returns ---------------------------------------------------------------
  const waiting = input.returns.filter((request) => request.status === 'requested');
  if (waiting.length > 0) {
    items.push({
      key: 'returns_waiting',
      count: waiting.length,
      title: `${plural(waiting.length, 'return', 'returns')} waiting for an answer`,
      detail: 'A customer has asked and is watching their order page for your reply.',
      href: waiting.length === 1 ? `/orders/${waiting[0].orderId}` : '/orders?status=delivered',
      tone: 'urgent',
    });
  }

  const owed = input.returns.filter((request) => request.status === 'approved');
  if (owed.length > 0) {
    items.push({
      key: 'refunds_owed',
      count: owed.length,
      title: `${plural(owed.length, 'approved return', 'approved returns')} not yet refunded`,
      detail: 'Once the money has gone back, record it on the order so the customer can see.',
      href: owed.length === 1 ? `/orders/${owed[0].orderId}` : '/orders?status=delivered',
      tone: 'urgent',
    });
  }

  // ---- the pipeline ----------------------------------------------------------
  const toPack = open.filter(
    (order) =>
      ['confirmed', 'processing'].includes(order.status) &&
      readyToSend(order),
  );
  if (toPack.length > 0) {
    items.push({
      key: 'to_pack',
      count: toPack.length,
      title: `${plural(toPack.length, 'order', 'orders')} to pack`,
      detail: 'Paid for and waiting. Check, press, pack, then dispatch from the order.',
      // More than one and the useful destination is the printer, not a
      // filtered list: Packing is where these become parcels.
      href: toPack.length === 1 ? `/orders/${toPack[0].id}` : '/packing',
      tone: 'urgent',
    });
  }

  const packed = open.filter((order) => order.status === 'packed');
  if (packed.length > 0) {
    items.push({
      key: 'packed',
      count: packed.length,
      title: `${plural(packed.length, 'parcel', 'parcels')} packed, waiting for the courier`,
      detail: 'Enter the tracking number when it is collected and the customer is told.',
      href: packed.length === 1 ? `/orders/${packed[0].id}` : '/orders?status=packed',
      tone: 'soon',
    });
  }

  const stale = open.filter((order) => {
    if (!['shipped', 'out_for_delivery'].includes(order.status)) return false;
    const since = order.shipment?.shippedAt ?? order.updatedAt;
    return daysBetween(since, now) > STALE_SHIPMENT_DAYS;
  });
  if (stale.length > 0) {
    items.push({
      key: 'stale_shipments',
      count: stale.length,
      title: `${plural(stale.length, 'parcel', 'parcels')} out for more than a week`,
      detail:
        'Either it arrived and was never marked delivered, or it is worth chasing the courier.',
      href: stale.length === 1 ? `/orders/${stale[0].id}` : '/orders?status=shipped',
      tone: 'soon',
    });
  }

  // ---- the shelf -------------------------------------------------------------
  const out = input.stock.filter((row) => row.stock === 0).length;
  if (out > 0) {
    items.push({
      key: 'out_of_stock',
      count: out,
      title: `${plural(out, 'option', 'options')} out of stock`,
      detail: 'Shown as sold out on the site. Restock, or hide the product.',
      href: '/inventory',
      tone: 'soon',
    });
  }

  const low = input.stock.filter((row) => row.stock > 0 && row.stock <= LOW_STOCK).length;
  if (low > 0) {
    items.push({
      key: 'low_stock',
      count: low,
      title: `${plural(low, 'option', 'options')} running low`,
      detail: `${LOW_STOCK} or fewer left. Worth knowing before the next order takes the last one.`,
      href: '/inventory',
      tone: 'note',
    });
  }

  // ---- what the site is saying -----------------------------------------------
  const liveCodes = input.coupons.filter((coupon) => couponState(coupon, now).live).length;
  if (liveCodes > 0) {
    items.push({
      key: 'coupons_live',
      count: liveCodes,
      title: `${plural(liveCodes, 'discount code works', 'discount codes work')} right now`,
      detail: 'Anyone who knows the words can use them at checkout. Make sure that is all of them.',
      href: '/coupons',
      tone: 'note',
    });
  }

  const noStory = input.posts.filter((post) => post.isPublished && !post.body.trim()).length;
  if (noStory > 0) {
    items.push({
      key: 'journal_no_story',
      count: noStory,
      title: `${plural(noStory, 'journal post says', 'journal posts say')} “Read the story” with nothing to read`,
      detail: 'Each one currently sends people to a listing instead. Write the story, or leave it.',
      href: '/journal',
      tone: 'note',
    });
  }

  const drafts = input.posts.filter((post) => !post.isPublished).length;
  if (drafts > 0) {
    items.push({
      key: 'journal_drafts',
      count: drafts,
      title: `${plural(drafts, 'journal draft', 'journal drafts')} not yet published`,
      detail: 'Only you can see them.',
      href: '/journal',
      tone: 'note',
    });
  }

  const hidden = input.products.filter((product) => !product.isActive).length;
  if (hidden > 0) {
    items.push({
      key: 'hidden_products',
      count: hidden,
      title: `${plural(hidden, 'product', 'products')} hidden from the site`,
      detail: 'Saved but not for sale. Fine if that is on purpose.',
      href: '/products#existing-products',
      tone: 'note',
    });
  }

  // Urgent first; within a tone, the bigger number first.
  return items.sort(
    (a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone] || b.count - a.count,
  );
}
