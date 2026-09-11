'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';

/**
 * A moment of the brand's own drawing, over the page, when something is added
 * to the bag.
 *
 * The toast says what happened and the flight says where it went; neither is
 * much of an event. This is the pause between the two — a sprig drawn in a
 * single stroke, the same line the journal panels use, then gone. It is
 * deliberately short: this sits between a shopper and the next thing they
 * meant to do, so it must not become a thing to wait through.
 *
 * `pointer-events: none` throughout, so it never swallows a click.
 */
function bagFlourish() {
  const scrim = document.createElement('div');
  scrim.className = 'bag-flourish';
  scrim.setAttribute('aria-hidden', 'true');
  scrim.innerHTML = `
    <svg viewBox="0 0 120 120" fill="none" stroke="currentColor"
         stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M60 104 C60 74 60 50 60 24" />
      <path d="M60 84 C44 82 34 72 32 56 C48 58 58 68 60 84 Z" />
      <path d="M60 70 C76 68 86 58 88 42 C72 44 62 54 60 70 Z" />
      <path d="M60 52 C46 50 38 41 36 27 C50 29 58 38 60 52 Z" />
      <circle cx="60" cy="20" r="5" />
    </svg>`;
  document.body.appendChild(scrim);
  const paths = scrim.querySelectorAll<SVGGeometryElement>('path, circle');
  paths.forEach((path, index) => {
    const length = path.getTotalLength();
    path.style.strokeDasharray = String(length);
    path.style.strokeDashoffset = String(length);
    path.animate(
      [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
      {
        duration: 420,
        delay: index * 70,
        easing: 'cubic-bezier(.3,.7,.2,1)',
        fill: 'forwards',
      },
    );
  });
  const done = scrim.animate(
    [
      { opacity: 0, transform: 'scale(.94)' },
      { opacity: 1, transform: 'scale(1)', offset: 0.18 },
      { opacity: 1, transform: 'scale(1)', offset: 0.72 },
      { opacity: 0, transform: 'scale(1.04)' },
    ],
    { duration: 1150, easing: 'ease-out' },
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
  const cursor = useRef<HTMLDivElement>(null);
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
      const context = element?.closest<HTMLElement>('[data-cursor]');
      if (cursor.current) {
        cursor.current.style.transform = `translate(${event.clientX - 37}px,${event.clientY - 37}px)`;
        cursor.current.textContent = context?.dataset.cursor ?? '';
        cursor.current.classList.toggle('is-visible', Boolean(context));
      }
      const button = element?.closest<HTMLElement>('[data-magnetic]') ?? null;
      if (magnetic && magnetic !== button) magnetic.style.translate = '';
      magnetic = button;
      if (button) {
        const box = button.getBoundingClientRect();
        button.style.translate = `${(event.clientX - box.left - box.width / 2) * 0.08}px ${(event.clientY - box.top - box.height / 2) * 0.12}px`;
      }
    };
    const leave = () => {
      cursor.current?.classList.remove('is-visible');
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
      <div ref={cursor} className="silk-cursor" aria-hidden="true" />
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
