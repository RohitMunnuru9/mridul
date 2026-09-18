/**
 * The CCAvenue cipher.
 *
 * This is the one piece of the payment path that fails SILENTLY when it is
 * wrong. A broken signature check throws; a broken cipher just produces bytes
 * CCAvenue rejects with an unhelpful page, or — worse — decrypts their reply
 * into rubbish that then gets parsed. Nothing in a build or a typecheck would
 * notice, and the first symptom is a customer who cannot pay.
 *
 * The expected ciphertexts below were produced by an independent
 * implementation of CCAvenue's documented scheme — AES-128-CBC, the key a raw
 * MD5 of the working key, their fixed IV. The same vectors are in
 * `php/test-crypto.php`, so the two implementations are pinned to each other
 * as well as to the scheme.
 *
 * The key here is fake and nothing reaches the network.
 */

import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, fromPayload, toPayload } from '@mridul/payments/ccavenue';

const WORKING_KEY = 'TESTWORKINGKEY000000000000000000';

const VECTORS = [
  {
    name: 'a payment request',
    plain: 'merchant_id=12345&order_id=MR-2026-000007&amount=5200.00&currency=INR',
    cipher:
      '6114e13a4f5c0efbbd3d19c0cc19ce60f2fa6c9b1fe49aac817bcdb0f0e6de78' +
      'c6eaf7c32965771c108786d6370cc3d5e645e233ced1bbfe6531323d17be4c5a' +
      '7d6acdbeb3a98b928fd38e5a50f7d3ae',
  },
  {
    name: 'a status enquiry',
    plain: 'order_no=MR-2026-000007',
    cipher: 'cfa45f6de9b75c1005ea494aa330bf506b1712dd10dc76264b5208d8a8d29603',
  },
];

describe('CCAvenue cipher', () => {
  for (const vector of VECTORS) {
    it(`encrypts ${vector.name} to the expected bytes`, () => {
      expect(encrypt(vector.plain, WORKING_KEY)).toBe(vector.cipher);
    });

    it(`decrypts ${vector.name} back`, () => {
      expect(decrypt(vector.cipher, WORKING_KEY)).toBe(vector.plain);
    });
  }

  it('produces different output under a different working key', () => {
    // If this ever passes, the key is not reaching the cipher and every
    // merchant would share one encryption.
    expect(encrypt(VECTORS[1].plain, WORKING_KEY)).not.toBe(
      encrypt(VECTORS[1].plain, 'ADIFFERENTKEY00000000000000000000'),
    );
  });

  it('refuses rubbish rather than returning something parseable', () => {
    for (const rubbish of ['not-hex-at-all', '', 'deadbeef']) {
      expect(() => decrypt(rubbish, WORKING_KEY)).toThrow();
    }
  });

  it('cannot be talked into inventing a field', () => {
    // CCAvenue's payload is a flat a=1&b=2 string with no escaping of its own,
    // so a value carrying `&` or `=` would otherwise become extra fields —
    // with a crafted address line, fields we never meant to send.
    const payload = toPayload({
      billing_name: 'A&B=Traders',
      billing_address: '12 Main Road\r\nAlwal',
      amount: '5200.00',
    });
    const parsed = fromPayload(payload);

    expect(Object.keys(parsed)).toEqual(['billing_name', 'billing_address', 'amount']);
    expect(parsed.billing_name).not.toContain('&');
    expect(parsed.billing_name).not.toContain('=');
    expect(parsed.amount).toBe('5200.00');
  });

  it('drops empty fields rather than sending blanks', () => {
    expect(toPayload({ a: '1', b: '', c: undefined, d: '2' })).toBe('a=1&d=2');
  });

  it('keeps a value containing an equals sign in one piece', () => {
    // The separator is the FIRST '=', so a base64-ish value with padding does
    // not lose its tail.
    expect(fromPayload('enc_response=abc==&status=0')).toEqual({
      enc_response: 'abc==',
      status: '0',
    });
  });
});
