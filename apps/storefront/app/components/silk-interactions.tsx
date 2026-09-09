'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';

export function flyToBag(source: HTMLElement, imageUrl: string) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
            height={336}
            sizes="220px"
            src="/images/brand/mridul-wordmark.png"
            width={1100}
          />
          <span className="page-fabric-rule" />
        </span>
      </div>
    </>
  );
}
