'use client';

/**
 * The help panel, as the customer meets it.
 *
 * The same launcher in the corner, opening the same panel — but there is no
 * model behind it and no key to leak. It is a script: the questions people
 * actually ask a saree shop, each with an answer written here and checked.
 *
 * Two kinds of answer live in that script. Most are fixed sentences built from
 * Settings — the free-shipping threshold, the flat rate, the return window —
 * so changing a number in the admin changes what the panel says.
 *
 * The rest are read from the catalogue on every render. "What is new?" is not
 * a list anybody maintains; it is the newest four live products at the moment
 * the page was built. Publish a piece in the admin and the panel mentions it
 * on the next page load; hide one and it stops being mentioned. Nobody edits
 * an answer, and nothing is redeployed.
 *
 * Kept from what it replaces: the launcher stays out of the way until you have
 * scrolled past the hero, and it is hidden on the bag page where it would sit
 * over the checkout button.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, X } from 'lucide-react';
import type { HelpProduct } from '@mridul/types';
import { formatPaise, whatsappLink } from '@mridul/utils';

export type HelpFacts = {
  freeShippingThresholdPaise: number;
  flatShippingPaise: number;
  returnWindowDays: number;
  email: string;
  whatsapp: string;
};

type Place = { label: string; href: string };

type Answer = {
  /** What the customer taps. Written as they would say it. */
  question: string;
  /** What comes back. Paragraphs, so an answer can breathe. */
  reply: (facts: HelpFacts, products: HelpProduct[]) => string[];
  /** Where the answer can take them. Often the answer *is* the links. */
  places?: (products: HelpProduct[]) => Place[];
  /** Hidden when the catalogue cannot support it — no products, no fabrics. */
  when?: (products: HelpProduct[]) => boolean;
};

/** Unique, non-empty, in the order the catalogue gives them. */
function distinct(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

const SCRIPT: Answer[] = [
  /* ---- read from the catalogue -------------------------------------------- */
  {
    question: 'What is new?',
    when: (p) => p.length > 0,
    reply: (_f, products) => [
      products.length === 1
        ? 'One piece is live right now — here it is.'
        : `${products.length} pieces are live right now. These are the ones that arrived most recently.`,
    ],
    places: (products) =>
      products.slice(0, 4).map((product) => ({
        label: `${product.name} · ${formatPaise(product.pricePaise)}`,
        href: `/product/${product.slug}`,
      })),
  },
  {
    question: 'What fabrics do you have?',
    when: (p) => distinct(p.map((product) => product.fabric)).length > 0,
    reply: (_f, products) => {
      const fabrics = distinct(products.map((product) => product.fabric));
      return [
        `Right now: ${fabrics.slice(0, 8).join(', ')}.`,
        'Tap one to see everything cut from it.',
      ];
    },
    places: (products) =>
      distinct(products.map((product) => product.fabric))
        .slice(0, 6)
        .map((fabric) => ({ label: fabric, href: `/search?q=${encodeURIComponent(fabric)}` })),
  },
  {
    question: 'What is the least I can spend?',
    when: (p) => p.some((product) => !product.soldOut),
    reply: (_f, products) => {
      const available = products.filter((product) => !product.soldOut);
      const cheapest = Math.min(...available.map((product) => product.pricePaise));
      return [
        `Pieces start at ${formatPaise(cheapest)}. These are the gentlest on the purse today.`,
      ];
    },
    places: (products) =>
      products
        .filter((product) => !product.soldOut)
        .slice()
        .sort((a, b) => a.pricePaise - b.pricePaise)
        .slice(0, 4)
        .map((product) => ({
          label: `${product.name} · ${formatPaise(product.pricePaise)}`,
          href: `/product/${product.slug}`,
        })),
  },

  /* ---- fixed, from Settings ----------------------------------------------- */
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
    places: () => [{ label: 'See your orders', href: '/account' }],
  },
  {
    question: 'Where is my order?',
    reply: () => [
      'Every order you have placed is on your account page, with what is in it, where it is going and how far along it is.',
    ],
    places: () => [{ label: 'Open your orders', href: '/account' }],
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
    places: () => [{ label: 'See what is in stock', href: '/collections/new-arrivals' }],
  },
];

type Bubble = { role: 'user' | 'shop'; lines: string[]; places?: Place[] };

const OPENER = 'Hello. Pick a question below and I will answer it straight away.';

export function HelpChat({
  facts,
  products,
}: {
  facts: HelpFacts;
  products: HelpProduct[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [thread, setThread] = useState<Bubble[]>([]);
  const log = useRef<HTMLDivElement>(null);

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

  // A question about fabrics is worth asking only if there are fabrics. An
  // empty catalogue quietly leaves the shop with the questions it can answer.
  const askable = useMemo(
    () => SCRIPT.filter((entry) => !entry.when || entry.when(products)),
    [products],
  );

  const remaining = askable.filter(
    (entry) =>
      !thread.some((bubble) => bubble.role === 'user' && bubble.lines[0] === entry.question),
  );

  function ask(entry: Answer) {
    setThread((current) => [
      ...current,
      { role: 'user', lines: [entry.question] },
      {
        role: 'shop',
        lines: entry.reply(facts, products),
        places: entry.places?.(products),
      },
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
              <div className="help-turn" key={index}>
                <p className={`assistant-msg is-${bubble.role === 'user' ? 'user' : 'assistant'}`}>
                  {bubble.lines.map((line, position) => (
                    <span className="help-line" key={position}>
                      {line}
                    </span>
                  ))}
                </p>
                {bubble.places && bubble.places.length > 0 && (
                  <div className="help-places">
                    {bubble.places.map((place) => (
                      <Link
                        className="assistant-link help-answer-link"
                        href={place.href}
                        key={place.href}
                        onClick={() => setOpen(false)}
                      >
                        {place.label}
                      </Link>
                    ))}
                  </div>
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
