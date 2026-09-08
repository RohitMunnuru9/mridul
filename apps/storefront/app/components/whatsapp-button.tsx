'use client';

/**
 * Floating WhatsApp contact.
 *
 * The same number that will carry order and tracking updates, so a shopper
 * with a question before buying is already in the thread their notifications
 * will arrive in.
 *
 * It stays out of the way until you have scrolled past the hero — a chat
 * bubble sitting over the first thing a visitor sees is an interruption, not
 * an offer. Hidden on the bag page, where it would cover the checkout button.
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';

const MESSAGE = 'Hello! I have a question about a Mridul piece.';

export function WhatsAppButton({ phone }: { phone: string }) {
  const pathname = usePathname();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 420);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (pathname.startsWith('/bag')) return null;

  // wa.me wants digits only, so strip the formatting settings store it with.
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  const url = `https://wa.me/${digits}?text=${encodeURIComponent(MESSAGE)}`;

  return (
    <a
      aria-hidden={!shown}
      aria-label="Ask us a question on WhatsApp"
      className={`whatsapp-float${shown ? ' is-shown' : ''}`}
      href={url}
      rel="noreferrer noopener"
      tabIndex={shown ? 0 : -1}
      target="_blank"
    >
      <MessageCircle aria-hidden="true" />
      <span>Ask us</span>
    </a>
  );
}
