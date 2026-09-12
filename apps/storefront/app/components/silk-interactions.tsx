'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';

const PLEATS = 9;
const FOLD_W = 84;
const FOLD_H = 112;

/**
 * The piece is pleated into the bag.
 *
 * A saree is put away by pleating it, so that is what this does: the
 * photograph is cut into nine vertical panels, each one folds in turn from the
 * outside edges inward the way cloth is gathered over an arm, and the gathered
 * bundle travels to the bag.
 *
 * Earlier attempts drew a motif in a panel over the page — a sprig, a lotus, a
 * loom. All of them covered the garment and none of them belonged to the act
 * of adding it. This uses the product's own photograph as the material, which
 * is the only thing on screen that is actually about this purchase.
 *
 * `pointer-events: none` throughout, and skipped entirely for anyone who asked
 * for less motion.
 */
export function flyToBag(source: HTMLElement, imageUrl: string) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const target = document.querySelector('[data-bag-target]');
  if (!target) return;

  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();

  const fold = document.createElement('div');
  fold.className = 'bag-fold';
  fold.setAttribute('aria-hidden', 'true');
  fold.style.left = `${from.left + from.width / 2 - FOLD_W / 2}px`;
  fold.style.top = `${from.top - FOLD_H / 2}px`;
  fold.style.width = `${FOLD_W}px`;
  fold.style.height = `${FOLD_H}px`;

  for (let i = 0; i < PLEATS; i += 1) {
    const pleat = document.createElement('span');
    pleat.style.backgroundImage = `url(${imageUrl})`;
    // Each panel shows its own slice of the one photograph, so the strips read
    // as a picture being folded rather than nine unrelated bars.
    pleat.style.backgroundSize = `${PLEATS * 100}% 100%`;
    pleat.style.backgroundPosition = `${(i / (PLEATS - 1)) * 100}% 50%`;
    fold.appendChild(pleat);
  }
  document.body.appendChild(fold);

  const middle = (PLEATS - 1) / 2;
  fold.querySelectorAll<HTMLSpanElement>('span').forEach((pleat, i) => {
    // Outermost panels fold first; the centre is the last to close.
    const fromEdge = middle - Math.abs(i - middle);
    pleat.animate(
      [
        { transform: 'perspective(320px) rotateY(0deg)', filter: 'brightness(1)' },
        {
          transform: `perspective(320px) rotateY(${i < middle ? 74 : -74}deg)`,
          filter: `brightness(${i % 2 ? 0.74 : 1.12})`,
        },
      ],
      {
        duration: 380,
        delay: fromEdge * 42,
        easing: 'cubic-bezier(.5,0,.4,1)',
        fill: 'both',
      },
    );
  });

  const travel = fold.animate(
    [
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1, offset: 0 },
      { transform: 'translate(0,-14px) scale(1.04) rotate(-3deg)', opacity: 1, offset: 0.3 },
      {
        transform:
          `translate(${to.left + to.width / 2 - from.left - from.width / 2}px,` +
          `${to.top + to.height / 2 - from.top + FOLD_H / 2}px) scale(.12) rotate(9deg)`,
        opacity: 0.15,
        offset: 1,
      },
    ],
    { duration: 900, easing: 'cubic-bezier(.36,.02,.2,1)' },
  );
  const clear = () => fold.remove();
  travel.onfinish = clear;
  travel.oncancel = clear;
}

export function SilkInteractions() {
  const curtain = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    curtain.current?.classList.remove('is-leaving');
    curtain.current?.classList.add('is-arriving');
  }, [pathname]);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fine = window.matchMedia('(pointer: fine)');
    let magnetic: HTMLElement | null = null;
    const move = (event: PointerEvent) => {
      if (!fine.matches || reduced.matches) return;
      const element = event.target instanceof Element ? event.target : null;
      const button = element?.closest<HTMLElement>('[data-magnetic]') ?? null;
      if (magnetic && magnetic !== button) magnetic.style.translate = '';
      magnetic = button;
      if (button) {
        const box = button.getBoundingClientRect();
        button.style.translate = `${(event.clientX - box.left - box.width / 2) * 0.08}px ${(event.clientY - box.top - box.height / 2) * 0.12}px`;
      }
    };
    const leave = () => {
      if (magnetic) magnetic.style.translate = '';
    };
    const navigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        reduced.matches
      )
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href]')
          : null;
      if (
        !anchor ||
        anchor.target ||
        anchor.hasAttribute('download') ||
        anchor.closest('[role="dialog"]')
      )
        return;
      const url = new URL(anchor.href, location.href);
      if (
        url.origin !== location.origin ||
        url.hash ||
        url.pathname === location.pathname
      )
        return;
      event.preventDefault();
      if (pending.current) clearTimeout(pending.current);
      curtain.current?.classList.remove('is-arriving');
      curtain.current?.classList.add('is-leaving');
      pending.current = setTimeout(() => {
        router.push(url.pathname + url.search);
        pending.current = null;
        // The effect on `pathname` lifts the curtain as soon as the new route
        // commits. This is only a fallback for a navigation that never
        // resolves — at 1800ms it was the thing holding a blank panel on
        // screen for nearly two seconds even when the page was ready.
        setTimeout(() => {
          curtain.current?.classList.remove('is-leaving');
          curtain.current?.classList.add('is-arriving');
        }, 900);
      }, 450);
    };
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    document.addEventListener('click', navigate, true);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
      document.removeEventListener('click', navigate, true);
      if (pending.current) clearTimeout(pending.current);
    };
  }, [router]);
  return (
    <>
      <div ref={curtain} className="page-fabric" aria-hidden="true">
        {/* Warp threads, drawn rather than an image: two repeating gradients
            cost nothing and never wait on a request mid-navigation. */}
        <span className="page-fabric-warp" />
        <span className="page-fabric-mark">
          <Image
            alt=""
            height={880}
            sizes="240px"
            src="/images/brand/mridul-logo.jpg"
            width={880}
          />
          <span className="page-fabric-rule" />
        </span>
      </div>
    </>
  );
}
