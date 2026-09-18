'use client';

import { Printer } from 'lucide-react';

/**
 * Opens the browser's own print dialogue.
 *
 * The one piece of this feature that has to run in the browser, kept on its
 * own so the sheets themselves stay server-rendered — a page of addresses and
 * cash amounts has no reason to ship as JavaScript.
 *
 * It carries `no-print` so the button never appears on the paper it prints.
 */
export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button
      className="btn-primary print-btn no-print"
      onClick={() => window.print()}
      type="button"
    >
      <Printer aria-hidden="true" /> {label}
    </button>
  );
}
