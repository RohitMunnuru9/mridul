'use client';

/**
 * Empty the bag once an online payment has actually gone through.
 *
 * A cash order clears the bag at the moment it is placed, because placing it
 * is the whole transaction. An online order cannot: between leaving for
 * CCAvenue and coming back, the payment may be declined or abandoned, and a
 * customer sent back to an empty bag would have to find every piece again to
 * retry. So the bag is held until the order is genuinely paid for, and this is
 * what lets it go.
 *
 * Renders nothing. It exists only for the effect.
 */

import { useEffect } from 'react';
import { useStore } from '../../providers/store-provider';

export function ClearBagOnPaid() {
  const { clearBag, clearBuyNow } = useStore();

  useEffect(() => {
    clearBag();
    clearBuyNow();
  }, [clearBag, clearBuyNow]);

  return null;
}
