'use client';

/**
 * Floating WhatsApp contact.
 *
 * The same channel that will carry order and tracking updates, so a customer
 * with a pre-purchase question is already in the thread their notifications
 * will arrive in. Hidden on the bag page, where it would sit on top of the
 * checkout button.
 */

import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';

const MESSAGE = 'Hello! I have a question about a Mridul piece.';

export function WhatsAppButton({ phone }: { phone: string }) {
  const pathname = usePathname();
  if (pathname.startsWith('/bag')) return null;

  // wa.me wants digits only, so strip the formatting settings store it with.
  const url = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(MESSAGE)}`;

  return (
    <a
      aria-label="Chat with us on WhatsApp"
      className="whatsapp-float"
      href={url}
      rel="noreferrer noopener"
      target="_blank"
    >
      <MessageCircle aria-hidden="true" />
      <span>Chat</span>
    </a>
  );
}
