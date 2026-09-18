/**
 * What the Start page decides needs doing.
 *
 * These are the rules a shop owner reads first thing: what counts as urgent,
 * how long a parcel may be out before it is worth a look, when a low count is
 * "low". Worth pinning down, because the page is only useful if it is right
 * about what to put at the top.
 */

import { describe, expect, it } from 'vitest';
import {
  attentionItems,
  LOW_STOCK,
  STALE_SHIPMENT_DAYS,
  type Coupon,
  type Order,
  type ReturnRequest,
} from '@mridul/database';
import type { JournalPost } from '@mridul/types';

const NOW = new Date('2026-09-18T12:00:00Z');
const day = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * day).toISOString();

function order(over: Partial<Order>): Order {
  return {
    id: 'o1',
    status: 'confirmed',
    paymentMethod: 'cod',
    updatedAt: ago(1),
    payment: null,
    shipment: null,
    ...over,
  } as Order;
}

function request(over: Partial<ReturnRequest>): ReturnRequest {
  return { id: 'r1', orderId: 'o1', status: 'requested', items: [], ...over } as ReturnRequest;
}

function post(over: Partial<JournalPost>): JournalPost {
  return { id: 'p1', body: '', isPublished: true, ...over } as JournalPost;
}

function coupon(over: Partial<Coupon>): Coupon {
  return {
    id: 'c1', code: 'X', description: '', percentOff: 10, amountOffPaise: null,
    minSubtotalPaise: 0, maxRedemptions: null, redemptionCount: 0,
    startsAt: null, endsAt: null, isActive: true, createdAt: ago(9),
    ...over,
  };
}

const empty = { orders: [], returns: [], stock: [], posts: [], coupons: [], products: [], now: NOW };

describe('attentionItems', () => {
  it('reports nothing for a quiet shop', () => {
    expect(attentionItems(empty)).toEqual([]);
  });

  it('puts an unpaid online order at the top, above everything', () => {
    const items = attentionItems({
      ...empty,
      orders: [order({ id: 'a', status: 'pending_payment', paymentMethod: 'ccavenue' })],
      stock: [{ stock: 0 }],
      products: [{ isActive: false }],
    });
    expect(items[0].key).toBe('unpaid');
    expect(items[0].tone).toBe('urgent');
  });

  it('does not treat a cash order as unpaid-and-holding', () => {
    // A COD order is never in pending_payment; if one somehow were, it is not
    // the online-money problem this line is for.
    const items = attentionItems({
      ...empty,
      orders: [order({ status: 'pending_payment', paymentMethod: 'cod' })],
    });
    expect(items.find((i) => i.key === 'unpaid')).toBeUndefined();
  });

  it('counts orders to pack only when they are paid for', () => {
    const items = attentionItems({
      ...empty,
      orders: [
        order({ id: 'cash', status: 'confirmed', paymentMethod: 'cod' }),
        order({
          id: 'card-unverified', status: 'confirmed', paymentMethod: 'ccavenue',
          payment: { provider: 'ccavenue', status: 'paid', method: null, amountPaise: 1,
                     verifiedAt: null, providerPaymentId: null, providerReference: null },
        }),
      ],
    });
    const pack = items.find((i) => i.key === 'to_pack');
    expect(pack?.count).toBe(1);
  });

  it('links straight to the order when there is exactly one', () => {
    const items = attentionItems({ ...empty, orders: [order({ id: 'only', status: 'confirmed' })] });
    expect(items.find((i) => i.key === 'to_pack')?.href).toBe('/orders/only');
  });

  it('links to the filtered list when there are several', () => {
    const items = attentionItems({
      ...empty,
      orders: [order({ id: 'a', status: 'confirmed' }), order({ id: 'b', status: 'processing' })],
    });
    expect(items.find((i) => i.key === 'to_pack')?.href).toBe('/orders?status=confirmed');
  });

  it('flags a parcel out for more than the threshold, and not one inside it', () => {
    const items = attentionItems({
      ...empty,
      orders: [
        order({ id: 'old', status: 'shipped',
                shipment: { provider: 'X', awb: '1', trackingUrl: null,
                            shippedAt: ago(STALE_SHIPMENT_DAYS + 1), deliveredAt: null } }),
        order({ id: 'fresh', status: 'shipped',
                shipment: { provider: 'X', awb: '2', trackingUrl: null,
                            shippedAt: ago(STALE_SHIPMENT_DAYS - 1), deliveredAt: null } }),
      ],
    });
    const stale = items.find((i) => i.key === 'stale_shipments');
    expect(stale?.count).toBe(1);
    expect(stale?.href).toBe('/orders/old');
  });

  it('is not stale exactly ON the threshold day', () => {
    const items = attentionItems({
      ...empty,
      orders: [order({ status: 'shipped', shipment: { provider: 'X', awb: '1', trackingUrl: null,
                       shippedAt: ago(STALE_SHIPMENT_DAYS), deliveredAt: null } })],
    });
    expect(items.find((i) => i.key === 'stale_shipments')).toBeUndefined();
  });

  it('falls back to the order date when a shipment has no dispatch date', () => {
    const items = attentionItems({
      ...empty,
      orders: [order({ status: 'shipped', shipment: null, updatedAt: ago(10) })],
    });
    expect(items.find((i) => i.key === 'stale_shipments')?.count).toBe(1);
  });

  it('separates out-of-stock from running-low at the boundary', () => {
    const items = attentionItems({
      ...empty,
      stock: [{ stock: 0 }, { stock: LOW_STOCK }, { stock: LOW_STOCK + 1 }, { stock: 1 }],
    });
    expect(items.find((i) => i.key === 'out_of_stock')?.count).toBe(1);
    expect(items.find((i) => i.key === 'low_stock')?.count).toBe(2);
  });

  it('ranks a waiting return as urgent and an unrefunded one too', () => {
    const items = attentionItems({
      ...empty,
      returns: [request({ status: 'requested', orderId: 'w' }), request({ id: 'r2', status: 'approved', orderId: 'a' })],
    });
    expect(items.find((i) => i.key === 'returns_waiting')?.href).toBe('/orders/w');
    expect(items.find((i) => i.key === 'refunds_owed')?.tone).toBe('urgent');
  });

  it('ignores returns already declined or refunded', () => {
    const items = attentionItems({
      ...empty,
      returns: [request({ status: 'declined' }), request({ id: 'r2', status: 'refunded' })],
    });
    expect(items.filter((i) => i.key.startsWith('return') || i.key === 'refunds_owed')).toEqual([]);
  });

  it('counts only live discount codes, not switched-off or expired ones', () => {
    const items = attentionItems({
      ...empty,
      coupons: [coupon({}), coupon({ id: 'c2', isActive: false }), coupon({ id: 'c3', endsAt: ago(1) })],
    });
    expect(items.find((i) => i.key === 'coupons_live')?.count).toBe(1);
  });

  it('separates published posts with no story from drafts', () => {
    const items = attentionItems({
      ...empty,
      posts: [post({}), post({ id: 'p2', body: 'A story.' }), post({ id: 'p3', isPublished: false })],
    });
    expect(items.find((i) => i.key === 'journal_no_story')?.count).toBe(1);
    expect(items.find((i) => i.key === 'journal_drafts')?.count).toBe(1);
  });

  it('orders urgent, then soon, then note; bigger counts first within a tone', () => {
    const items = attentionItems({
      ...empty,
      orders: [order({ id: 'a', status: 'packed' })],
      stock: [{ stock: 0 }, { stock: 0 }, { stock: 0 }, { stock: 1 }],
      returns: [request({})],
      products: [{ isActive: false }],
    });
    const tones = items.map((i) => i.tone);
    const firstSoon = tones.indexOf('soon');
    const firstNote = tones.indexOf('note');
    expect(tones.lastIndexOf('urgent')).toBeLessThan(firstSoon);
    expect(tones.lastIndexOf('soon')).toBeLessThan(firstNote);
    // Within 'soon': three out of stock outranks one packed parcel.
    const soon = items.filter((i) => i.tone === 'soon').map((i) => i.key);
    expect(soon[0]).toBe('out_of_stock');
  });

  it('never counts a closed order as anything', () => {
    const items = attentionItems({
      ...empty,
      orders: [
        order({ status: 'cancelled' }),
        order({ id: 'b', status: 'refunded', paymentMethod: 'ccavenue' }),
      ],
    });
    expect(items).toEqual([]);
  });

  it('puts the number inside the sentence and pluralises it', () => {
    const one = attentionItems({ ...empty, orders: [order({ status: 'confirmed' })] });
    const two = attentionItems({ ...empty, orders: [order({ id: 'a', status: 'confirmed' }), order({ id: 'b', status: 'confirmed' })] });
    expect(one[0].title).toBe('1 order to pack');
    expect(two[0].title).toBe('2 orders to pack');
  });
});
