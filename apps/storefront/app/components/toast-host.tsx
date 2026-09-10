'use client';

/**
 * Confirmation toasts for bag and wishlist actions.
 *
 * Quick-add from a card is otherwise silent — the only feedback is a number
 * changing in the corner, which is easy to miss on a phone. Each toast names
 * what happened and offers the obvious next step.
 *
 * Each toast clears itself after a few seconds. When its time is up it checks
 * whether the pointer is over it or the keyboard is inside it, and if so waits
 * and asks again — which is the case the old hand-dismissal was protecting:
 * nothing is pulled away from under someone reading it or reaching for "View
 * bag". That check reads the browser's own :hover state rather than tracking
 * enter/leave events, so a missed event cannot strand a toast on screen for
 * ever. The × stays for anyone who wants it gone sooner.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { useStore } from '../providers/store-provider';
import type { Toast as ToastData } from '../providers/store-provider';

/** Long enough to read a product name and decide to open the bag. */
const LINGER_MS = 5000;
/** How often to re-ask while it is being read. */
const RECHECK_MS = 400;
/** Matches the fade in CSS; the toast is removed once it has gone. */
const FADE_MS = 260;

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastData;
  onDismiss: (id: number) => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (leaving) return undefined;
    let timer: ReturnType<typeof setTimeout>;
    const expire = () => {
      const node = card.current;
      const busy =
        node !== null &&
        (node.matches(':hover') || node.contains(document.activeElement));
      if (busy) {
        timer = setTimeout(expire, RECHECK_MS);
        return;
      }
      setLeaving(true);
    };
    timer = setTimeout(expire, LINGER_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  useEffect(() => {
    if (!leaving) return undefined;
    const timer = setTimeout(() => onDismiss(toast.id), FADE_MS);
    return () => clearTimeout(timer);
  }, [leaving, onDismiss, toast.id]);

  return (
    <div className={`toast${leaving ? ' is-leaving' : ''}`} ref={card}>
      <Check aria-hidden="true" />
      <p>{toast.message}</p>
      {toast.action && (
        <Link href={toast.action.href} onClick={() => onDismiss(toast.id)}>
          {toast.action.label}
        </Link>
      )}
      <button aria-label="Dismiss" onClick={() => onDismiss(toast.id)} type="button">
        <X aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastHost() {
  const { toasts, dismissToast } = useStore();
  if (toasts.length === 0) return null;

  return (
    <div aria-live="polite" className="toast-host">
      {toasts.map((toast) => (
        <Toast key={toast.id} onDismiss={dismissToast} toast={toast} />
      ))}
    </div>
  );
}
