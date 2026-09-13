/**
 * Display formatting for money and other catalogue values.
 *
 * Money moves through the app as an integer count of paise. It is formatted
 * only at the edge, right before it is rendered, so no rounded string ever
 * finds its way back into a calculation.
 */

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 465000 -> "₹4,650". Rupee amounts here are always whole. */
export function formatPaise(paise: number): string {
  return INR.format(Math.round(paise / 100));
}

/**
 * Whole-percent saving, floored so we never overstate a discount.
 * Returns 0 when there is no compare-at price or it is not actually higher.
 */
export function discountPercent(pricePaise: number, compareAtPaise?: number): number {
  if (!compareAtPaise || compareAtPaise <= pricePaise) return 0;
  return Math.floor(((compareAtPaise - pricePaise) / compareAtPaise) * 100);
}

const BADGE_LABELS: Record<string, string> = {
  new: 'New',
  bestseller: 'Bestseller',
  limited: 'Limited',
  back_in_stock: 'Back in stock',
};

export function badgeLabel(badge?: string): string | undefined {
  return badge ? BADGE_LABELS[badge] : undefined;
}

/* ---------------------------------------------------------------------------
 * Dates
 *
 * Every timestamp in the database is `timestamptz`, stored in UTC. The shop,
 * its customers and whoever is packing the parcel are all in India, so these
 * format in Asia/Kolkata explicitly rather than in whatever zone the server
 * that happens to render the page is set to.
 * ------------------------------------------------------------------------- */

const IST = 'Asia/Kolkata';

const DAY = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const DAY_AND_TIME = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** "12 Sep 2026". Returns an em dash for a missing timestamp. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : DAY.format(date);
}

/** "12 Sep 2026, 6:40 pm". Returns an em dash for a missing timestamp. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : DAY_AND_TIME.format(date);
}

/* ---------------------------------------------------------------------------
 * Contact
 *
 * The shop's WhatsApp number is seeded as +91 90000 00000 and stays that way
 * until somebody saves a real one in Settings. Every surface that offers to
 * open a chat has to decide what to do about that, and each deciding for
 * itself is how you end up with a button that opens a conversation with
 * nobody. So the decision lives here, once.
 * ------------------------------------------------------------------------- */

/** True while the number is still the seed value, or simply absent. */
export function isPlaceholderPhone(value: string | null | undefined): boolean {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length === 0) return true;
  if (/^(91)?0+$/.test(digits)) return true;
  // Six zeroes in a row at the end is not a number anybody was given.
  return /0{6,}$/.test(digits);
}

/**
 * A wa.me link, or null when there is no real number to link to. Callers
 * render nothing on null rather than a dead button — the link reappears by
 * itself the moment a real number is saved, with no deploy.
 */
export function whatsappLink(
  value: string | null | undefined,
  message?: string,
): string | null {
  if (isPlaceholderPhone(value)) return null;
  const digits = (value ?? '').replace(/\D/g, '');
  return message
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${digits}`;
}

/* ---------------------------------------------------------------------------
 * Images
 *
 * Storage URLs carry the width they were asked for. A product card on a phone
 * is about 170px across, and handing it a 1200px image costs twice: the bytes
 * on the way down, and then the decode — which on a cheap phone is the part
 * that actually drops frames and eats the memory it does not have.
 *
 * So each slot asks for roughly what it will display, doubled for a retina
 * screen and rounded to a handful of sizes, so the same few files stay cached
 * across pages rather than every slot minting its own.
 * ------------------------------------------------------------------------- */

const STEPS = [120, 240, 400, 600, 900, 1200, 1600];

/**
 * The same image at a width suited to where it is going. Anything that is not
 * a storage render URL — a local file, a placeholder — is returned untouched.
 */
export function imageAtWidth(url: string, width: number): string {
  if (!url.includes('/render/image/')) return url;
  const step = STEPS.find((value) => value >= width) ?? STEPS[STEPS.length - 1];
  return url.replace(/([?&])width=\d+/, `$1width=${step}`);
}
