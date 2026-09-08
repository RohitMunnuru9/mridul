/**
 * Payment provider contract (Razorpay).
 *
 * The rule this file exists to enforce: an order is priced on the server, from
 * the database, immediately before the payment order is created. Nothing in a
 * request body sets an amount. When the customer returns from the gateway the
 * signature is verified server-side, and the webhook confirms it a second
 * time — a browser saying "payment succeeded" means nothing.
 *
 * Secrets never leave the server. Only the public key id is safe to ship to
 * the browser.
 */

export type Money = number;

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

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

/** One priced line, resolved from the database rather than the request. */
export type PricedLine = {
  productId: string;
  variantId: string;
  quantity: number;
  /** Unit price read from `products` at pricing time, in paise. */
  unitPricePaise: Money;
};

/** The server's own arithmetic. The only totals a charge may be based on. */
export type PricedOrder = {
  lines: PricedLine[];
  subtotalPaise: Money;
  discountPaise: Money;
  shippingPaise: Money;
  totalPaise: Money;
  currency: 'INR';
};

/** What the browser needs to open the gateway. No secret is included. */
export type PaymentIntent = {
  providerOrderId: string;
  amountPaise: Money;
  currency: 'INR';
  /** Publishable key id only. */
  keyId: string;
};

/** Exactly what the gateway hands back to the browser, all of it untrusted. */
export type GatewayCallback = {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
};

export interface PaymentProvider {
  readonly name: string;
  /** Creates the gateway order for an already server-priced total. */
  createIntent(input: {
    orderId: string;
    order: PricedOrder;
    customerEmail?: string;
    customerPhone?: string;
  }): Promise<PaymentIntent>;
  /**
   * Verifies the HMAC the gateway returned. Must be constant-time, and must
   * run before any order is marked paid.
   */
  verifyCallback(callback: GatewayCallback): Promise<boolean>;
  /** Verifies a webhook body against its signature header. */
  verifyWebhook(rawBody: string, signature: string): Promise<boolean>;
  /** Authoritative status, read back from the provider rather than assumed. */
  fetchStatus(providerPaymentId: string): Promise<PaymentStatus>;
  refund(input: { providerPaymentId: string; amountPaise: Money }): Promise<void>;
}

/** Sums server-side line prices. Never call this with client-supplied prices. */
export function priceOrder(input: {
  lines: PricedLine[];
  discountPaise?: Money;
  shippingPaise?: Money;
}): PricedOrder {
  const subtotalPaise = input.lines.reduce(
    (total, line) => total + line.unitPricePaise * line.quantity,
    0,
  );
  const discountPaise = Math.min(input.discountPaise ?? 0, subtotalPaise);
  const shippingPaise = input.shippingPaise ?? 0;

  return {
    lines: input.lines,
    subtotalPaise,
    discountPaise,
    shippingPaise,
    totalPaise: subtotalPaise - discountPaise + shippingPaise,
    currency: 'INR',
  };
}
