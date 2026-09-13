'use client';

/**
 * The help panel, as the customer meets it.
 *
 * The same launcher in the corner, opening the same panel — but there is no
 * model behind it any more and no key to leak. It is a script: a short list of
 * the things people actually ask a saree shop, each with an answer written
 * here and checked by a person.
 *
 * That is the trade, and it is a good one for a shop this size. A model could
 * answer anything and had to be trusted not to invent a delivery date; this
 * can only answer nine questions and cannot get any of them wrong. Every
 * figure in it — the free-shipping threshold, the flat rate, the return window,
 * the email — is passed in from Settings rather than typed into the script, so
 * changing a number in the admin changes the answer here too.
 *
 * Kept from what it replaces: the launcher stays out of the way until you have
 * scrolled past the hero, and it is hidden on the bag page where it would sit
 * over the checkout button.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, X } from 'lucide-react';
import { formatPaise, whatsappLink } from '@mridul/utils';

export type HelpFacts = {
  freeShippingThresholdPaise: number;
  flatShippingPaise: number;
  returnWindowDays: number;
  email: string;
  whatsapp: string;
};

type Answer = {
  /** What the customer taps. Written as they would say it. */
  question: string;
  /** What comes back. Paragraphs, so an answer can breathe. */
  reply: (facts: HelpFacts) => string[];
  /** An optional place to go next, when the answer is really a page. */
  link?: { label: string; href: string };
};

/**
 * The script.
 *
 * Ordered by how often it is asked, not by how interesting it is: payment and
 * delivery first, because that is what somebody with a full bag wants to know.
 */
const SCRIPT: Answer[] = [
  {
    question: 'How do I pay?',
    reply: () => [
      'Cash on delivery. You pay the delivery partner when the parcel reaches you — nothing is taken from you before that.',
      'Card and UPI payment is being set up and is not available yet.',
    ],
  },
  {
    question: 'What does delivery cost?',
    reply: (f) => [
      `Orders of ${formatPaise(f.freeShippingThresholdPaise)} and above ship free. Below that it is a flat ${formatPaise(f.flatShippingPaise)}.`,
      'The exact charge is confirmed at checkout once you enter your pincode, and it is shown to you before you place the order.',
    ],
  },
  {
    question: 'How long will it take to arrive?',
    reply: () => [
      'Each piece is checked, pressed and packed by hand before it leaves, which usually takes a day or two.',
      'Once it is handed to the courier you get a message with the tracking number, and your order page shows where it has reached.',
    ],
    link: { label: 'See your orders', href: '/account' },
  },
  {
    question: 'Where is my order?',
    reply: () => [
      'Every order you have placed is on your account page, with what is in it, where it is going and how far along it is.',
    ],
    link: { label: 'Open your orders', href: '/account' },
  },
  {
    question: 'Can I return something?',
    reply: (f) => [
      `Yes — within ${f.returnWindowDays} days of delivery, as long as the piece is unworn and still has its tags.`,
      'Tell us what went wrong and we will arrange it. Made-to-order and altered pieces are the exception.',
    ],
  },
  {
    question: 'What size blouse should I choose?',
    reply: () => [
      'Every saree lists its blouse piece and the fabric it is cut from on the product page, along with the measurements it will make up to.',
      'If you are between sizes, send us the measurement you stitch to and we will tell you which to take.',
    ],
    link: { label: 'Browse sarees', href: '/shop/sarees' },
  },
  {
    question: 'How do I care for a saree?',
    reply: () => [
      'Care instructions sit on each product page, under the description — they differ by fabric, so the page is the one to trust rather than a general rule.',
      'As a rule of thumb: dry clean silk, fold along a different line each time, and keep it out of direct sunlight.',
    ],
  },
  {
    question: 'Is this piece in stock?',
    reply: () => [
      'Stock is live on every product page. If a size or a variant can be added to the bag, it is on the shelf; if it is sold out, the page says so rather than letting you order it.',
    ],
    link: { label: 'See what is in stock', href: '/collections/new-arrivals' },
  },
];

type Bubble = { role: 'user' | 'shop'; lines: string[]; link?: Answer['link'] };

const OPENER =
  'Hello. Pick a question below and I will answer it straight away.';

export function HelpChat({ facts }: { facts: HelpFacts }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [thread, setThread] = useState<Bubble[]>([]);
  const log = useRef<HTMLDivElement>(null);

  // The launcher appears once the hero is behind you, as it always has.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      setShown(window.scrollY > 420);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' });
  }, [thread]);

  const waHref = useMemo(
    () => whatsappLink(facts.whatsapp, 'Hello! I have a question about a Mridul piece.'),
    [facts.whatsapp],
  );

  // Asked-and-answered questions drop out of the list, so what is left is what
  // the customer has not tried yet.
  const remaining = SCRIPT.filter(
    (entry) => !thread.some((bubble) => bubble.role === 'user' && bubble.lines[0] === entry.question),
  );

  function ask(entry: Answer) {
    setThread((current) => [
      ...current,
      { role: 'user', lines: [entry.question] },
      { role: 'shop', lines: entry.reply(facts), link: entry.link },
    ]);
  }

  if (pathname.startsWith('/bag')) return null;

  return (
    <>
      <button
        aria-expanded={open}
        aria-hidden={!shown && !open}
        aria-label={open ? 'Close help' : 'Ask us a question'}
        className={`assistant-launcher${shown || open ? ' is-shown' : ''}`}
        onClick={() => setOpen((value) => !value)}
        tabIndex={shown || open ? 0 : -1}
        type="button"
      >
        {open ? <X aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
        <span>{open ? 'Close' : 'Ask us'}</span>
      </button>

      {open && (
        <section aria-label="Help" className="assistant-panel" role="dialog">
          <header className="assistant-head">
            <div>
              <strong>Ask Mridul</strong>
              <small>Common questions, answered straight away.</small>
            </div>
            {waHref && (
              <a className="assistant-wa" href={waHref} rel="noreferrer noopener" target="_blank">
                WhatsApp
              </a>
            )}
          </header>

          <div aria-live="polite" className="assistant-log" ref={log}>
            <p className="assistant-msg is-assistant">{OPENER}</p>

            {thread.map((bubble, index) => (
              <div key={index}>
                <p className={`assistant-msg is-${bubble.role === 'user' ? 'user' : 'assistant'}`}>
                  {bubble.lines.map((line, position) => (
                    <span className="help-line" key={position}>
                      {line}
                    </span>
                  ))}
                </p>
                {bubble.link && (
                  <Link
                    className="assistant-link help-answer-link"
                    href={bubble.link.href}
                    onClick={() => setOpen(false)}
                  >
                    {bubble.link.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

          <div className="help-options">
            {remaining.length > 0 ? (
              <>
                <p className="help-options-label">
                  {thread.length === 0 ? 'Choose a question' : 'Anything else?'}
                </p>
                {remaining.map((entry) => (
                  <button
                    className="help-option"
                    key={entry.question}
                    onClick={() => ask(entry)}
                    type="button"
                  >
                    {entry.question}
                  </button>
                ))}
              </>
            ) : (
              <p className="help-options-label">
                That is everything I can answer. For anything else, a person will.
              </p>
            )}
          </div>

          <footer className="assistant-note help-foot">
            {waHref ? (
              <>
                Something else?{' '}
                <a href={waHref} rel="noreferrer noopener" target="_blank">
                  Message us on WhatsApp
                </a>
                .
              </>
            ) : facts.email ? (
              <>
                Something else? Email us at{' '}
                <a href={`mailto:${facts.email}`}>{facts.email}</a>.
              </>
            ) : (
              <>Something else? Leave a note with your order and we will come back to you.</>
            )}
          </footer>
        </section>
      )}
    </>
  );
}
