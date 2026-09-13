/**
 * Reading orders.
 *
 * One set of queries, used by both apps, and none of them takes a "show me
 * everything" flag. Every function is handed the caller's own Supabase client
 * and row-level security decides what comes back: a customer sees the orders
 * whose `customer_id` is theirs, an order manager or support sees all of them,
 * and anybody else sees an empty list. The storefront and the admin run the
 * same SQL and get different rows, which is the point — the filtering is in
 * Postgres, not in a `where` clause somebody could forget to write.
 *
 * Amounts are read straight off the order. They were frozen when it was
 * placed, so a later price change never rewrites what someone was charged.
 */

import { storageUrl, type Client } from '@mridul/supabase';

export type OrderStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'refunded';

/** What each status means to a customer, in words rather than in enum. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  processing: 'Being prepared',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
  refunded: 'Refunded',
};

/**
 * The order of the pipeline, so the admin can only move an order forwards
 * through the steps that make sense. Cancelled, returned and refunded are
 * exits rather than steps and are offered separately.
 */
export const ORDER_PIPELINE: OrderStatus[] = [
  'pending_payment',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
];

export const ORDER_EXITS: OrderStatus[] = ['cancelled', 'returned', 'refunded'];

/** Statuses where the customer no longer owes anything and nothing ships. */
export function isClosed(status: OrderStatus): boolean {
  return status === 'delivered' || ORDER_EXITS.includes(status);
}

export type OrderAddress = {
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
};

export type OrderLine = {
  id: string;
  productId: string | null;
  productSlug: string | null;
  name: string;
  variantLabel: string;
  sku: string;
  /** Absolute URL, or null when the piece was never photographed. */
  imageUrl: string | null;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
};

export type OrderPayment = {
  provider: string;
  status: string;
  method: string | null;
  amountPaise: number;
  verifiedAt: string | null;
};

export type Order = {
  id: string;
  number: string;
  customerId: string | null;
  status: OrderStatus;
  /** 'cod' until Razorpay is connected. */
  paymentMethod: string;
  placedAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  email: string | null;
  phone: string | null;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  couponCode: string | null;
  /** Written by the customer at checkout. Never edited by the shop. */
  notes: string | null;
  /** The shop's own note. Invisible to the customer. */
  staffNotes: string | null;
  address: OrderAddress;
  lines: OrderLine[];
  payment: OrderPayment | null;
};

const COLUMNS =
  'id, order_number, customer_id, status, payment_method, placed_at, ' +
  'confirmed_at, cancelled_at, email, phone, subtotal_paise, discount_paise, ' +
  'shipping_paise, total_paise, coupon_code, notes, staff_notes, ' +
  'shipping_address, ' +
  'order_items ( id, product_id, product_name, variant_label, sku, image_url, ' +
  'unit_price_paise, quantity, line_total_paise, products ( slug ) ), ' +
  'payments ( provider, status, method, amount_paise, verified_at )';

/**
 * `shipping_address` is jsonb, so it arrives as whatever was written rather
 * than as a checked shape. It was written by `place_order`, which builds it
 * key by key — this reads it back defensively anyway, because a rendering page
 * should degrade to a blank line rather than throw on an old row.
 */
function toAddress(value: unknown): OrderAddress {
  const raw = (value ?? {}) as Record<string, unknown>;
  const text = (key: string): string =>
    typeof raw[key] === 'string' ? (raw[key] as string) : '';
  const optional = (key: string): string | null => text(key) || null;

  return {
    fullName: text('full_name'),
    phone: text('phone'),
    line1: text('line1'),
    line2: optional('line2'),
    landmark: optional('landmark'),
    city: text('city'),
    state: text('state'),
    pincode: text('pincode'),
  };
}

/**
 * `order_items.image_url` holds `bucket/path`, not a URL, so the record stays
 * correct if the Supabase project reference ever changes. Anything already
 * absolute or root-relative is passed through untouched.
 */
export function orderImageUrl(stored: string | null): string | null {
  if (!stored) return null;
  if (stored.startsWith('http') || stored.startsWith('/')) return stored;
  const slash = stored.indexOf('/');
  if (slash === -1) return null;
  return storageUrl(stored.slice(0, slash), stored.slice(slash + 1));
}

/*
 * Embedded selects come back as nested objects that the generated types do not
 * describe, so the row is read as `any` and narrowed field by field below —
 * the same trade the catalogue queries make.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
function toOrder(row: any): Order {
  const items = (row.order_items ?? []) as any[];
  const payments = (row.payments ?? []) as any[];

  return {
    id: row.id,
    number: row.order_number,
    customerId: row.customer_id ?? null,
    status: row.status as OrderStatus,
    paymentMethod: row.payment_method ?? 'cod',
    placedAt: row.placed_at,
    confirmedAt: row.confirmed_at ?? null,
    cancelledAt: row.cancelled_at ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    subtotalPaise: row.subtotal_paise ?? 0,
    discountPaise: row.discount_paise ?? 0,
    shippingPaise: row.shipping_paise ?? 0,
    totalPaise: row.total_paise ?? 0,
    couponCode: row.coupon_code ?? null,
    notes: row.notes ?? null,
    staffNotes: row.staff_notes ?? null,
    address: toAddress(row.shipping_address),
    lines: items.map((item) => ({
      id: item.id,
      productId: item.product_id ?? null,
      productSlug: item.products?.slug ?? null,
      name: item.product_name,
      variantLabel: item.variant_label ?? '',
      sku: item.sku ?? '',
      imageUrl: orderImageUrl(item.image_url ?? null),
      quantity: item.quantity,
      unitPricePaise: item.unit_price_paise,
      lineTotalPaise: item.line_total_paise,
    })),
    payment: payments[0]
      ? {
          provider: payments[0].provider,
          status: payments[0].status,
          method: payments[0].method ?? null,
          amountPaise: payments[0].amount_paise,
          verifiedAt: payments[0].verified_at ?? null,
        }
      : null,
  };
}

export type OrderFilter = {
  /** Narrows to one customer. Ignored for a customer, who only sees their own. */
  customerId?: string;
  status?: OrderStatus;
  /** Matches the order number, the email or the phone. */
  search?: string;
  limit?: number;
};

export async function fetchOrders(
  client: Client,
  filter: OrderFilter = {},
): Promise<Order[]> {
  let query = client
    .from('orders')
    .select(COLUMNS)
    .order('placed_at', { ascending: false })
    .limit(filter.limit ?? 200);

  if (filter.customerId) query = query.eq('customer_id', filter.customerId);
  if (filter.status) query = query.eq('status', filter.status);

  const term = filter.search?.trim();
  if (term) {
    // `or` takes a raw filter string, so a comma or a parenthesis in the term
    // would change its meaning. Stripping them keeps the search harmless.
    const safe = term.replace(/[(),]/g, ' ').trim();
    if (safe) {
      query = query.or(
        `order_number.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`,
      );
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(`Loading orders: ${error.message}`);
  return (data ?? []).map(toOrder);
}

export async function fetchOrderByNumber(
  client: Client,
  orderNumber: string,
): Promise<Order | null> {
  const { data, error } = await client
    .from('orders')
    .select(COLUMNS)
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error) throw new Error(`Loading order: ${error.message}`);
  return data ? toOrder(data) : null;
}

export async function fetchOrderById(
  client: Client,
  id: string,
): Promise<Order | null> {
  const { data, error } = await client
    .from('orders')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Loading order: ${error.message}`);
  return data ? toOrder(data) : null;
}

/**
 * The customer list for the admin.
 *
 * Everything here except the order totals lives in `auth.users`, which no
 * client role can read. `admin_customers()` is a SECURITY DEFINER function
 * that checks the caller's role itself and returns nothing to anyone without
 * one — so this needs the admin's ordinary session, not the service-role key.
 */
export type Customer = {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  signedUpAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  signInMethod: string;
  isStaff: boolean;
  acceptsMarketing: boolean;
  ordersCount: number;
  spendPaise: number;
  lastOrderAt: string | null;
  city: string | null;
  state: string | null;
};

export async function fetchCustomers(client: Client): Promise<Customer[]> {
  const { data, error } = await client.rpc('admin_customers');
  if (error) throw new Error(`Loading customers: ${error.message}`);

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    email: row.email ?? null,
    fullName: row.full_name ?? null,
    phone: row.phone ?? null,
    signedUpAt: row.signed_up_at,
    lastSignInAt: row.last_sign_in_at ?? null,
    emailConfirmedAt: row.email_confirmed_at ?? null,
    signInMethod: row.sign_in_method ?? 'email',
    isStaff: Boolean(row.is_staff),
    acceptsMarketing: Boolean(row.accepts_marketing),
    ordersCount: Number(row.orders_count ?? 0),
    spendPaise: Number(row.spend_paise ?? 0),
    lastOrderAt: row.last_order_at ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
  }));
}
