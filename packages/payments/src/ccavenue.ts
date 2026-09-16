/**
 * CCAvenue, as this shop talks to it.
 *
 * Server only. Everything in this file touches the working key, which is the
 * shared secret that both encrypts the request and authenticates the response.
 * It must never be reachable from a browser bundle, so the module refuses to
 * initialise in one.
 *
 * ---------------------------------------------------------------------------
 * The shape of the conversation
 *
 *   1. We build a `key=value&key=value` string, encrypt it, and POST it to
 *      CCAvenue as `encRequest`. The customer pays on CCAvenue's own page —
 *      no card detail ever reaches this server.
 *   2. CCAvenue sends the customer's browser back to us with an `encResp`.
 *   3. We decrypt it. And then we ignore what it says about success, and ask
 *      CCAvenue over our own connection whether that order was really paid.
 *
 * Step 3 is the one that matters. The redirect in step 2 travels through the
 * customer's browser, which is a channel the customer controls: it can be
 * replayed, dropped, or never arrive at all because they closed the tab on the
 * bank page. Decrypting it proves only that somebody holding the working key
 * composed it at some point — not that this payment, for this order, for this
 * amount, just succeeded. `fetchOrderStatus` is what proves that.
 *
 * ---------------------------------------------------------------------------
 * About the cipher
 *
 * AES-128-CBC with the key derived as a raw MD5 of the working key, and a
 * fixed, published IV. That is CCAvenue's scheme, not a choice made here — it
 * is what their gateway will decrypt, so it is what we send. It is dated
 * (MD5-derived key, constant IV, no MAC), which is precisely why the
 * server-to-server status check is treated as the real authority and the
 * decrypted redirect as a hint.
 */

import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';

if (typeof window !== 'undefined') {
  throw new Error(
    'packages/payments/ccavenue was imported in a browser. The working key ' +
      'must never be shipped to a client.',
  );
}

/** CCAvenue's published initialisation vector: the bytes 0x00 … 0x0f. */
const IV = Buffer.from([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c,
  0x0d, 0x0e, 0x0f,
]);

export type CCAvenueConfig = {
  merchantId: string;
  accessCode: string;
  workingKey: string;
  /** Their sandbox and production hosts are different. Default is production. */
  test: boolean;
};

/**
 * Credentials, read once per call from the environment.
 *
 * Deliberately not module-level constants: a missing variable should fail the
 * one request that needed it with a sentence somebody can act on, not crash
 * the whole app at import time and take the catalogue down with it.
 */
export function ccavenueConfig(): CCAvenueConfig {
  const merchantId = process.env.CCAVENUE_MERCHANT_ID;
  const accessCode = process.env.CCAVENUE_ACCESS_CODE;
  const workingKey = process.env.CCAVENUE_WORKING_KEY;

  const missing = [
    !merchantId && 'CCAVENUE_MERCHANT_ID',
    !accessCode && 'CCAVENUE_ACCESS_CODE',
    !workingKey && 'CCAVENUE_WORKING_KEY',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`CCAvenue is not configured. Missing: ${missing.join(', ')}.`);
  }

  return {
    merchantId: merchantId as string,
    accessCode: accessCode as string,
    workingKey: workingKey as string,
    test: process.env.CCAVENUE_ENV === 'test',
  };
}

function key(workingKey: string): Buffer {
  return createHash('md5').update(workingKey, 'utf8').digest();
}

export function encrypt(plain: string, workingKey: string): string {
  const cipher = createCipheriv('aes-128-cbc', key(workingKey), IV);
  return cipher.update(plain, 'utf8', 'hex') + cipher.final('hex');
}

export function decrypt(encoded: string, workingKey: string): string {
  const decipher = createDecipheriv('aes-128-cbc', key(workingKey), IV);
  return decipher.update(encoded.trim(), 'hex', 'utf8') + decipher.final('utf8');
}

/**
 * CCAvenue's payload is a flat `a=1&b=2` string with no escaping of its own,
 * so a value containing `&` or `=` would silently become two fields — or, with
 * a crafted address line, a field we never meant to send. Strip them, along
 * with the newlines that would break the line format.
 */
function clean(value: string): string {
  return value.replace(/[&=\r\n]/g, ' ').trim();
}

export function toPayload(fields: Record<string, string | number | undefined>): string {
  return Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([name, value]) => `${name}=${clean(String(value))}`)
    .join('&');
}

export function fromPayload(payload: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of payload.split('&')) {
    const at = pair.indexOf('=');
    if (at > 0) out[pair.slice(0, at).trim()] = pair.slice(at + 1).trim();
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Sending the customer to pay                                                */
/* -------------------------------------------------------------------------- */

const TRANSACTION_HOST = {
  live: 'https://secure.ccavenue.com',
  test: 'https://test.ccavenue.com',
} as const;

const API_HOST = {
  live: 'https://api.ccavenue.com',
  test: 'https://apitest.ccavenue.com',
} as const;

export type BillingDetails = {
  name: string;
  email: string;
  /** Ten digits, without the +91 — CCAvenue rejects the country prefix. */
  phone: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
};

/**
 * The form the browser submits to CCAvenue.
 *
 * `amountRupees` is a string with two decimal places because CCAvenue's field
 * is rupees, not paise. The conversion happens here, once, from the figure the
 * database gave us — never from anything the client sent.
 */
export function buildPaymentRequest(input: {
  config: CCAvenueConfig;
  orderNumber: string;
  amountPaise: number;
  redirectUrl: string;
  cancelUrl: string;
  billing: BillingDetails;
}): { action: string; encRequest: string; accessCode: string } {
  const { config, billing } = input;

  const payload = toPayload({
    merchant_id: config.merchantId,
    order_id: input.orderNumber,
    amount: (input.amountPaise / 100).toFixed(2),
    currency: 'INR',
    redirect_url: input.redirectUrl,
    cancel_url: input.cancelUrl,
    language: 'EN',
    billing_name: billing.name,
    billing_address: billing.line1,
    billing_city: billing.city,
    billing_state: billing.state,
    billing_zip: billing.pincode,
    billing_country: 'India',
    billing_tel: billing.phone,
    billing_email: billing.email,
  });

  const host = config.test ? TRANSACTION_HOST.test : TRANSACTION_HOST.live;

  return {
    action: `${host}/transaction/transaction.do?command=initiateTransaction`,
    encRequest: encrypt(payload, config.workingKey),
    accessCode: config.accessCode,
  };
}

/* -------------------------------------------------------------------------- */
/* Asking CCAvenue what actually happened                                     */
/* -------------------------------------------------------------------------- */

export type GatewayStatus = {
  /** True only for CCAvenue's own 'Success'. Anything else is not paid. */
  paid: boolean;
  orderNumber: string;
  /** In paise, converted from the rupee figure CCAvenue reports. */
  amountPaise: number | null;
  status: string;
  trackingId: string | null;
  bankReference: string | null;
  paymentMode: string | null;
  message: string | null;
};

function toPaise(rupees: string | undefined): number | null {
  if (!rupees) return null;
  const value = Number.parseFloat(rupees);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

function readStatus(fields: Record<string, string>): GatewayStatus {
  const status = fields.order_status ?? fields.order_bank_response ?? 'Unknown';
  return {
    paid: status.toLowerCase() === 'success',
    orderNumber: fields.order_no ?? fields.order_id ?? '',
    amountPaise: toPaise(fields.order_amt ?? fields.amount),
    status,
    trackingId: fields.reference_no ?? fields.tracking_id ?? null,
    bankReference: fields.order_bank_ref_no ?? fields.bank_ref_no ?? null,
    paymentMode: fields.order_option ?? fields.payment_mode ?? null,
    message: fields.status_message ?? fields.failure_message ?? null,
  };
}

/** What the browser brought back. A hint, never a decision. */
export function readRedirect(encResp: string, workingKey: string): GatewayStatus {
  return readStatus(fromPayload(decrypt(encResp, workingKey)));
}

/**
 * Ask CCAvenue directly, over our own TLS connection, whether this order was
 * paid. This is the answer the system acts on.
 *
 * Their status API answers in JSON wrapped around an encrypted payload, and
 * the shapes it uses have varied between versions — so the parsing below is
 * forgiving about where the fields sit, and the caller treats anything it
 * cannot read as "not paid" rather than guessing.
 */
export async function fetchOrderStatus(
  config: CCAvenueConfig,
  orderNumber: string,
): Promise<GatewayStatus> {
  const host = config.test ? API_HOST.test : API_HOST.live;
  const request = encrypt(
    JSON.stringify({ order_no: orderNumber }),
    config.workingKey,
  );

  const body = new URLSearchParams({
    enc_request: request,
    access_code: config.accessCode,
    request_type: 'JSON',
    response_type: 'JSON',
    command: 'orderStatusTracker',
    version: '1.2',
  });

  const response = await fetch(`${host}/apis/servlet/DoWebTrans`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`CCAvenue status check failed with HTTP ${response.status}`);
  }

  const text = await response.text();

  // The outer envelope is either `status=0&enc_response=...` or a JSON object
  // carrying the same encrypted string.
  let encrypted = fromPayload(text).enc_response;
  if (!encrypted) {
    try {
      const envelope = JSON.parse(text) as Record<string, string>;
      encrypted = envelope.enc_response ?? envelope.encResponse;
    } catch {
      /* Not JSON either — handled just below. */
    }
  }
  if (!encrypted) {
    throw new Error('CCAvenue status response could not be read.');
  }

  const decrypted = decrypt(encrypted, config.workingKey);

  // The decrypted body is JSON in current versions and the old flat format in
  // older ones. Both are accepted; neither is trusted for the amount, which
  // the database checks again.
  try {
    const parsed = JSON.parse(decrypted) as Record<string, unknown>;
    const order = (parsed.Order_Status_Result ??
      parsed.order_status_result ??
      parsed) as Record<string, string>;
    return readStatus(order);
  } catch {
    return readStatus(fromPayload(decrypted));
  }
}
