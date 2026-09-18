'use server';

/**
 * Creating and changing discount codes.
 *
 * Every write here runs under the editor's own session, and 0005 lets only a
 * super admin write to `coupons`. The role check below turns that refusal into
 * a sentence; the policy is the actual gate. An order manager can look at the
 * codes and cannot change one, which is the intended split — a discount is
 * money leaving the shop.
 *
 * Nothing here can decide what a customer is actually charged. `validate_coupon`
 * re-checks every rule against the server's own subtotal at checkout, and
 * `place_order` re-checks it again before the total is written. A coupon row is
 * a rule, not an amount.
 */

import { revalidatePath } from 'next/cache';
import { can, currentAdmin, sessionClient } from '@mridul/supabase/server';
import type { ActionResult } from './catalogue';

const OK = (message: string): ActionResult => ({ ok: true, message });
const FAIL = (message: string): ActionResult => ({ ok: false, message });

/** Codes are typed by customers, often off a phone screen. */
const CODE = /^[A-Z0-9]{3,24}$/;

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

/** Rupees in the form, paise in the database, as everywhere else. */
function toPaise(raw: string): number | null {
  const cleaned = raw.replace(/[,\s₹]/g, '');
  if (cleaned === '') return 0;
  const rupees = Number(cleaned);
  if (!Number.isFinite(rupees) || rupees < 0) return null;
  return Math.round(rupees * 100);
}

/** A date from a `datetime-local` input, or null when left blank. */
function toTimestamp(raw: string): string | null | undefined {
  if (raw === '') return null;
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? undefined : at.toISOString();
}

/** Exactly the columns this form writes, named as the database names them. */
type CouponRow = {
  code: string;
  description: string;
  percent_off: number | null;
  amount_off_paise: number | null;
  min_subtotal_paise: number;
  max_redemptions: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

type Shaped = { ok: true; row: CouponRow } | { ok: false; message: string };

/**
 * Turn the form into a row, refusing anything the database would refuse.
 *
 * The checks here duplicate constraints in 0005 on purpose. The constraint is
 * what makes a bad row impossible; this is what makes the refusal a sentence
 * rather than `violates check constraint "coupons_one_discount_form"`.
 */
function shape(formData: FormData): Shaped {
  const code = text(formData, 'code').toUpperCase().replace(/\s+/g, '');
  if (!CODE.test(code)) {
    return {
      ok: false,
      message: 'A code is 3–24 letters and numbers, no spaces or punctuation.',
    };
  }

  const kind = text(formData, 'kind');
  if (kind !== 'percent' && kind !== 'amount') {
    return { ok: false, message: 'Choose a percentage or an amount off.' };
  }

  let percentOff: number | null = null;
  let amountOffPaise: number | null = null;

  if (kind === 'percent') {
    const percent = Number.parseInt(text(formData, 'percent_off'), 10);
    if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
      return { ok: false, message: 'A percentage discount is between 1 and 100.' };
    }
    percentOff = percent;
  } else {
    const amount = toPaise(text(formData, 'amount_off'));
    if (amount === null || amount <= 0) {
      return { ok: false, message: 'An amount off must be more than zero.' };
    }
    amountOffPaise = amount;
  }

  const minSubtotal = toPaise(text(formData, 'min_subtotal'));
  if (minSubtotal === null) {
    return { ok: false, message: 'The minimum spend must be a number, or blank.' };
  }

  // A fixed discount larger than the minimum spend can pay for the whole order
  // and the shipping with it. The database would allow it; somebody typing
  // "5000 off, no minimum" almost certainly meant something else.
  if (amountOffPaise !== null && minSubtotal > 0 && amountOffPaise > minSubtotal) {
    return {
      ok: false,
      message: 'That takes off more than the minimum spend. Raise the minimum, or lower the discount.',
    };
  }

  const maxRaw = text(formData, 'max_redemptions');
  let maxRedemptions: number | null = null;
  if (maxRaw !== '') {
    const max = Number.parseInt(maxRaw, 10);
    if (!Number.isFinite(max) || max < 1) {
      return { ok: false, message: 'A usage limit must be 1 or more, or blank for unlimited.' };
    }
    maxRedemptions = max;
  }

  const startsAt = toTimestamp(text(formData, 'starts_at'));
  const endsAt = toTimestamp(text(formData, 'ends_at'));
  if (startsAt === undefined || endsAt === undefined) {
    return { ok: false, message: 'Check the start and end dates.' };
  }
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    return { ok: false, message: 'The end date has to be after the start date.' };
  }

  return {
    ok: true,
    row: {
      code,
      description: text(formData, 'description'),
      percent_off: percentOff,
      amount_off_paise: amountOffPaise,
      min_subtotal_paise: minSubtotal,
      max_redemptions: maxRedemptions,
      starts_at: startsAt,
      ends_at: endsAt,
      is_active: formData.get('is_active') === 'on',
    },
  };
}

/** Postgres speaks plainly enough about a duplicate; nothing else does. */
function readable(message: string): string {
  if (/duplicate key|unique/i.test(message)) {
    return 'There is already a code with that name.';
  }
  if (/row-level security|permission denied/i.test(message)) {
    return 'Only the shop owner can change discount codes.';
  }
  return message;
}

export async function createCoupon(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin)) return FAIL('Only the shop owner can create discount codes.');

  const shaped = shape(formData);
  if (!shaped.ok) return FAIL(shaped.message);

  const db = await sessionClient();
  const { error } = await db.from('coupons').insert(shaped.row);
  if (error) return FAIL(readable(error.message));

  revalidatePath('/coupons');
  return OK(`${shaped.row.code} is ready to use.`);
}

export async function updateCoupon(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin)) return FAIL('Only the shop owner can change discount codes.');

  const id = text(formData, 'id');
  if (!id) return FAIL('That code could not be found.');

  const shaped = shape(formData);
  if (!shaped.ok) return FAIL(shaped.message);

  const db = await sessionClient();
  const { error } = await db.from('coupons').update(shaped.row).eq('id', id);
  if (error) return FAIL(readable(error.message));

  revalidatePath('/coupons');
  return OK('Saved.');
}

/**
 * Switch a code on or off.
 *
 * Separate from editing because it is the thing most likely to be wanted in a
 * hurry — a code has got somewhere it should not have, and it needs to stop
 * working now rather than after a form is filled in.
 *
 * Off rather than deleted: `coupon_usage` and every order that carries the
 * code still point at this row, and the shop should be able to see what a past
 * discount was.
 */
export async function setCouponActive(formData: FormData): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!can(admin)) return FAIL('Only the shop owner can change discount codes.');

  const id = text(formData, 'id');
  const active = text(formData, 'active') === 'true';
  if (!id) return FAIL('That code could not be found.');

  const db = await sessionClient();
  const { error } = await db.from('coupons').update({ is_active: active }).eq('id', id);
  if (error) return FAIL(readable(error.message));

  revalidatePath('/coupons');
  return OK(active ? 'Switched on.' : 'Switched off — it stops working now.');
}
