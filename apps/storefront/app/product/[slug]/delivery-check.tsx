'use client';

/**
 * Pincode delivery check.
 *
 * No courier is contracted yet, so this deliberately does not invent a
 * delivery date. It validates the pincode shape, quotes from the shared
 * shipping module — the same numbers the bag uses — and says plainly that the
 * exact charge is settled at checkout once a provider is connected.
 */

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPaise } from '@mridul/utils';
import { estimateShipping, type ShippingRates } from '@mridul/shipping';

/** Indian pincodes are six digits and never start with zero. */
const PINCODE = /^[1-9][0-9]{5}$/;

export function DeliveryCheck({
  pricePaise,
  rates,
}: {
  pricePaise: number;
  rates: ShippingRates;
}) {
  const [pincode, setPincode] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function check(event: React.FormEvent) {
    event.preventDefault();
    if (!PINCODE.test(pincode)) {
      setResult({ ok: false, message: 'Enter a valid 6-digit pincode.' });
      return;
    }
    const shipping = estimateShipping(pricePaise, rates);
    setResult({
      ok: true,
      message:
        shipping === 0
          ? `We deliver to ${pincode}. This order ships free.`
          : `We deliver to ${pincode}. Shipping is about ${formatPaise(shipping)}, free above ${formatPaise(rates.freeShippingThresholdPaise)}.`,
    });
  }

  return (
    <form className="delivery-check" onSubmit={check}>
      <label htmlFor="pincode">Check delivery</label>
      <div>
        <MapPin aria-hidden="true" />
        <input
          autoComplete="postal-code"
          id="pincode"
          inputMode="numeric"
          maxLength={6}
          onChange={(event) => {
            setPincode(event.target.value.replace(/\D/g, ''));
            setResult(null);
          }}
          placeholder="Enter pincode"
          value={pincode}
        />
        <Button size="sm" type="submit" variant="outline">
          Check
        </Button>
      </div>
      {result && (
        <p className={result.ok ? 'is-ok' : 'is-bad'} aria-live="polite">
          {result.message}
        </p>
      )}
      <small>
        Exact charges and delivery dates are confirmed at checkout once a courier is
        assigned.
      </small>
    </form>
  );
}
