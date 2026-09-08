'use client';

/**
 * Registers the storefront actions an embedding host can call on the page.
 *
 * This is presentation glue, not a trusted path: the tools only move items in
 * the local bag and wishlist. Anything that costs money still has to go
 * through checkout, where the server prices the order.
 */

import { useEffect } from 'react';
import type { ProductListItem } from '@mridul/types';
import { useStore } from '../providers/store-provider';

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

export function ModelContextTools({ products }: { products: ProductListItem[] }) {
  const { addLine, toggleWishlist } = useStore();

  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;

    const byId = new Map(products.map((product) => [product.id, product]));

    function readProduct(input: unknown) {
      if (
        typeof input !== 'object' ||
        input === null ||
        !('productId' in input) ||
        typeof input.productId !== 'string'
      ) {
        throw new Error('Choose a valid featured product ID.');
      }
      const product = byId.get(input.productId);
      if (!product) throw new Error('Choose a valid featured product ID.');
      return product;
    }

    const lifecycle = new AbortController();
    const inputSchema = {
      type: 'object',
      properties: {
        productId: { type: 'string', enum: [...byId.keys()] },
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
            const product = readProduct(input);
            const variant = product.variants.find((item) => item.stock > 0);
            if (!variant) return { productId: product.id, added: false };
            addLine({
              productId: product.id,
              productSlug: product.slug,
              variantId: variant.id,
              name: product.name,
              variantLabel: variant.label,
              unitPricePaise: product.pricePaise + variant.priceDeltaPaise,
              image: {
                url: product.images[0].url,
                focal: product.images[0].focal,
                alt: product.images[0].alt,
              },
            });
            return { productId: product.id, added: true };
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
            const product = readProduct(input);
            return { productId: product.id, liked: toggleWishlist(product.id) };
          },
        },
        { signal: lifecycle.signal },
      ),
    ];

    registrations.forEach((registration) => {
      void Promise.resolve(registration).catch(() => undefined);
    });

    return () => lifecycle.abort();
  }, [products, addLine, toggleWishlist]);

  return null;
}
