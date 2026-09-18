'use client';

/**
 * The way back to the payment page.
 *
 * A card that was declined, or a tab closed on the bank's screen, leaves an
 * order sitting in `pending_payment` holding its stock. Without this, the only
 * route forward is to build the whole order again — which takes a second piece
 * of the same saree out of inventory and leaves the shop with two orders for
 * one customer.
 *
 * It sends them back to CCAvenue for the order that already exists. The amount
 * is read from that order on the server; nothing here decides what is owed.
 */

import { useState, useTransition } from 'react';
import { CreditCard } from 'lucide-react';
import { startCCAvenuePayment } from '../../checkout/ccavenue-action';

/** CCAvenue needs a real cross-site form POST; a fetch will not do. */
function handOver(action: string, fields: Record<string, string>) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export function RetryPayment({ orderId, amount }: { orderId: string; amount: string }) {
  const [pending, startTransition] = useTransition();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');

  function pay() {
    setError('');
    startTransition(async () => {
      const handoff = await startCCAvenuePayment(orderId);
      if (!handoff.ok) {
        setError(handoff.message);
        return;
      }
      setLeaving(true);
      handOver(handoff.action, {
        encRequest: handoff.encRequest,
        access_code: handoff.accessCode,
      });
    });
  }

  return (
    <>
      <button
        className="order-pay-again"
        disabled={pending || leaving}
        onClick={pay}
        type="button"
      >
        <CreditCard aria-hidden="true" />
        {leaving ? 'Taking you to the payment page…' : `Pay ${amount} now`}
      </button>
      {error && (
        <p className="order-payment-note is-waiting" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
