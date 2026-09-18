/**
 * Whether a customer may still ask for a return, and why not if not.
 *
 * This mirrors `request_return` in the database — that is the gate, this is
 * what decides whether the form is drawn at all. The two are worth checking
 * against the same edges, because the one that matters most is the boundary
 * of the window: the last day is a day the help panel promised.
 */

import { describe, expect, it } from 'vitest';
import { returnEligibility, RETURN_REASONS, RETURN_STATUS_LABEL } from '@mridul/database';

const NOW = new Date('2026-09-18T12:00:00Z');
const day = 86_400_000;

function at(daysAgo: number): string {
  return new Date(NOW.getTime() - daysAgo * day).toISOString();
}

describe('returnEligibility', () => {
  it('allows a delivered order inside the window', () => {
    const result = returnEligibility({
      status: 'delivered', deliveredAt: at(2), windowDays: 7, openRequest: false, now: NOW,
    });
    expect(result).toEqual({ ok: true, daysLeft: 5 });
  });

  it('still allows it ON the last day of the window', () => {
    // Delivered exactly 7 days ago: the window closes at this instant, not
    // before it. "Within 7 days" has to include the seventh.
    const result = returnEligibility({
      status: 'delivered', deliveredAt: at(7), windowDays: 7, openRequest: false, now: NOW,
    });
    expect(result.ok).toBe(true);
  });

  it('refuses once the window has closed, and says how long it was', () => {
    const result = returnEligibility({
      status: 'delivered', deliveredAt: at(8), windowDays: 7, openRequest: false, now: NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('7-day');
  });

  it('refuses before delivery', () => {
    for (const status of ['confirmed', 'shipped', 'out_for_delivery', 'pending_payment']) {
      const result = returnEligibility({
        status, deliveredAt: null, windowDays: 7, openRequest: false, now: NOW,
      });
      expect(result.ok).toBe(false);
    }
  });

  it('refuses a second request while one is open, ahead of every other reason', () => {
    const result = returnEligibility({
      status: 'delivered', deliveredAt: at(1), windowDays: 7, openRequest: true, now: NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('already open');
  });

  it('refuses an order that has already been returned or refunded', () => {
    for (const status of ['returned', 'refunded']) {
      const result = returnEligibility({
        status, deliveredAt: at(1), windowDays: 7, openRequest: false, now: NOW,
      });
      expect(result.ok).toBe(false);
    }
  });

  it('sends them to a person when it cannot tell when the parcel arrived', () => {
    const result = returnEligibility({
      status: 'delivered', deliveredAt: null, windowDays: 7, openRequest: false, now: NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.toLowerCase()).toContain('message us');
  });

  it('honours a zero-day window as no returns at all', () => {
    const result = returnEligibility({
      status: 'delivered', deliveredAt: at(0.5), windowDays: 0, openRequest: false, now: NOW,
    });
    expect(result.ok).toBe(false);
  });

  it('counts days left up, so a partial day still counts as one', () => {
    const result = returnEligibility({
      status: 'delivered', deliveredAt: at(6.5), windowDays: 7, openRequest: false, now: NOW,
    });
    expect(result).toEqual({ ok: true, daysLeft: 1 });
  });
});

describe('the words', () => {
  it('offers every reason as a sentence, not an enum', () => {
    for (const reason of RETURN_REASONS) {
      expect(reason.label).not.toContain('_');
      expect(reason.label.length).toBeGreaterThan(8);
    }
  });

  it('tells the customer what each status means for them', () => {
    expect(RETURN_STATUS_LABEL.approved).toContain('send it back');
    expect(RETURN_STATUS_LABEL.requested.toLowerCase()).toContain('waiting');
  });
});
