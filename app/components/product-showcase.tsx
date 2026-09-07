'use client';

import { ArrowLeft, ArrowRight, Heart, ShoppingBag } from 'lucide-react';
import { useRef } from 'react';
import { products } from '../catalog';
import { Button } from '@/components/ui/button';

export function ProductShowcase({ liked, onToggleWishlist, onAddToBag }: {
  liked: Set<string>;
  onToggleWishlist: (productId: string) => void;
  onAddToBag: (productId: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  function scroll(direction: -1 | 1) {
    rowRef.current?.scrollBy({ left: direction * rowRef.current.clientWidth * 0.82, behavior: 'smooth' });
  }

  return (
    <section className="product-section" id="new-arrivals" aria-labelledby="product-title">
      <div className="product-heading">
        <div><p>Fresh from the loom</p><h2 id="product-title">Mridul&apos;s picks</h2></div>
        <div className="product-heading-actions">
          <a href="#sarees">View all</a>
          <div className="product-navigation" aria-label="Product carousel controls">
            <Button variant="outline" size="icon" aria-label="Previous products" onClick={() => scroll(-1)}><ArrowLeft aria-hidden="true" /></Button>
            <Button variant="outline" size="icon" aria-label="Next products" onClick={() => scroll(1)}><ArrowRight aria-hidden="true" /></Button>
          </div>
        </div>
      </div>
      <div className="product-row" ref={rowRef}>
        {products.map((product) => {
          const isLiked = liked.has(product.id);
          return (
            <article className="product-card" key={product.id}>
              <div className="product-photo" aria-hidden="true" style={{ backgroundPosition: `${product.imagePosition} center` }}>
                {product.badge && <span className="product-badge">{product.badge}</span>}
                <Button variant="secondary" size="icon" aria-label={`${isLiked ? 'Remove' : 'Add'} ${product.name} ${isLiked ? 'from' : 'to'} wishlist`} aria-pressed={isLiked} className="wishlist-button" onClick={() => onToggleWishlist(product.id)}>
                  <Heart aria-hidden="true" fill={isLiked ? 'currentColor' : 'none'} />
                </Button>
              </div>
              <div className="product-details">
                <div><h3>{product.name}</h3><p>{product.fabric}</p></div>
                <div className="product-buy-row">
                  <div className="product-price-row"><strong>{product.price}</strong>{product.previousPrice && <s>{product.previousPrice}</s>}</div>
                  <Button variant="outline" size="icon" aria-label={`Add ${product.name} to bag`} className="quick-add" onClick={() => onAddToBag(product.id)}><ShoppingBag aria-hidden="true" /></Button>
                </div>
                <div className="swatches" aria-label="Available colours">{product.swatches.map((swatch) => <span key={swatch} style={{ background: swatch }} />)}</div>
              </div>
            </article>
          );
        })}
      </div>
      <a className="view-all-link" href="#sarees">Shop all sarees <ArrowRight aria-hidden="true" /></a>
    </section>
  );
}
