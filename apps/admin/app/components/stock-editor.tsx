"use client";

/**
 * Stock, adjustable from the product list.
 *
 * Changing how many of something is left is the most frequent edit there is
 * and the least deserving of a full page, so it sits in the row: minus, the
 * number, plus, and one Save for the whole product. Every option is shown,
 * because a saree that has sold out in M has not sold out.
 */

import { useActionState, useState } from "react";
import { Minus, Plus } from "lucide-react";

type Result = { ok: boolean; message: string };
type Variant = { id: string; label: string; stock: number };

export function StockEditor({
  action,
  variants,
}: {
  action: (formData: FormData) => Promise<Result>;
  variants: Variant[];
}) {
  const [state, formAction, pending] = useActionState(
    async (_previous: Result | null, formData: FormData) => action(formData),
    null,
  );

  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(variants.map((variant) => [variant.id, variant.stock])),
  );

  const saved = Object.fromEntries(variants.map((variant) => [variant.id, variant.stock]));
  const changed = variants.some((variant) => counts[variant.id] !== saved[variant.id]);
  const total = variants.reduce((sum, variant) => sum + (counts[variant.id] ?? 0), 0);

  /** Never below zero: negative stock is not a state the shop can be in. */
  function nudge(id: string, by: number) {
    setCounts((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + by) }));
  }

  function set(id: string, raw: string) {
    const value = Number.parseInt(raw, 10);
    setCounts((current) => ({ ...current, [id]: Number.isNaN(value) ? 0 : Math.max(0, value) }));
  }

  return (
    <form action={formAction} className="stock-editor">
      <div className="stock-editor-head">
        <span className="stock-editor-total">
          {total === 0 ? "Out of stock" : `${total} in stock`}
        </span>
      </div>

      <ul className="stock-editor-rows">
        {variants.map((variant) => (
          <li key={variant.id}>
            <span className="stock-editor-label" title={variant.label}>
              {variant.label}
            </span>
            <span className="stock-stepper">
              <button
                aria-label={`One fewer ${variant.label}`}
                disabled={pending || (counts[variant.id] ?? 0) === 0}
                onClick={() => nudge(variant.id, -1)}
                type="button"
              >
                <Minus aria-hidden="true" />
              </button>
              <input
                aria-label={`Stock for ${variant.label}`}
                inputMode="numeric"
                min={0}
                name={`stock:${variant.id}`}
                onChange={(event) => set(variant.id, event.target.value)}
                type="number"
                value={counts[variant.id] ?? 0}
              />
              <button
                aria-label={`One more ${variant.label}`}
                disabled={pending}
                onClick={() => nudge(variant.id, 1)}
                type="button"
              >
                <Plus aria-hidden="true" />
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="stock-editor-foot">
        <button className="btn-primary" disabled={pending || !changed} type="submit">
          {pending ? "Saving…" : "Save stock"}
        </button>
        {state && (
          <span className={state.ok ? "form-note is-ok" : "form-note is-bad"} role="status">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
