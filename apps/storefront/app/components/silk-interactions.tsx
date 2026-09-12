'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';

/**
 * A moment over the page when something goes into the bag.
 *
 * A lotus, worked in cross stitch: each mark is two crossing strokes, and they
 * land row by row the way a row of stitches is actually sewn. The motif is the
 * one already in the shop's own mark rather than a borrowed heart, and the
 * stitch is the point — a drawn outline would have been quicker to write, but
 * this is a shop that sells cloth.
 *
 * The toast beside it says what happened; this says nothing, which is why it
 * is `aria-hidden` and inert to the pointer. It is short on purpose: it sits
 * between a shopper and the next thing they meant to do.
 */
/** A bloom on a stitch grid: petal tips at the top, opening to the full width,
    then tapering to the base. Symmetric, so it reads as a flower at any size. */
const LOTUS_GRID = [
  '....X....',
  '..X.X.X..',
  '.XXXXXXX.',
  'XXXXXXXXX',
  '.XXXXXXX.',
  '..XXXXX..',
  '...XXX...',
];
const CELL = 12;

function bagFlourish() {
  const scrim = document.createElement('div');
  scrim.className = 'bag-flourish';
  scrim.setAttribute('aria-hidden', 'true');

  const stitches: string[] = [];
  LOTUS_GRID.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell !== 'X') return;
      const left = x * CELL;
      const top = y * CELL;
      // One group per stitch so each can arrive on its own.
      stitches.push(
        `<g class="stitch">` +
          `<path d="M${left + 2.6} ${top + 2.6} L${left + 9.4} ${top + 9.4}" />` +
          `<path d="M${left + 9.4} ${top + 2.6} L${left + 2.6} ${top + 9.4}" />` +
        `</g>`,
      );
    });
  });

  scrim.innerHTML =
    `<svg viewBox="-7 -7 ${LOTUS_GRID[0].length * CELL + 14} ${LOTUS_GRID.length * CELL + 14}"` +
    ` fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">` +
    stitches.join('') +
    `</svg>`;
  document.body.appendChild(scrim);

  scrim.querySelectorAll<SVGGElement>('.stitch').forEach((stitch, index) => {
    stitch.animate(
      [
        { opacity: 0, transform: 'scale(.4)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      {
        duration: 260,
        delay: index * 17,
        easing: 'cubic-bezier(.2,.9,.3,1.4)',
        fill: 'both',
      },
    );
  });

  const done = scrim.animate(
    [
      { opacity: 0 },
      { opacity: 1, offset: 0.12 },
      { opacity: 1, offset: 0.74 },
      { opacity: 0 },
    ],
    { duration: 1400, easing: 'ease-out' },
  );
  done.onfinish = () => scrim.remove();
  done.oncancel = () => scrim.remove();
}

export function flyToBag(source: HTMLElement, imageUrl: string) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  bagFlourish();
  const target = document.querySelector('[data-bag-target]');
  if (!target) return;
  const from = source.getBoundingClientRect(),
    to = target.getBoundingClientRect();
  const photo = document.createElement('img');
  photo.src = imageUrl;
  photo.alt = '';
  photo.className = 'bag-flight';
  photo.style.left = `${from.left + from.width / 2 - 30}px`;
  photo.style.top = `${from.top}px`;
  document.body.appendChild(photo);
  const animation = photo.animate(
    [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      {
        transform: `translate(${to.left - from.left - from.width / 2 + 30}px,${to.top - from.top}px) scale(.15)`,
        opacity: 0.2,
      },
    ],
    { duration: 700, easing: 'cubic-bezier(.25,.6,.3,1)' },
  );
  animation.onfinish = () => photo.remove();
  animation.oncancel = () => photo.remove();
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
