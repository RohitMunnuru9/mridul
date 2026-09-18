/**
 * Turning a stored audit row into something a person can read.
 *
 * The value of this page is that somebody can scan it and find the one entry
 * they came for. An entry that lists nine unchanged fields beside the one that
 * moved buries exactly that.
 */

import { describe, expect, it } from 'vitest';
import { actionLabel, describeChanges, NOTABLE_ACTIONS } from '@mridul/database';

describe('describeChanges', () => {
  it('shows only what actually moved', () => {
    const lines = describeChanges(
      { percent_off: 10, min_subtotal_paise: 250000, is_active: true },
      { percent_off: 50, min_subtotal_paise: 250000, is_active: true },
    );
    expect(lines).toEqual(['percent off: 10 → 50']);
  });

  it('does not count a value rewritten to the same thing', () => {
    expect(describeChanges({ code: 'LOOM15' }, { code: 'LOOM15' })).toEqual([]);
  });

  it('reads a new field as an addition rather than a change from nothing', () => {
    expect(describeChanges(null, { role: 'super_admin' })).toEqual([
      'role: super_admin',
    ]);
  });

  it('reads a removed field as what it was', () => {
    expect(describeChanges({ role: 'support' }, null)).toEqual([
      'role: was support',
    ]);
  });

  it('says "nothing" rather than "null" for an emptied value', () => {
    // A log read by a shop owner, not by a programmer.
    expect(describeChanges({ ends_at: '2026-12-01' }, { ends_at: null })).toEqual([
      'ends at: 2026-12-01 → nothing',
    ]);
  });

  it('survives both sides being empty', () => {
    expect(describeChanges(null, null)).toEqual([]);
    expect(describeChanges(undefined, undefined)).toEqual([]);
  });

  it('is not fooled by an array or a string where an object was expected', () => {
    // jsonb can hold anything; the page must not throw on an old or odd row.
    expect(describeChanges(['a'], 'b')).toEqual([]);
    expect(describeChanges(42, { a: 1 })).toEqual(['a: 1']);
  });

  it('renders a nested value rather than [object Object]', () => {
    const lines = describeChanges({ counts: [1, 2] }, { counts: [1, 3] });
    expect(lines[0]).toContain('[1,3]');
    expect(lines[0]).not.toContain('[object Object]');
  });
});

describe('actionLabel', () => {
  it('says what happened in words', () => {
    expect(actionLabel('coupon.stop')).toBe('Stopped a discount code');
    expect(actionLabel('access.grant')).toBe('Gave somebody access');
  });

  it('falls back to the raw action rather than hiding an entry it does not know', () => {
    // An unrecognised action is still something that happened. Showing the
    // code is worse than a sentence and far better than nothing.
    expect(actionLabel('something.new')).toBe('something.new');
  });
});

describe('what counts as worth noticing', () => {
  it('marks money and access, not routine fulfilment', () => {
    expect(NOTABLE_ACTIONS.has('access.grant')).toBe(true);
    expect(NOTABLE_ACTIONS.has('coupon.create')).toBe(true);
    expect(NOTABLE_ACTIONS.has('order.status')).toBe(false);
    expect(NOTABLE_ACTIONS.has('stock.set')).toBe(false);
  });
});
