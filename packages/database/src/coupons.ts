/**
 * Discount codes.
 *
 * Read with the caller's own client, so row-level security decides what comes
 * back: 0005 lets an order manager or support read them, and only a super
 * admin write. That split is deliberate — a discount is money leaving the
 * shop, so changing one is the owner's decision, not an editor's.
 *
 * `validate_coupon` remains the only path a shopper has to a coupon row. None
 * of this is readable from the storefront.
 */

import type { Client } from '@mridul/supabase';

export type Coupon = {
  id: string;
  code: string;
  description: string;
  /** Exactly one of these two is set; the database enforces that. */
  percentOff: number | null;
  amountOffPaise: number | null;
  minSubtotalPaise: number;
  /** Null means unlimited. */
  maxRedemptions: number | null;
  redemptionCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
};

const COLUMNS =
  'id, code, description, percent_off, amount_off_paise, min_subtotal_paise, ' +
  'max_redemptions, redemption_count, starts_at, ends_at, is_active, created_at';

/* eslint-disable @typescript-eslint/no-explicit-any */
function toCoupon(row: any): Coupon {
  return {
    id: row.id,
    code: row.code,
    description: row.description ?? '',
    percentOff: row.percent_off ?? null,
    amountOffPaise: row.amount_off_paise ?? null,
    minSubtotalPaise: row.min_subtotal_paise ?? 0,
    maxRedemptions: row.max_redemptions ?? null,
    redemptionCount: row.redemption_count ?? 0,
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    isActive: row.is_active ?? false,
    createdAt: row.created_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function fetchCoupons(db: Client): Promise<Coupon[]> {
  const { data, error } = await db
    .from('coupons')
    .select(COLUMNS)
    .order('is_active', { ascending: false })
    .order('code');

  if (error) throw new Error(error.message);
  return (data ?? []).map(toCoupon);
}

/**
 * Whether a shopper typing this code right now would get anything.
 *
 * `is_active` is only part of the answer — a code can be switched on and still
 * be spent, expired, or not started. The admin should say which, because "not
 * valid" on a code the shop believes is live is the kind of thing that gets
 * blamed on the website.
 */
export type CouponState =
  | { live: true }
  | { live: false; reason: string };

export function couponState(coupon: Coupon, now = new Date()): CouponState {
  if (!coupon.isActive) return { live: false, reason: 'Switched off' };
  if (coupon.startsAt && new Date(coupon.startsAt) > now) {
    return { live: false, reason: 'Not started yet' };
  }
  if (coupon.endsAt && new Date(coupon.endsAt) <= now) {
    return { live: false, reason: 'Expired' };
  }
  if (
    coupon.maxRedemptions !== null &&
    coupon.redemptionCount >= coupon.maxRedemptions
  ) {
    return { live: false, reason: 'Fully used' };
  }
  return { live: true };
}

/** "10% off" or "₹500 off", as the shop would say it. */
export function couponValue(coupon: Coupon): string {
  if (coupon.percentOff !== null) return `${coupon.percentOff}% off`;
  if (coupon.amountOffPaise !== null) {
    return `₹${Math.round(coupon.amountOffPaise / 100).toLocaleString('en-IN')} off`;
  }
  return '—';
}
