'use client';

/**
 * "Tell us what went wrong and we will arrange it."
 *
 * The help panel has said that since the shop opened. This is where the
 * customer finally can: tick the pieces, say why, add a line if they want to.
 *
 * Nothing here decides whether they are allowed — the server does that, and
 * the page only draws this form when `returnEligibility` says it would not be
 * refused. Drawing a form that always ends in "the window has closed" is worse
 * than a sentence saying so.
 */

import { useState, useTransition } from 'react';
import { RotateCcw } from 'lucide-react';
import { requestReturn } from './return-action';

type Line = { id: string; name: string; variantLabel: string; quantity: number };
type Reason = { value: string; label: string };

export function RequestReturn({
  orderId,
  orderNumber,
  lines,
  reasons,
  daysLeft,
}: {
  orderId: string;
  orderNumber: string;
  lines: Line[];
  /** Handed down by the server page. This component deliberately imports
   *  nothing from the database package: that package reaches the Supabase
   *  client, and a browser bundle has no business carrying it. */
  reasons: Reason[];
  daysLeft: number;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      setResult(await requestReturn(orderId, orderNumber, formData));
    });
  }

  if (result?.ok) {
    return (
      <p className="order-payment-note is-ok" role="status">
        {result.message}
      </p>
    );
  }

  return (
    <form action={submit} className="return-form">
      <p className="return-form-intro">
        {daysLeft === 1
          ? 'Today is the last day to ask.'
          : `You have ${daysLeft} days left to ask.`}{' '}
        Pieces should be unworn, with their tags still on.
      </p>

      <fieldset className="return-lines">
        <legend>What are you sending back?</legend>
        {lines.map((line) => {
          const on = chosen.has(line.id);
          return (
            <label className={`return-line${on ? ' is-on' : ''}`} key={line.id}>
              <input
                checked={on}
                onChange={() => toggle(line.id)}
                type="checkbox"
              />
              <span className="return-line-body">
                <strong>{line.name}</strong>
                <small>{line.variantLabel}</small>
              </span>
              {/* The quantity is only sent for ticked lines, and only offered
                  when there is more than one to choose between. */}
              {on && line.quantity > 1 ? (
                <select
                  aria-label={`How many ${line.name} to return`}
                  className="return-qty"
                  defaultValue={line.quantity}
                  name={`item:${line.id}`}
                >
                  {Array.from({ length: line.quantity }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} of {line.quantity}
                    </option>
                  ))}
                </select>
              ) : on ? (
                <input name={`item:${line.id}`} type="hidden" value="1" />
              ) : null}
            </label>
          );
        })}
      </fieldset>

      <label className="return-field">
        <span>Why?</span>
        <select name="reason" required>
          <option value="">Choose one</option>
          {reasons.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </select>
      </label>

      <label className="return-field">
        <span>Anything we should know? (optional)</span>
        <textarea
          maxLength={1000}
          name="note"
          placeholder="Where the damage is, what you expected instead — anything that helps us sort it out."
          rows={3}
        />
      </label>

      {result && !result.ok && (
        <p className="order-payment-note is-waiting" role="alert">
          {result.message}
        </p>
      )}

      <button
        className="order-pay-again"
        disabled={pending || chosen.size === 0}
        type="submit"
      >
        <RotateCcw aria-hidden="true" />
        {pending ? 'Sending…' : 'Ask to return these'}
      </button>
    </form>
  );
}
