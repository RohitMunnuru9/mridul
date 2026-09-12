'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';

/**
 * A curtain of cloth passes over the screen, and the piece is behind it.
 *
 * This is the one transition already approved here — the wine curtain with the
 * warp threads that covers a page change — cut short and given the product to
 * carry. Five quieter ideas were rejected before it: a sprig, a cross-stitched
 * lotus, a loom, a band of light on the button, and the photograph pleating
 * itself. The lesson taken is that this moment is wanted as an event, not a
 * detail, so it is now the boldest thing the shop does.
 *
 * The curtain rises from the bottom, holds the photograph for a beat, then
 * leaves upward with it, and the bag mark is struck as it passes.
 *
 * Inert to the pointer, removed when it finishes, skipped entirely for anyone
 * who asked for less motion.
 */
export function flyToBag(source: HTMLElement, imageUrl: string) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const stage = document.createElement('div');
  stage.className = 'bag-curtain';
  stage.setAttribute('aria-hidden', 'true');
  stage.innerHTML =
    '<span class="bag-curtain-cloth"></span>' +
    `<span class="bag-curtain-piece" style="background-image:url(${imageUrl})"></span>`;
  document.body.appendChild(stage);

  const cloth = stage.querySelector<HTMLElement>('.bag-curtain-cloth');
  const piece = stage.querySelector<HTMLElement>('.bag-curtain-piece');

  // The cloth: up over the screen, hold, then away off the top.
  cloth?.animate(
    [
      { transform: 'translateY(101%)', offset: 0 },
      { transform: 'translateY(0%)', offset: 0.3 },
      { transform: 'translateY(0%)', offset: 0.58 },
      { transform: 'translateY(-101%)', offset: 1 },
    ],
    { duration: 1050, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'both' },
  );

  // The piece rides it: lifted into view, held, carried out.
  piece?.animate(
    [
      { transform: 'translateY(70vh) scale(.9)', opacity: 0, offset: 0 },
      { transform: 'translateY(0) scale(1)', opacity: 1, offset: 0.34 },
      { transform: 'translateY(0) scale(1)', opacity: 1, offset: 0.56 },
      { transform: 'translateY(-70vh) scale(.72)', opacity: 0, offset: 1 },
    ],
    { duration: 1050, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'both' },
  );

  // The bag is struck as the cloth goes past, so the eye is told where it went.
  const bag = document.querySelector<HTMLElement>('[data-bag-target]');
  bag?.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.28)', offset: 0.72 },
      { transform: 'scale(1)' },
    ],
    { duration: 520, delay: 620, easing: 'cubic-bezier(.3,1.6,.4,1)' },
  );

  const done = stage.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 1060 });
  const clear = () => stage.remove();
  done.onfinish = clear;
  done.oncancel = clear;
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
