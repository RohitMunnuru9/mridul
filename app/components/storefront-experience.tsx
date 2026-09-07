'use client';

import { useEffect, useRef, useState } from 'react';
import { products } from '../catalog';
import { CategoryRail } from './category-rail';
import { Hero } from './hero';
import { JournalSection } from './journal-section';
import { OccasionEdit } from './occasion-edit';
import { ProductShowcase } from './product-showcase';
import { SiteFooter } from './site-footer';
import { StorefrontHeader } from './storefront-header';
import { StorySection } from './story-section';
import { Heart, Home, ShoppingBag, Store, UserRound } from 'lucide-react';

type WebTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};

type ModelContext = {
  registerTool: (
    tool: WebTool,
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

function productExists(productId: string) {
  return products.some((product) => product.id === productId);
}

function readProductId(input: unknown) {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('productId' in input) ||
    typeof input.productId !== 'string' ||
    !productExists(input.productId)
  ) {
    throw new Error('Choose a valid featured product ID.');
  }
  return input.productId;
}

export function StorefrontExperience() {
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const likedRef = useRef<Set<string>>(new Set());
  const [cartCount, setCartCount] = useState(0);

  function toggleWishlist(productId: string) {
    const next = new Set(likedRef.current);
    if (next.has(productId)) next.delete(productId);
    else next.add(productId);
    likedRef.current = next;
    setLiked(next);
    return next.has(productId);
  }

  function addToBag(productId: string) {
    if (!productExists(productId)) return false;
    setCartCount((count) => count + 1);
    return true;
  }

  useEffect(() => {
    const context = (
      document as Document & { modelContext?: ModelContext }
    ).modelContext;
    if (!context?.registerTool) return;

    const lifecycle = new AbortController();
    const inputSchema = {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          enum: products.map((product) => product.id),
        },
      },
      required: ['productId'],
      additionalProperties: false,
    };

    const registrations = [
      context.registerTool(
        {
          name: 'add_featured_product_to_bag',
          title: 'Add featured product to bag',
          description:
            'Add one of the currently featured Mridul sarees to the visible shopping bag.',
          inputSchema,
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            const productId = readProductId(input);
            addToBag(productId);
            return { productId, added: true };
          },
        },
        { signal: lifecycle.signal },
      ),
      context.registerTool(
        {
          name: 'toggle_featured_product_wishlist',
          title: 'Toggle featured product wishlist',
          description:
            'Add or remove one of the currently featured Mridul sarees from the visible wishlist.',
          inputSchema,
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            const productId = readProductId(input);
            return { productId, liked: toggleWishlist(productId) };
          },
        },
        { signal: lifecycle.signal },
      ),
    ];

    registrations.forEach((registration) => {
      void Promise.resolve(registration).catch(() => undefined);
    });

    return () => lifecycle.abort();
  }, []);

  return (
    <main id="top">
      <StorefrontHeader cartCount={cartCount} wishlistCount={liked.size} />
      <Hero />
      <CategoryRail />
      <OccasionEdit />
      <ProductShowcase
        liked={liked}
        onToggleWishlist={toggleWishlist}
        onAddToBag={addToBag}
      />
      <StorySection />
      <JournalSection />
      <SiteFooter />
      <nav className="mobile-bottom-nav" aria-label="Mobile quick navigation">
        <a href="#top"><Home aria-hidden="true" /><span>Home</span></a>
        <a href="#new-arrivals"><Heart aria-hidden="true" /><span>Wishlist</span>{liked.size > 0 && <b>{liked.size}</b>}</a>
        <a className="shop-tab" href="#categories"><Store aria-hidden="true" /><span>Shop</span></a>
        <a href="#top"><UserRound aria-hidden="true" /><span>Account</span></a>
        <a href="#new-arrivals"><ShoppingBag aria-hidden="true" /><span>Bag</span>{cartCount > 0 && <b>{cartCount}</b>}</a>
      </nav>
    </main>
  );
}
