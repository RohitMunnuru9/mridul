/**
 * The rules about money, and the two promises made to a customer.
 *
 * Every one of these is somewhere a quiet mistake costs something real: a
 * shipping charge that flips on the wrong side of a threshold, an unpaid order
 * described as paid, a WhatsApp link to a number that does not exist, a
 * tracking link that goes nowhere.
 *
 * Deliberately no database and no network — these are the pure decisions, and
 * they are the ones that can be pinned down exactly.
 */

import { describe, expect, it } from 'vitest';
import {
  amountToFreeShipping,
  estimateShipping,
  trackingUrlFor,
  COURIERS,
} from '@mridul/shipping';
import {
  formatPaise,
  discountPercent,
  imageAtWidth,
  isPlaceholderPhone,
  whatsappLink,
} from '@mridul/utils';

const RATES = { freeShippingThresholdPaise: 199900, flatRatePaise: 9900 };

describe('shipping', () => {
  it('charges the flat rate below the threshold', () => {
    expect(estimateShipping(199899, RATES)).toBe(9900);
  });

  it('is free exactly ON the threshold, not a rupee above it', () => {
    // The off-by-one that matters: a customer who has spent precisely the
    // advertised amount has earned the free delivery it advertises.
    expect(estimateShipping(199900, RATES)).toBe(0);
  });

  it('is free above the threshold', () => {
    expect(estimateShipping(500000, RATES)).toBe(0);
  });

  it('says how much more is needed, and never a negative amount', () => {
    expect(amountToFreeShipping(150000, RATES)).toBe(49900);
    expect(amountToFreeShipping(199900, RATES)).toBe(0);
    expect(amountToFreeShipping(999900, RATES)).toBe(0);
  });
});

describe('tracking links', () => {
  it('builds a link for a courier it knows', () => {
    const url = trackingUrlFor('Delhivery', '3451234567890');
    expect(url).toContain('3451234567890');
    expect(url?.startsWith('https://')).toBe(true);
  });

  it('ignores the case the shop typed', () => {
    expect(trackingUrlFor('delhivery', '123456')).toBe(
      trackingUrlFor('Delhivery', '123456'),
    );
  });

  it('returns null for a courier it does not know', () => {
    // Null rather than a guessed URL: a tracking link that goes nowhere
    // teaches the customer not to trust the next one.
    expect(trackingUrlFor('Some Local Courier', '123456')).toBeNull();
  });

  it('returns null for a known courier with no tracking page', () => {
    expect(trackingUrlFor('Hand delivered', '123456')).toBeNull();
  });

  it('escapes the tracking number rather than pasting it into a URL raw', () => {
    const url = trackingUrlFor('Delhivery', 'ab cd&x=1');
    expect(url).not.toContain(' ');
    expect(url).not.toContain('&x=1');
  });

  it('offers only https tracking pages', () => {
    for (const courier of COURIERS) {
      if (courier.trackingUrl) {
        expect(courier.trackingUrl.startsWith('https://')).toBe(true);
      }
    }
  });
});

describe('money, as the customer reads it', () => {
  it('shows rupees, not paise', () => {
    expect(formatPaise(520000)).toContain('5,200');
    expect(formatPaise(0)).toContain('0');
  });

  it('works out a discount percentage only when there is one', () => {
    expect(discountPercent(400000, 500000)).toBe(20);
    expect(discountPercent(500000, 500000)).toBe(0);
    expect(discountPercent(500000)).toBe(0);
    // A "compare at" below the price is a data mistake, not a negative
    // discount to display.
    expect(discountPercent(500000, 400000)).toBe(0);
  });
});

describe('the shop’s own contact details', () => {
  it('recognises the seed placeholder so no link is offered for it', () => {
    // The shop's number is still +91 90000 00000. Until it is real, every
    // WhatsApp link must stay hidden rather than open a chat with nobody.
    expect(isPlaceholderPhone('+91 90000 00000')).toBe(true);
    expect(isPlaceholderPhone('+919000000000')).toBe(true);
    expect(isPlaceholderPhone('')).toBe(true);
    expect(isPlaceholderPhone(null)).toBe(true);
  });

  it('treats a real number as real', () => {
    expect(isPlaceholderPhone('+91 98765 43210')).toBe(false);
  });

  it('builds no WhatsApp link from a placeholder', () => {
    expect(whatsappLink('+91 90000 00000', 'Hello')).toBeNull();
  });

  it('builds one from a real number', () => {
    const link = whatsappLink('+91 98765 43210', 'Hello there');
    expect(link).toContain('9876543210');
    expect(link).not.toContain(' ');
  });
});

describe('image widths', () => {
  it('asks Supabase for a size near the one needed', () => {
    expect(imageAtWidth('https://x.supabase.co/storage/v1/render/image/public/a.jpg?width=1200&quality=70', 240))
      .toContain('width=240');
  });

  it('leaves a URL it does not recognise alone', () => {
    expect(imageAtWidth('/images/local.webp', 240)).toBe('/images/local.webp');
  });
});
