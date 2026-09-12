'use client';

/**
 * The shop assistant, as the customer meets it.
 *
 * A launcher in the corner opens a small panel: ask about a piece, a fabric,
 * shipping, and get an answer grounded in the catalogue, streamed in as it is
 * written. Nothing here knows a price — it shows what the server sends.
 *
 * WhatsApp is not gone. It sits in the panel's header as the way to reach a
 * person, and it is the whole panel when the assistant is not configured, so
 * a shop without a key still has a working "Ask us" that goes somewhere.
 *
 * Kept from the WhatsApp float it replaces: the launcher stays out of the way
 * until you have scrolled past the hero, and it is hidden on the bag page,
 * where it would sit over the checkout button.
 */

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, SendHorizontal, X } from 'lucide-react';

type Turn = { role: 'user' | 'assistant'; content: string };
type Status = 'idle' | 'sending' | 'unconfigured' | 'busy' | 'failed';

const OPENER = 'Hello. Ask me about a saree, a fabric, sizing, or shipping.';
const WA_TEXT = 'Hello! I have a question about a Mridul piece.';
/** Kept in step with the server, which rejects anything longer. */
const MAX_TURNS = 20;
const MAX_CHARS = 2000;

/** Product paths the assistant writes become links; everything else is text. */
function withLinks(text: string): ReactNode[] {
  const parts = text.split(/(\/product\/[a-z0-9-]+)/g);
  return parts.map((part, i) =>
    /^\/product\/[a-z0-9-]+$/.test(part) ? (
      <Link href={part} key={i}>
        {part.replace('/product/', '').replace(/-/g, ' ')}
      </Link>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function AssistantChat({ whatsapp }: { whatsapp: string }) {
  const pathname = usePathname();
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 420);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    input.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [turns]);

  if (pathname.startsWith('/bag')) return null;

  const digits = whatsapp.replace(/\D/g, '');
  const waHref = digits ? `https://wa.me/${digits}?text=${encodeURIComponent(WA_TEXT)}` : null;

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || status === 'sending') return;

    // The server wants the whole conversation; keep it within its limits so
    // a long chat degrades by forgetting the start, not by failing.
    const history = [...turns, { role: 'user' as const, content: text }].slice(-MAX_TURNS);
    setTurns([...history, { role: 'assistant', content: '' }]);
    setDraft('');
    setStatus('sending');

    abort.current?.abort();
    abort.current = new AbortController();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: abort.current.signal,
      });

      if (!res.ok || !res.body) {
        setTurns(history);
        setStatus(res.status === 503 ? 'unconfigured' : res.status === 429 ? 'busy' : 'failed');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        const snapshot = reply;
        setTurns([...history, { role: 'assistant', content: snapshot }]);
      }
      setStatus('idle');
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      setTurns(history);
      setStatus('failed');
    }
  }

  return (
    <>
      <button
        aria-expanded={open}
        aria-hidden={!shown && !open}
        aria-label={open ? 'Close the assistant' : 'Ask us a question'}
        className={`assistant-launcher${shown || open ? ' is-shown' : ''}`}
        onClick={() => setOpen((v) => !v)}
        tabIndex={shown || open ? 0 : -1}
        type="button"
      >
        {open ? <X aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
        <span>{open ? 'Close' : 'Ask us'}</span>
      </button>

      {open && (
        <section aria-label="Shop assistant" className="assistant-panel" role="dialog">
          <header className="assistant-head">
            <div>
              <strong>Ask Mridul</strong>
              <small>Answers come from the catalogue. A person is one tap away.</small>
            </div>
            {waHref && (
              <a className="assistant-wa" href={waHref} rel="noreferrer noopener" target="_blank">
                WhatsApp
              </a>
            )}
          </header>

          {status === 'unconfigured' ? (
            <div className="assistant-empty">
              <p>The assistant is not switched on yet.</p>
              {waHref ? (
                <a className="assistant-cta" href={waHref} rel="noreferrer noopener" target="_blank">
                  Message us on WhatsApp
                </a>
              ) : (
                <p>Please try again later.</p>
              )}
            </div>
          ) : (
            <>
              <div aria-live="polite" className="assistant-log" ref={list}>
                <p className="assistant-msg is-assistant">{OPENER}</p>
                {turns.map((turn, i) => (
                  <p
                    className={`assistant-msg is-${turn.role}${
                      turn.role === 'assistant' && !turn.content ? ' is-thinking' : ''
                    }`}
                    key={i}
                  >
                    {turn.content ? withLinks(turn.content) : <span aria-label="Thinking" />}
                  </p>
                ))}
                {status === 'busy' && (
                  <p className="assistant-note">A lot of questions at once — give it a moment.</p>
                )}
                {status === 'failed' && (
                  <p className="assistant-note">{"That didn't go through. Try again, or use WhatsApp above."}</p>
                )}
              </div>

              <form className="assistant-form" onSubmit={send}>
                <input
                  aria-label="Your question"
                  autoComplete="off"
                  maxLength={MAX_CHARS}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask about a saree, fabric, or shipping"
                  ref={input}
                  value={draft}
                />
                <button aria-label="Send" disabled={!draft.trim() || status === 'sending'} type="submit">
                  <SendHorizontal aria-hidden="true" />
                </button>
              </form>
            </>
          )}
        </section>
      )}
    </>
  );
}
