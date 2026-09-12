import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { getAllProducts, getSiteSettings } from '@mridul/database';
import { formatPaise } from '@mridul/utils';

/**
 * The shop assistant, server side.
 *
 * Everything it knows about the shop it reads from the database at request
 * time — products, prices, stock, the shipping threshold, the return window,
 * the WhatsApp number. Nothing is typed into a prompt by hand, so a price
 * change in the admin is a price change here on the next message, and the
 * browser never gets to tell the model what anything costs.
 *
 * The catalogue is fetched with the anonymous client, which is the point: row
 * level security decides what the public may see, and the assistant can only
 * ever repeat that. A hidden product does not exist to it.
 *
 * The API key is read here and only here. This file is `server-only`, so an
 * import from a client component fails the build rather than the key
 * quietly ending up in a bundle.
 */

export const MODEL = 'claude-opus-5';

/** A public endpoint that spends money per call gets a hard ceiling. */
const MAX_OUTPUT_TOKENS = 1024;
/** Turns kept per request. Older ones are dropped client-side before sending. */
export const MAX_TURNS = 20;
export const MAX_MESSAGE_CHARS = 2000;
const MAX_TOTAL_CHARS = 12_000;

/**
 * Best-effort throttle: a small window per address, kept in module memory.
 * On a serverless host that memory is per warm instance, so this is a speed
 * bump against a runaway tab or a cheap script, not a security boundary — the
 * hard cost limit is the spend cap on the API key itself.
 */
const WINDOW_MS = 10 * 60 * 1000;
const WINDOW_LIMIT = 30;
const hits = new Map<string, { count: number; resetAt: number }>();

export function throttled(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > WINDOW_LIMIT;
}

export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Turns the wire body into the SDK's own message type, or says why not. */
export function parseTurns(
  body: unknown,
): { ok: true; messages: Anthropic.MessageParam[] } | { ok: false; reason: string } {
  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, reason: 'No messages.' };
  if (raw.length > MAX_TURNS) return { ok: false, reason: 'Too many messages.' };

  const messages: Anthropic.MessageParam[] = [];
  let total = 0;
  for (const item of raw) {
    const role = (item as { role?: unknown })?.role;
    const content = (item as { content?: unknown })?.content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
      return { ok: false, reason: 'Malformed message.' };
    }
    const text = content.trim();
    if (!text || text.length > MAX_MESSAGE_CHARS) {
      return { ok: false, reason: 'A message is empty or too long.' };
    }
    total += text.length;
    messages.push({ role, content: text });
  }
  if (total > MAX_TOTAL_CHARS) return { ok: false, reason: 'Conversation too long.' };
  if (messages[0].role !== 'user' || messages[messages.length - 1].role !== 'user') {
    return { ok: false, reason: 'Conversation must start and end with the customer.' };
  }
  return { ok: true, messages };
}

/**
 * The catalogue as the model sees it. Built in a fixed key order and sorted by
 * slug, with nothing time-dependent in it, so the block is byte-identical
 * between requests until something in the shop actually changes — which is
 * what lets the prompt cache serve it instead of re-reading it every message.
 */
async function catalogueBlock(): Promise<string> {
  const products = await getAllProducts();
  const rows = [...products]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((p) => ({
      name: p.name,
      url: `/product/${p.slug}`,
      category: p.categorySlug,
      collections: [...p.collectionSlugs].sort(),
      fabric: p.fabric,
      colour: p.colour.name,
      occasion: p.occasion,
      technique: p.technique,
      price: formatPaise(p.pricePaise),
      wasPrice: p.compareAtPaise ? formatPaise(p.compareAtPaise) : undefined,
      options: [...p.variants]
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((v) => ({
          label: v.label,
          price: formatPaise(p.pricePaise + v.priceDeltaPaise),
          available: v.stock > 0 ? (v.stock <= 5 ? `only ${v.stock} left` : 'in stock') : 'sold out',
        })),
      soldOut: p.isSoldOut,
      description: p.description.trim() || undefined,
      care: p.care.length ? p.care : undefined,
      blouse: p.blouseDetails || undefined,
    }));
  return JSON.stringify(rows);
}

/** Stable instructions first, the catalogue after: the cache is a prefix match. */
async function systemBlocks(): Promise<Anthropic.TextBlockParam[]> {
  const [settings, catalogue] = await Promise.all([getSiteSettings(), catalogueBlock()]);
  const c = settings.contact;

  const instructions = [
    `You are the shopping assistant for ${settings.brandName}, an Indian saree and blouse shop. You help customers choose pieces, understand fabrics and care, and find their way around the shop.`,
    '',
    'Rules you never break:',
    '- Every product, price, option and stock figure you mention comes from the CATALOGUE below. If it is not there, it does not exist — say so rather than guess.',
    '- Never promise a delivery date, a discount, a custom alteration or anything the catalogue and the facts below do not state. Delivery charges and dates are confirmed at checkout from the customer\'s pincode.',
    '- Do not invent reviews, awards, or claims about who made a piece.',
    `- When you cannot answer, or the customer wants a person, offer WhatsApp: ${c.whatsapp}. That is a real number that reaches the shop.`,
    '- Link a product by writing its url exactly as given, for example /product/some-slug, on its own or in a sentence. Do not make up urls.',
    '- Be brief and warm. Two or three short sentences usually. No headings, no bullet lists longer than four items, no emoji.',
    '- Stay on the shop. Politely decline anything unrelated to sarees, blouses, this shop, or an order from it.',
    '',
    'Shop facts:',
    `- Free shipping on orders of ${formatPaise(settings.freeShippingThresholdPaise)} and above; below that a flat ${formatPaise(settings.flatShippingPaise)} until checkout confirms the exact charge.`,
    `- Returns: ${settings.returnWindowDays} days from delivery. Details are confirmed at checkout; for anything specific, hand off to WhatsApp.`,
    '- Payment is taken securely at checkout. Order updates go out on WhatsApp.',
    `- Contact: WhatsApp ${c.whatsapp}${c.email ? `, email ${c.email}` : ''}${c.instagram ? `, Instagram ${c.instagram}` : ''}.`,
    '- Prices are in Indian rupees and include all taxes.',
  ].join('\n');

  return [
    { type: 'text', text: instructions },
    {
      type: 'text',
      text: `CATALOGUE (JSON, one entry per product):\n${catalogue}`,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

export type AssistantOutcome =
  | { kind: 'stream'; body: ReadableStream<Uint8Array> }
  | { kind: 'error'; status: number; message: string };

/**
 * Streams the reply as plain UTF-8 text chunks. The client appends them to the
 * last assistant bubble as they arrive; a refusal is written into the same
 * stream as a normal sentence, so the reader never has to special-case it.
 */
export async function answer(messages: Anthropic.MessageParam[]): Promise<AssistantOutcome> {
  const client = new Anthropic();
  const system = await systemBlocks();

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    // If the model declines a message on policy grounds, the API re-runs it on
    // a fallback model inside the same call, so the customer still gets an
    // answer where one is possible. Routing is by refusal category.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    // Thinking stays on (adaptive is the default on this model); low effort
    // is the right setting for a chat turn — quick, and a one-word change here
    // if the answers ever want more deliberation.
    output_config: { effort: 'low' },
    system,
    messages,
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === 'refusal') {
          controller.enqueue(
            encoder.encode("I can't help with that one, but the shop can — message us on WhatsApp and a person will pick it up."),
          );
        } else if (final.stop_reason === 'max_tokens') {
          controller.enqueue(encoder.encode(' …'));
        }
      } catch (error) {
        // A failure mid-stream: end the reply cleanly with a line the
        // customer can act on, and log the class of failure without the key.
        console.error('[assistant] stream failed:', error instanceof Error ? error.message : error);
        controller.enqueue(encoder.encode('\n\nSomething went wrong on my side. Please try again, or message the shop on WhatsApp.'));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return { kind: 'stream', body };
}
