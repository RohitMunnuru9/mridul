'use client';

/**
 * Confirmation toasts for bag and wishlist actions.
 *
 * Quick-add from a card is otherwise silent — the only feedback is a number
 * changing in the corner, which is easy to miss on a phone. Each toast names
 * what happened and offers the obvious next step.
 *
 * Dismissal is user-driven rather than on a timer, so nothing disappears from
 * under someone using a screen reader or reading slowly.
 */

import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { useStore } from '../providers/store-provider';

export function ToastHost() {
  const { toasts, dismissToast } = useStore();
  if (toasts.length === 0) return null;

  return (
    <div aria-live="polite" className="toast-host">
      {toasts.map((toast) => (
        <div className="toast" key={toast.id}>
          <Check aria-hidden="true" />
          <p>{toast.message}</p>
          {toast.action && (
            <Link href={toast.action.href} onClick={() => dismissToast(toast.id)}>
              {toast.action.label}
            </Link>
          )}
          <button
            aria-label="Dismiss"
            onClick={() => dismissToast(toast.id)}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
