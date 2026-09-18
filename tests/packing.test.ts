/**
 * The two documents a parcel needs.
 *
 * Three things here are expensive to get wrong and cheap to pin down: the cash
 * a courier is told to collect, whether a parcel should be made up at all, and
 * which of the two notes on an order travels inside it. Each has its own
 * failure — charging a customer twice, posting a saree nobody paid for, and
 * putting the shop's private remarks about somebody into their own box.
 */

import { describe, expect, it } from 'vitest';
import {
  deliveryLines,
  packingQueue,
  packingSlip,
  readyToSend,
  type Order,
  type OrderAddress,
  type OrderLine,
  type OrderPayment,
} from '@mridul/database';

const ADDRESS: OrderAddress = {
  fullName: 'Lakshmi Iyer',
  phone: '+91 98765 43210',
  line1: '12 Nungambakkam High Road',
  line2: 'Flat 3B',
  landmark: 'the Kapaleeshwarar temple',
  city: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '600034',
};

function line(over: Partial<OrderLine> = {}): OrderLine {
  return {
    id: 'l1',
    productId: 'p1',
    productSlug: 'kanjivaram',
    name: 'Kanjivaram silk',
    variantLabel: 'Ink blue',
    sku: 'KAN-001',
    imageUrl: null,
    quantity: 1,
    unitPricePaise: 1_250_000,
    lineTotalPaise: 1_250_000,
    ...over,
  };
}

function paid(over: Partial<OrderPayment> = {}): OrderPayment {
  return {
    provider: 'ccavenue',
    status: 'paid',
    method: 'upi',
    amountPaise: 1_250_000,
    verifiedAt: '2026-09-17T10:00:00Z',
    providerPaymentId: 'pay_1',
    providerReference: null,
    ...over,
  };
}

function order(over: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    number: 'MBM-1001',
    customerId: null,
    status: 'confirmed',
    paymentMethod: 'cod',
    placedAt: '2026-09-17T09:00:00Z',
    updatedAt: '2026-09-17T09:00:00Z',
    confirmedAt: '2026-09-17T09:00:00Z',
    cancelledAt: null,
    email: 'lakshmi@example.com',
    phone: null,
    subtotalPaise: 1_250_000,
    discountPaise: 0,
    shippingPaise: 0,
    totalPaise: 1_250_000,
    couponCode: null,
    notes: null,
    staffNotes: null,
    address: ADDRESS,
    lines: [line()],
    payment: null,
    shipment: null,
    ...over,
  };
}

describe('readyToSend', () => {
  it('lets cash on delivery through, because the money arrives with the parcel', () => {
    expect(readyToSend(order({ paymentMethod: 'cod', payment: null }))).toBe(true);
  });

  it('refuses an online order whose payment was never verified', () => {
    // A `paid` row is not enough. This is the same test the database applies
    // before it will accept a dispatch, so the screen cannot offer to send
    // something Postgres would refuse to mark as sent.
    expect(
      readyToSend(
        order({ paymentMethod: 'ccavenue', payment: paid({ verifiedAt: null }) }),
      ),
    ).toBe(false);
  });

  it('allows an online order once it has been verified', () => {
    expect(
      readyToSend(order({ paymentMethod: 'ccavenue', payment: paid() })),
    ).toBe(true);
  });
});

describe('cash to collect', () => {
  it('is the whole total for a cash order that has not been collected', () => {
    const slip = packingSlip(order({ paymentMethod: 'cod', totalPaise: 1_250_000 }));
    expect(slip.collectPaise).toBe(1_250_000);
    expect(slip.paymentLine).toBe('Cash on delivery — collect the full amount');
  });

  it('is nothing once the cash has been collected', () => {
    const slip = packingSlip(
      order({ paymentMethod: 'cod', status: 'delivered', payment: paid({ provider: 'cod' }) }),
    );
    expect(slip.collectPaise).toBeNull();
  });

  it('is nothing at all for an order already paid online', () => {
    // The costly mistake: a label that leaves "collect" blank rather than
    // saying so, and a courier who asks for the money a second time.
    const slip = packingSlip(order({ paymentMethod: 'ccavenue', payment: paid() }));
    expect(slip.collectPaise).toBeNull();
    expect(slip.paymentLine).toBe('Paid online — collect nothing');
  });

  it('never asks a courier to collect for an unpaid online order', () => {
    const slip = packingSlip(
      order({
        paymentMethod: 'ccavenue',
        status: 'pending_payment',
        payment: paid({ verifiedAt: null }),
      }),
    );
    expect(slip.collectPaise).toBeNull();
    expect(slip.paymentLine).toBe('Payment not received');
  });
});

describe('when a parcel should not be made up', () => {
  it('warns on a cancelled order', () => {
    expect(packingSlip(order({ status: 'cancelled' })).warning).toMatch(/cancelled/);
  });

  it('warns on a returned or refunded order', () => {
    expect(packingSlip(order({ status: 'returned' })).warning).toBeTruthy();
    expect(packingSlip(order({ status: 'refunded' })).warning).toBeTruthy();
  });

  it('warns when the money for an online order never arrived', () => {
    const slip = packingSlip(
      order({ paymentMethod: 'ccavenue', payment: paid({ verifiedAt: null }) }),
    );
    expect(slip.warning).toMatch(/money/);
  });

  it('says nothing for an ordinary cash order waiting to be packed', () => {
    expect(packingSlip(order()).warning).toBeNull();
  });
});

describe('what the customer is allowed to read', () => {
  it('carries the note the customer wrote at checkout', () => {
    const slip = packingSlip(order({ notes: 'Please gift wrap.' }));
    expect(slip.customerNote).toBe('Please gift wrap.');
  });

  it('treats a note of only spaces as no note', () => {
    expect(packingSlip(order({ notes: '   \n ' })).customerNote).toBeNull();
  });

  it("never lets the shop's private note into the parcel", () => {
    // staffNotes is where the shop writes things about a customer. It must not
    // travel in that customer's own box, by any field of the slip.
    const secret = 'Rude on the phone, watch this one';
    const slip = packingSlip(order({ staffNotes: secret, notes: 'Gift wrap please' }));
    expect(JSON.stringify(slip)).not.toContain(secret);
    expect(slip.customerNote).toBe('Gift wrap please');
  });
});

describe('the address on the parcel', () => {
  it('writes every line that exists and no blank ones', () => {
    expect(deliveryLines(ADDRESS)).toEqual([
      '12 Nungambakkam High Road',
      'Flat 3B',
      'Near the Kapaleeshwarar temple',
      'Chennai, Tamil Nadu',
    ]);
  });

  it('leaves no gap where an optional line is missing', () => {
    const lines = deliveryLines({ ...ADDRESS, line2: null, landmark: null });
    expect(lines).toEqual(['12 Nungambakkam High Road', 'Chennai, Tamil Nadu']);
    expect(lines.every((entry) => entry.trim().length > 0)).toBe(true);
  });

  it('keeps the name and the pincode out of the block so a label can size them', () => {
    const slip = packingSlip(order());
    expect(slip.name).toBe('Lakshmi Iyer');
    expect(slip.pincode).toBe('600034');
    expect(slip.addressLines.join(' ')).not.toContain('600034');
  });

  it('prefers the phone given on the order, falling back to the address', () => {
    expect(packingSlip(order({ phone: '+91 90000 11111' })).phone).toBe('+91 90000 11111');
    expect(packingSlip(order({ phone: null })).phone).toBe('+91 98765 43210');
  });
});

describe('the money summary', () => {
  it('shows no discount row when nothing was taken off', () => {
    const labels = packingSlip(order()).totals.map((row) => row.label);
    expect(labels).toEqual(['Subtotal', 'Delivery', 'Total']);
  });

  it('names the code that took the money off', () => {
    const slip = packingSlip(
      order({ discountPaise: 50_000, couponCode: 'FESTIVE500' }),
    );
    const discount = slip.totals.find((row) => row.label.includes('FESTIVE500'));
    expect(discount?.amountPaise).toBe(50_000);
    expect(discount?.negative).toBe(true);
  });

  it('says Free rather than printing zero rupees for delivery', () => {
    // "₹0.00" beside Delivery reads as a shop that failed to charge. It didn't.
    const free = packingSlip(order({ shippingPaise: 0 }));
    expect(free.totals.find((row) => row.label === 'Delivery')?.text).toBe('Free');

    const charged = packingSlip(order({ shippingPaise: 9_900 }));
    expect(charged.totals.find((row) => row.label === 'Delivery')?.text).toBeUndefined();
  });

  it('marks the total as the figure the slip is about', () => {
    const total = packingSlip(order()).totals.find((row) => row.label === 'Total');
    expect(total?.emphasis).toBe(true);
    expect(total?.amountPaise).toBe(1_250_000);
  });
});

describe('the pieces to pick', () => {
  it('counts every individual piece, not every line', () => {
    const slip = packingSlip(
      order({
        lines: [line({ id: 'a', quantity: 2 }), line({ id: 'b', quantity: 3 })],
      }),
    );
    expect(slip.pieces).toBe(5);
    expect(slip.lines).toHaveLength(2);
  });

  it('groups the same design together for the person at the shelf', () => {
    const slip = packingSlip(
      order({
        lines: [
          line({ id: 'a', name: 'Tussar silk', variantLabel: 'Rust' }),
          line({ id: 'b', name: 'Kanjivaram silk', variantLabel: 'Ink blue' }),
          line({ id: 'c', name: 'Kanjivaram silk', variantLabel: 'Green' }),
        ],
      }),
    );
    expect(slip.lines.map((entry) => entry.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('packingQueue', () => {
  const ready = (over: Partial<Order>) => order({ paymentMethod: 'cod', ...over });

  it('puts the person who has waited longest first', () => {
    const queue = packingQueue([
      ready({ id: 'new', placedAt: '2026-09-17T09:00:00Z' }),
      ready({ id: 'old', placedAt: '2026-09-11T09:00:00Z' }),
      ready({ id: 'middle', placedAt: '2026-09-14T09:00:00Z' }),
    ]);
    expect(queue.map((entry) => entry.id)).toEqual(['old', 'middle', 'new']);
  });

  it('leaves out anything already sent, closed, or never paid for', () => {
    const queue = packingQueue([
      ready({ id: 'keep', status: 'confirmed' }),
      ready({ id: 'keep2', status: 'packed' }),
      ready({ id: 'gone', status: 'shipped' }),
      ready({ id: 'done', status: 'delivered' }),
      ready({ id: 'dead', status: 'cancelled' }),
      order({
        id: 'unpaid',
        status: 'confirmed',
        paymentMethod: 'ccavenue',
        payment: paid({ verifiedAt: null }),
      }),
    ]);
    expect(queue.map((entry) => entry.id)).toEqual(['keep', 'keep2']);
  });

  it('does not reorder the caller’s own array', () => {
    const orders = [
      ready({ id: 'new', placedAt: '2026-09-17T09:00:00Z' }),
      ready({ id: 'old', placedAt: '2026-09-11T09:00:00Z' }),
    ];
    packingQueue(orders);
    expect(orders.map((entry) => entry.id)).toEqual(['new', 'old']);
  });
});
