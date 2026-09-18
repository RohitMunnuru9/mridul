/**
 * Whether a discount code actually works right now.
 *
 * `is_active` is only part of the answer — a code can be switched on and still
 * be expired, not started, or fully spent. The admin has to say WHICH, because
 * "that code is not valid" on a code the shop believes is live is the kind of
 * thing that gets blamed on the website rather than on the end date nobody
 * remembers setting.
 *
 * This mirrors what `validate_coupon` decides in the database. The two are
 * written separately on purpose — the database is the gate, this is the
 * explanation — so they are worth checking against the same cases.
 */

import { describe, expect, it } from 'vitest';
import { couponState, couponValue, type Coupon } from '@mridul/database';

const NOW = new Date('2026-09-18T12:00:00Z');

function coupon(over: Partial<Coupon> = {}): Coupon {
  return {
    id: 'c1',
    code: 'FESTIVE500',
    description: '',
    percentOff: null,
    amountOffPaise: 50000,
    minSubtotalPaise: 500000,
    maxRedemptions: null,
    redemptionCount: 0,
    startsAt: null,
    endsAt: null,
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    ...over,
  };
}

describe('couponState', () => {
  it('is live when switched on with no window and no limit', () => {
    expect(couponState(coupon(), NOW)).toEqual({ live: true });
  });

  it('says so when it has been switched off', () => {
    expect(couponState(coupon({ isActive: false }), NOW)).toEqual({
      live: false,
      reason: 'Switched off',
    });
  });

  it('says so before it starts', () => {
    expect(couponState(coupon({ startsAt: '2026-10-01T00:00:00Z' }), NOW)).toEqual({
      live: false,
      reason: 'Not started yet',
    });
  });

  it('is live once it has started', () => {
    expect(couponState(coupon({ startsAt: '2026-09-01T00:00:00Z' }), NOW).live).toBe(true);
  });

  it('says so after it ends', () => {
    expect(couponState(coupon({ endsAt: '2026-09-17T00:00:00Z' }), NOW)).toEqual({
      live: false,
      reason: 'Expired',
    });
  });

  it('is dead exactly ON its end moment, not a second after', () => {
    // An end date is the moment it stops, not the last moment it works.
    expect(couponState(coupon({ endsAt: NOW.toISOString() }), NOW).live).toBe(false);
  });

  it('says so once it is fully used', () => {
    expect(
      couponState(coupon({ maxRedemptions: 50, redemptionCount: 50 }), NOW),
    ).toEqual({ live: false, reason: 'Fully used' });
  });

  it('is still live on the last remaining use', () => {
    expect(
      couponState(coupon({ maxRedemptions: 50, redemptionCount: 49 }), NOW).live,
    ).toBe(true);
  });

  it('is unlimited when there is no limit, however many times it is used', () => {
    expect(
      couponState(coupon({ maxRedemptions: null, redemptionCount: 9999 }), NOW).live,
    ).toBe(true);
  });

  it('reports being switched off ahead of any other reason', () => {
    // Somebody who has just stopped a code wants to see that they stopped it,
    // not that it also happens to have expired.
    expect(
      couponState(
        coupon({ isActive: false, endsAt: '2026-01-01T00:00:00Z' }),
        NOW,
      ),
    ).toEqual({ live: false, reason: 'Switched off' });
  });
});

describe('couponValue', () => {
  it('reads a percentage as a percentage', () => {
    expect(couponValue(coupon({ percentOff: 10, amountOffPaise: null }))).toBe('10% off');
  });

  it('reads an amount in rupees, not paise', () => {
    expect(couponValue(coupon({ percentOff: null, amountOffPaise: 50000 }))).toContain('500');
  });

  it('never claims a discount when the row has neither', () => {
    expect(couponValue(coupon({ percentOff: null, amountOffPaise: null }))).toBe('—');
  });
});
