/**
 * Returns.
 *
 * Read with the caller's own client: a customer sees the requests on their own
 * orders, an order manager or support sees them all, and nobody can write a
 * row directly — `request_return` and `admin_decide_return` are the only way
 * in, and each checks the rule it exists for.
 */

import type { Client } from '@mridul/supabase';

export type ReturnStatus = 'requested' | 'approved' | 'declined' | 'refunded';

export type ReturnReason =
  | 'damaged'
  | 'wrong_item'
  | 'not_as_described'
  | 'size_fit'
  | 'changed_mind'
  | 'other';

/** The reasons a customer can pick, in the order they are offered. */
export const RETURN_REASONS: { value: ReturnReason; label: string }[] = [
  { value: 'damaged', label: 'It arrived damaged' },
  { value: 'wrong_item', label: 'It is not what I ordered' },
  { value: 'not_as_described', label: 'It is not as described' },
  { value: 'size_fit', label: 'The size or fit is wrong' },
  { value: 'changed_mind', label: 'I changed my mind' },
  { value: 'other', label: 'Something else' },
];

export const RETURN_REASON_LABEL: Record<ReturnReason, string> = Object.fromEntries(
  RETURN_REASONS.map((reason) => [reason.value, reason.label]),
) as Record<ReturnReason, string>;

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  requested: 'Waiting for the shop',
  approved: 'Approved — send it back',
  declined: 'Declined',
  refunded: 'Refunded',
};

export type ReturnItem = {
  orderItemId: string;
  quantity: number;
};

export type ReturnRequest = {
  id: string;
  orderId: string;
  status: ReturnStatus;
  reason: ReturnReason;
  /** In the customer's words. */
  note: string;
  /** The shop's reply, shown to the customer. */
  staffNote: string;
  refundPaise: number | null;
  requestedAt: string;
  decidedAt: string | null;
  refundedAt: string | null;
  items: ReturnItem[];
};

const COLUMNS =
  'id, order_id, status, reason, note, staff_note, refund_paise, requested_at, ' +
  'decided_at, refunded_at, return_request_items ( order_item_id, quantity )';

/* eslint-disable @typescript-eslint/no-explicit-any */
function toRequest(row: any): ReturnRequest {
  return {
    id: row.id,
    orderId: row.order_id,
    status: row.status,
    reason: row.reason,
    note: row.note ?? '',
    staffNote: row.staff_note ?? '',
    refundPaise: row.refund_paise ?? null,
    requestedAt: row.requested_at,
    decidedAt: row.decided_at ?? null,
    refundedAt: row.refunded_at ?? null,
    items: ((row.return_request_items ?? []) as any[]).map((item) => ({
      orderItemId: item.order_item_id,
      quantity: item.quantity,
    })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Every return on one order, newest first. Usually zero or one. */
export async function fetchReturnsForOrder(
  db: Client,
  orderId: string,
): Promise<ReturnRequest[]> {
  const { data, error } = await db
    .from('return_requests')
    .select(COLUMNS)
    .eq('order_id', orderId)
    .order('requested_at', { ascending: false });

  // The table arrives with migration 0024. Before that, an order simply has
  // no returns — which is true — rather than a page that cannot load.
  if (error) return [];
  return (data ?? []).map(toRequest);
}

/** Returns still waiting for the shop, across every order. For the admin. */
export async function fetchOpenReturns(db: Client): Promise<ReturnRequest[]> {
  const { data, error } = await db
    .from('return_requests')
    .select(COLUMNS)
    .in('status', ['requested', 'approved'])
    .order('requested_at', { ascending: true });

  if (error) return [];
  return (data ?? []).map(toRequest);
}

/**
 * Whether the customer may still ask, and if not, why not.
 *
 * Mirrors what `request_return` decides in the database — that is the gate,
 * this is the explanation, and it is what decides whether the form is drawn
 * at all. A form that always ends in "the window has closed" is worse than a
 * sentence saying so.
 */
export type ReturnEligibility =
  | { ok: true; daysLeft: number }
  | { ok: false; reason: string };

export function returnEligibility(input: {
  status: string;
  deliveredAt: string | null;
  windowDays: number;
  openRequest: boolean;
  now?: Date;
}): ReturnEligibility {
  const now = input.now ?? new Date();

  if (input.openRequest) {
    return { ok: false, reason: 'A return is already open on this order.' };
  }
  if (input.status === 'returned' || input.status === 'refunded') {
    return { ok: false, reason: 'This order has already been returned.' };
  }
  if (input.status !== 'delivered') {
    return { ok: false, reason: 'You can ask for a return once it has been delivered.' };
  }
  if (!input.deliveredAt) {
    // Cannot tell when it arrived, so cannot tell whether the window is open.
    // Send them to a person rather than guess against them.
    return { ok: false, reason: 'Message us and we will arrange it.' };
  }

  const delivered = new Date(input.deliveredAt);
  const closes = new Date(delivered.getTime() + input.windowDays * 86_400_000);
  if (closes < now) {
    return {
      ok: false,
      reason: `The ${input.windowDays}-day return window on this order has closed.`,
    };
  }

  return { ok: true, daysLeft: Math.ceil((closes.getTime() - now.getTime()) / 86_400_000) };
}
