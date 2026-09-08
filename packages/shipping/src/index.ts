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
 * The rates a quote is calculated against.
 *
 * Passed in rather than held here on purpose. These figures live in the
 * `settings` table so an admin owns them, and a module that kept its own copy
 * would be a second source of truth — the announcement bar would say one thing
 * and the bag another the moment someone changed it.
 */
export type ShippingRates = {
  freeShippingThresholdPaise: Money;
  flatRatePaise: Money;
};

/**
 * Last-resort rates, used only when settings cannot be read at all. Marked
 * clearly as a fallback so a wrong number is obviously a wrong number rather
 * than looking like a decision.
 */
export const FALLBACK_RATES: ShippingRates = {
  freeShippingThresholdPaise: 199900,
  flatRatePaise: 9900,
};

/**
 * Interim rate used while no courier is contracted. Free above the threshold,
 * flat below it. Real rates will come from the provider by pincode, and this
 * function retires with them.
 */
export function estimateShipping(subtotalPaise: Money, rates: ShippingRates): Money {
  return subtotalPaise >= rates.freeShippingThresholdPaise ? 0 : rates.flatRatePaise;
}

/** How much more the customer must spend to cross the free-shipping line. */
export function amountToFreeShipping(
  subtotalPaise: Money,
  rates: ShippingRates,
): Money {
  return Math.max(0, rates.freeShippingThresholdPaise - subtotalPaise);
}
