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
