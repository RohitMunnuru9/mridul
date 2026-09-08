'use server';

/**
 * Coupon check as a server action.
 *
 * The code is validated against the database on the server, so the browser
 * never decides whether a discount applies or what it is worth. The figure it
 * returns is for display only — checkout must validate the same code again
 * against server-priced lines before the Razorpay order is created.
 */

import { validateCoupon } from '@mridul/database';
import type { CouponResult } from '@mridul/types';

export async function applyCoupon(
  code: string,
  subtotalPaise: number,
): Promise<CouponResult> {
  // The subtotal arrives from the browser and is only ever used to decide
  // whether a minimum-spend rule is met for this preview.
  const subtotal = Number.isFinite(subtotalPaise) ? Math.max(0, subtotalPaise) : 0;
  return validateCoupon(code, subtotal);
}
