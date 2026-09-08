/**
 * Shipping provider contract.
 *
 * The provider is deliberately not chosen yet, so checkout and order code must
 * only ever talk to this interface. Swapping Delhivery for Shiprocket then
 * means writing one adapter, not touching the order flow.
 *
 * Rates are quoted on the server from the destination pincode. A quote the
 * browser sends back is a suggestion, never a charge — re-quote before the
 * Razorpay order is created.
 */

/** Paise, like every other amount in the system. */
export type Money = number;

export type ShippingAddress = {
  pincode: string;
  city?: string;
  state?: string;
  country: 'IN';
};

export type Parcel = {
  /** Grams. Sum of the order's item weights plus packaging. */
  weightGrams: number;
  /** Declared value in paise, used for insured shipments. */
  valuePaise: Money;
};

export type ShippingQuote = {
  serviceCode: string;
  serviceName: string;
  amountPaise: Money;
  /** ISO date, provider's best estimate. */
  estimatedDelivery?: string;
  codAvailable: boolean;
};

export type TrackingEvent = {
  status: string;
  description: string;
  location?: string;
  /** ISO timestamp from the provider. */
  occurredAt: string;
};

export type Shipment = {
  /** Provider's air waybill / tracking number. */
  awb: string;
  provider: string;
  trackingUrl?: string;
  events: TrackingEvent[];
};

export interface ShippingProvider {
  readonly name: string;
  /** Is this pincode serviceable at all? Checked before rates are shown. */
  isServiceable(address: ShippingAddress): Promise<boolean>;
  /** Rates for a destination. Empty array means no service, not an error. */
  quote(address: ShippingAddress, parcel: Parcel): Promise<ShippingQuote[]>;
  /** Books the shipment once an order is paid, returning the AWB. */
  createShipment(input: {
    orderId: string;
    address: ShippingAddress;
    parcel: Parcel;
    serviceCode: string;
  }): Promise<Shipment>;
  track(awb: string): Promise<Shipment>;
}

/**
 * Free shipping threshold, in paise. Lives here rather than in a component so
 * the storefront banner, the bag page and the checkout total cannot drift
 * apart. Move it to the `settings` table once the admin panel owns it.
 */
export const FREE_SHIPPING_THRESHOLD_PAISE = 199900;

/** Flat rate charged below the threshold until a real provider is wired up. */
export const FALLBACK_SHIPPING_PAISE = 9900;

/**
 * Interim rate used by the storefront while no provider is configured.
 * Deliberately simple and clearly a placeholder, so it is obvious at review
 * time that this is not a real quote.
 */
export function estimateShipping(subtotalPaise: Money): Money {
  return subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE ? 0 : FALLBACK_SHIPPING_PAISE;
}

/** How much more the customer must spend to cross the free-shipping line. */
export function amountToFreeShipping(subtotalPaise: Money): Money {
  return Math.max(0, FREE_SHIPPING_THRESHOLD_PAISE - subtotalPaise);
}
