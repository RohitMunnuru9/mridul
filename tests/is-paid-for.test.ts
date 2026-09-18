/**
 * "Has this order been paid for?"
 *
 * One function answers this for the whole shop — the admin list, the admin
 * order page and the customer's own order page — and it is the same test the
 * database applies before it will let an order be dispatched. If the screens
 * and the database ever disagreed about this, the disagreement would be
 * invisible until a saree left the shop for an order nobody had paid.
 *
 * The rule: cash is real once collected at the door. Anything paid online is
 * real only once it has been VERIFIED against the gateway — a payment row that
 * merely says 'paid' is not enough, because `verified_at` has exactly one
 * writer and `status` does not.
 */

import { describe, expect, it } from 'vitest';
import { isPaidFor, paymentMethodLabel, type Order } from '@mridul/database';

function order(over: Partial<Order> & { payment?: Order['payment'] }): Order {
  return {
    paymentMethod: 'cod',
    payment: null,
    ...over,
  } as Order;
}

const payment = (over: Partial<NonNullable<Order['payment']>> = {}) => ({
  provider: 'ccavenue',
  status: 'paid',
  method: null,
  amountPaise: 520000,
  verifiedAt: '2026-09-18T00:00:00Z',
  providerPaymentId: null,
  providerReference: null,
  ...over,
});

describe('isPaidFor', () => {
  it('is false when there is no payment row at all', () => {
    expect(isPaidFor(order({}))).toBe(false);
  });

  it('is false while a payment is still pending', () => {
    expect(isPaidFor(order({ payment: payment({ status: 'pending' }) }))).toBe(false);
  });

  it('is true for a cash order once collected', () => {
    expect(
      isPaidFor(order({ paymentMethod: 'cod', payment: payment({ verifiedAt: null }) })),
    ).toBe(true);
  });

  it('is TRUE for an online order only once verified with the gateway', () => {
    expect(isPaidFor(order({ paymentMethod: 'ccavenue', payment: payment() }))).toBe(true);
  });

  it('is FALSE for an online order that says paid but was never verified', () => {
    // The case this whole function exists for. A row could be marked paid by
    // some future path; verified_at is written in exactly one place, after the
    // server has asked CCAvenue itself.
    expect(
      isPaidFor(order({ paymentMethod: 'ccavenue', payment: payment({ verifiedAt: null }) })),
    ).toBe(false);
  });

  it('treats an unknown gateway the same as a known one', () => {
    expect(
      isPaidFor(order({ paymentMethod: 'razorpay', payment: payment({ verifiedAt: null }) })),
    ).toBe(false);
  });
});

describe('paymentMethodLabel', () => {
  it('names the ways to pay in the shop’s words', () => {
    expect(paymentMethodLabel('cod')).toBe('Cash on delivery');
    expect(paymentMethodLabel('ccavenue')).toContain('UPI');
  });

  it('never returns an empty label for something unexpected', () => {
    expect(paymentMethodLabel('something_new').length).toBeGreaterThan(0);
  });
});
