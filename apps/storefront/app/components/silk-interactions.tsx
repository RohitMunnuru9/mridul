'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';

/** Counts darts sent, only to keep each one's gradient ids to itself. */
let dartsFlown = 0;

/**
 * A paper dart flies from the button to the bag.
 *
 *
 * Drawn rather than an emoji: the emoji rocket is a cartoon, and it is a
 * different cartoon on every operating system.
 *
 * Three surfaces make the fold read as solid: an upper wing catching the
 * light, a lower one turned away from it, and a keel beneath. Each is shaded
 * across its own length rather than filled flat, a gold crease runs the length
 * of the fold, and the leading edge carries a rim light — which together is
 * what gives it depth at thirty pixels, where a flat triangle reads as a
 * triangle.
 *
 * Asked for directly, after five quieter ideas and one very loud one were
 * turned down: a sprig, a cross-stitched lotus, a loom, a band of light on the
 * button, the photograph pleating itself, and a full curtain.
 *
 * It leaves the button, arcs — the apex sits above both ends, so it climbs
 * before it drops rather than sliding along a ruler — and banks into the bag,
 * which is struck as it lands. Sparks fall behind it along the way.
 *
 * Inert to the pointer, removed when it lands, skipped for anyone who asked
 * for less motion.
 */
export function flyToBag(source: HTMLElement) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const bag = document.querySelector<HTMLElement>('[data-bag-target]');
  if (!bag) return;

  const from = source.getBoundingClientRect();
  const to = bag.getBoundingClientRect();
  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;
  const endX = to.left + to.width / 2;
  const endY = to.top + to.height / 2;

  const rocket = document.createElement('div');
  rocket.className = 'bag-rocket';
  rocket.setAttribute('aria-hidden', 'true');
  // Drawn nose-right, so the bank angle below needs no correction. The two
  // faces are the same dart lit from opposite sides, which is what makes it
  // read as paper rather than a flat triangle.
  // Gradient ids must be unique: two darts can be in the air at once, and a
  // repeated id would send both to the first one's gradients.
  const uid = 'dart' + (dartsFlown += 1);
  rocket.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="' + uid + 'a" x1="0" y1="0" x2="0.9" y2="1">' +
          '<stop offset="0" stop-color="#c86f88" />' +
          '<stop offset="0.5" stop-color="#7d3446" />' +
          '<stop offset="1" stop-color="#4a2029" />' +
        '</linearGradient>' +
        '<linearGradient id="' + uid + 'b" x1="0" y1="1" x2="1" y2="0.2">' +
          '<stop offset="0" stop-color="#240d12" />' +
          '<stop offset="1" stop-color="#4a1d27" />' +
        '</linearGradient>' +
        '<linearGradient id="' + uid + 'c" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" stop-color="#150609" />' +
          '<stop offset="1" stop-color="#39161e" />' +
        '</linearGradient>' +
      '</defs>' +
      // Keel underneath, drawn first so the wings sit over it.
      '<path d="M23 12 L8.2 12 L5.6 16.2 Z" fill="url(#' + uid + 'c)" />' +
      // The far wing, swept back into the light. Longer than the near one:
      // seen from slightly above, the two are never the same length, and
      // making them equal is what turned this into an arrowhead.
      '<path d="M23 12 L0.8 2.2 L8.2 12 Z" fill="url(#' + uid + 'a)" />' +
      // The near wing, shorter and turned away from the light.
      '<path d="M23 12 L8.2 12 L5 19.6 Z" fill="url(#' + uid + 'b)" />' +
      // the fold itself, and a rim light along the leading edge
      '<path d="M23 12 L8.2 12" stroke="#c9a961" stroke-width="0.8"' +
        ' stroke-linecap="round" opacity="0.95" />' +
      '<path d="M23 12 L0.8 2.2" stroke="#e8cf98" stroke-width="0.55"' +
        ' stroke-linecap="round" opacity="0.6" />' +
    '</svg>';
  rocket.style.left = startX + 'px';
  rocket.style.top = startY + 'px';
  document.body.appendChild(rocket);

  // A curve, not a line: the apex sits above both ends.
  const apexX = (startX + endX) / 2;
  const apexY = Math.min(startY, endY) - Math.max(90, Math.abs(endY - startY) * 0.5);
  const at = (t: number) => ({
    x: (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * apexX + t * t * endX,
    y: (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * apexY + t * t * endY,
  });

  const DURATION = 820;
  const frames = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => {
    const p = at(t);
    // The nose points along the path, so it banks through the turn.
    const ahead = at(Math.min(1, t + 0.06));
    const angle = (Math.atan2(ahead.y - p.y, ahead.x - p.x) * 180) / Math.PI;
    const scale = t < 0.15 ? 0.6 + t * 2.6 : 1.15 - t * 0.6;
    return {
      offset: t,
      opacity: t > 0.92 ? 0 : 1,
      transform:
        'translate(' + (p.x - startX) + 'px,' + (p.y - startY) + 'px) ' +
        'rotate(' + angle + 'deg) scale(' + scale + ')',
    };
  });

  const flight = rocket.animate(frames, {
    duration: DURATION,
    easing: 'cubic-bezier(.35,.02,.5,1)',
  });

  // Sparks dropped along the path.
  for (let i = 1; i <= 5; i += 1) {
    const t = i / 6;
    const p = at(t);
    const spark = document.createElement('div');
    spark.className = 'bag-spark';
    spark.setAttribute('aria-hidden', 'true');
    spark.style.left = p.x + 'px';
    spark.style.top = p.y + 'px';
    document.body.appendChild(spark);
    const puff = spark.animate(
      [
        { opacity: 0.9, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(.2) translateY(14px)' },
      ],
      { duration: 420, delay: DURATION * t, easing: 'ease-out', fill: 'both' },
    );
    const drop = () => spark.remove();
    puff.onfinish = drop;
    puff.oncancel = drop;
  }

  bag.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.3)', offset: 0.55 },
      { transform: 'scale(1)' },
    ],
    { duration: 460, delay: DURATION - 120, easing: 'cubic-bezier(.3,1.7,.4,1)' },
  );

  const land = () => rocket.remove();
  flight.onfinish = land;
  flight.oncancel = land;
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

      // The curtain plays *over* the navigation, not in front of it. It used
      // to hold the click for 450ms before even asking for the next page —
      // on a phone that is most of what "slow after I tap a link" was, and it
      // bought nothing: the animation looks the same either way.
      router.push(url.pathname + url.search);

      // The effect on `pathname` lifts the curtain as soon as the new route
      // commits. This is only the fallback for a navigation that never does.
      pending.current = setTimeout(() => {
        curtain.current?.classList.remove('is-leaving');
        curtain.current?.classList.add('is-arriving');
        pending.current = null;
      }, 900);
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
