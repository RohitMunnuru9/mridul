'use client';

/**
 * Client-side cart and wishlist.
 *
 * This is the browser half of what will become the `carts` / `cart_items` and
 * `wishlists` / `wishlist_items` tables. It keeps a guest cart in
 * localStorage so a customer can shop before signing in; on sign-in the local
 * cart should be merged into the customer's server cart and this becomes a
 * cache of that.
 *
 * localStorage is an external store, so it is read through
 * `useSyncExternalStore` rather than an effect. The server snapshot is empty,
 * which is what the server renders, and React swaps in the real values once
 * hydration finishes — no mismatch, and no cascading render on mount.
 *
 * The stored line carries a price snapshot for display only. Totals shown here
 * are indicative — checkout must re-read prices, stock and shipping from the
 * database and ignore whatever the browser reports.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'mridul.store.v1';

export type CartLine = {
  productId: string;
  productSlug: string;
  variantId: string;
  /** Display snapshot. Never used as the basis for a charge. */
  name: string;
  variantLabel: string;
  unitPricePaise: number;
  image: { url: string; focal: string; alt: string };
  quantity: number;
};

type State = {
  lines: CartLine[];
  wishlist: string[];
};

/** What the server renders, and the fallback whenever storage is unreadable. */
const EMPTY: State = { lines: [], wishlist: [] };

const listeners = new Set<() => void>();
let snapshot: State = EMPTY;
let loaded = false;

function read(): State {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<State>;
    return {
      lines: Array.isArray(parsed.lines) ? parsed.lines : [],
      wishlist: Array.isArray(parsed.wishlist) ? parsed.wishlist : [],
    };
  } catch {
    // A corrupt or blocked store should never take the storefront down.
    return EMPTY;
  }
}

function getSnapshot(): State {
  if (!loaded) {
    snapshot = read();
    loaded = true;
  }
  return snapshot;
}

function getServerSnapshot(): State {
  return EMPTY;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Keep a second tab in step with this one.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    snapshot = read();
    listeners.forEach((listener) => listener());
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

function update(next: State) {
  snapshot = next;
  loaded = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private browsing and full quotas are not worth breaking the page over.
  }
  listeners.forEach((listener) => listener());
}

/** A short confirmation shown after a bag or wishlist action. */
export type Toast = {
  id: number;
  message: string;
  /** Optional follow-up, e.g. "View bag". */
  action?: { label: string; href: string };
};

type StoreValue = {
  lines: CartLine[];
  wishlist: string[];
  cartCount: number;
  /** Indicative subtotal in paise; the server recomputes it at checkout. */
  subtotalPaise: number;
  toasts: Toast[];
  addLine: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  removeLine: (variantId: string) => void;
  clearBag: () => void;
  /** Takes a line out of the bag and saves the product instead. */
  moveLineToWishlist: (variantId: string) => void;
  toggleWishlist: (productId: string) => boolean;
  isWishlisted: (productId: string) => boolean;
  notify: (message: string, action?: Toast['action']) => void;
  dismissToast: (id: number) => void;
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [toasts, setToasts] = useState<Toast[]>([]);
  // A counter rather than a timestamp: ids only need to be unique, and
  // Date.now() would tie the markup to the moment it rendered.
  const nextToastId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((message: string, action?: Toast['action']) => {
    const id = (nextToastId.current += 1);
    setToasts((current) => [...current.slice(-2), { id, message, action }]);
  }, []);

  const addLine = useCallback(
    (line: Omit<CartLine, 'quantity'>, quantity = 1) => {
      const current = getSnapshot();
      const index = current.lines.findIndex(
        (item) => item.variantId === line.variantId,
      );
      const lines =
        index === -1
          ? [...current.lines, { ...line, quantity }]
          : current.lines.map((item, position) =>
              position === index
                ? { ...item, quantity: item.quantity + quantity }
                : item,
            );
      update({ ...current, lines });
    },
    [],
  );

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    const current = getSnapshot();
    update({
      ...current,
      lines:
        quantity <= 0
          ? current.lines.filter((item) => item.variantId !== variantId)
          : current.lines.map((item) =>
              item.variantId === variantId ? { ...item, quantity } : item,
            ),
    });
  }, []);

  const removeLine = useCallback((variantId: string) => {
    const current = getSnapshot();
    update({
      ...current,
      lines: current.lines.filter((item) => item.variantId !== variantId),
    });
  }, []);

  const clearBag = useCallback(() => {
    update({ ...getSnapshot(), lines: [] });
  }, []);

  const moveLineToWishlist = useCallback((variantId: string) => {
    const current = getSnapshot();
    const line = current.lines.find((item) => item.variantId === variantId);
    if (!line) return;
    update({
      lines: current.lines.filter((item) => item.variantId !== variantId),
      wishlist: current.wishlist.includes(line.productId)
        ? current.wishlist
        : [...current.wishlist, line.productId],
    });
  }, []);

  const toggleWishlist = useCallback((productId: string) => {
    const current = getSnapshot();
    const has = current.wishlist.includes(productId);
    update({
      ...current,
      wishlist: has
        ? current.wishlist.filter((id) => id !== productId)
        : [...current.wishlist, productId],
    });
    return !has;
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      lines: state.lines,
      wishlist: state.wishlist,
      cartCount: state.lines.reduce((total, line) => total + line.quantity, 0),
      subtotalPaise: state.lines.reduce(
        (total, line) => total + line.unitPricePaise * line.quantity,
        0,
      ),
      toasts,
      addLine,
      setQuantity,
      removeLine,
      clearBag,
      moveLineToWishlist,
      toggleWishlist,
      isWishlisted: (productId: string) => state.wishlist.includes(productId),
      notify,
      dismissToast,
    }),
    [
      state,
      toasts,
      addLine,
      setQuantity,
      removeLine,
      clearBag,
      moveLineToWishlist,
      toggleWishlist,
      notify,
      dismissToast,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used inside a StoreProvider.');
  return context;
}
