import 'server-only';
import { GoogleGenAI, type Content, FinishReason } from '@google/genai';
import { getAllProducts, getSiteSettings } from '@mridul/database';
import { formatPaise } from '@mridul/utils';

/**
 * The shop assistant, server side. Answered by Gemini.
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

/**
 * Overridable without a code change, because model names come and go faster
 * than deploys do. Flash is the right tier for a shop chat: quick, cheap, and
 * the work here is reading a catalogue rather than reasoning hard about it.
 */
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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

/** Either name works; the SDK reads both, and so does this. */
function apiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
}

export function isConfigured(): boolean {
  return Boolean(apiKey());
}

/**
 * Turns the wire body into Gemini's own `Content` shape, or says why not.
 * The panel speaks in `assistant`; Gemini calls that role `model`, and this is
 * the one place that translation happens.
 */
export function parseTurns(
  body: unknown,
): { ok: true; contents: Content[] } | { ok: false; reason: string } {
  const raw = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, reason: 'No messages.' };
  if (raw.length > MAX_TURNS) return { ok: false, reason: 'Too many messages.' };

  const contents: Content[] = [];
  let total = 0;
  let lastRole = '';
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
    lastRole = role === 'assistant' ? 'model' : 'user';
    contents.push({ role: lastRole, parts: [{ text }] });
  }
  if (total > MAX_TOTAL_CHARS) return { ok: false, reason: 'Conversation too long.' };
  if (contents[0].role !== 'user' || lastRole !== 'user') {
    return { ok: false, reason: 'Conversation must start and end with the customer.' };
  }
  return { ok: true, contents };
}

/**
 * The catalogue as the model sees it. Built in a fixed key order and sorted by
 * slug, with nothing time-dependent in it, so the block is byte-identical
 * between requests until something in the shop actually changes. Gemini caches
 * repeated prefixes on its own, and a block that never varies gratuitously is
 * what gives it something to cache.
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

/** Stable instructions first, the catalogue after — the shape a prefix cache likes. */
async function systemInstruction(): Promise<string> {
  const [settings, catalogue] = await Promise.all([getSiteSettings(), catalogueBlock()]);
  const c = settings.contact;

  return [
    `You are the shopping assistant for ${settings.brandName}, an Indian saree and blouse shop. You help customers choose pieces, understand fabrics and care, and find their way around the shop.`,
    '',
    'Rules you never break:',
    '- Every product, price, option and stock figure you mention comes from the CATALOGUE below. If it is not there, it does not exist — say so rather than guess.',
    "- Never promise a delivery date, a discount, a custom alteration or anything the catalogue and the facts below do not state. Delivery charges and dates are confirmed at checkout from the customer's pincode.",
    '- Do not invent reviews, awards, or claims about who made a piece.',
    `- When you cannot answer, or the customer wants a person, offer WhatsApp: ${c.whatsapp}. That is a real number that reaches the shop.`,
    '- Link a product by writing its url exactly as given, for example /product/some-slug, on its own or in a sentence. Do not make up urls.',
    '- Be brief and warm. Two or three short sentences usually. No headings, no bullet lists longer than four items, no emoji, no markdown.',
    '- Stay on the shop. Politely decline anything unrelated to sarees, blouses, this shop, or an order from it.',
    '',
    'Shop facts:',
    `- Free shipping on orders of ${formatPaise(settings.freeShippingThresholdPaise)} and above; below that a flat ${formatPaise(settings.flatShippingPaise)} until checkout confirms the exact charge.`,
    `- Returns: ${settings.returnWindowDays} days from delivery. Details are confirmed at checkout; for anything specific, hand off to WhatsApp.`,
    '- Payment is taken securely at checkout. Order updates go out on WhatsApp.',
    `- Contact: WhatsApp ${c.whatsapp}${c.email ? `, email ${c.email}` : ''}${c.instagram ? `, Instagram ${c.instagram}` : ''}.`,
    '- Prices are in Indian rupees and include all taxes.',
    '',
    `CATALOGUE (JSON, one entry per product):`,
    catalogue,
  ].join('\n');
}

export type AssistantOutcome =
  | { kind: 'stream'; body: ReadableStream<Uint8Array> }
  | { kind: 'error'; status: number; message: string };

/**
 * Streams the reply as plain UTF-8 text chunks. The client appends them to the
 * last assistant bubble as they arrive; a safety stop is written into the same
 * stream as a normal sentence, so the reader never has to special-case it.
 */
export async function answer(contents: Content[]): Promise<AssistantOutcome> {
  const ai = new GoogleGenAI({ apiKey: apiKey() });
  const system = await systemInstruction();

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let wroteSomething = false;
      try {
        const stream = await ai.models.generateContentStream({
          model: MODEL,
          contents,
          config: {
            systemInstruction: system,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            // Off. This is a catalogue lookup in a chat bubble; thinking would
            // buy nothing and the customer would watch the pause.
            thinkingConfig: { thinkingBudget: 0 },
          },
        });

        let finish: FinishReason | undefined;
        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            wroteSomething = true;
            controller.enqueue(encoder.encode(text));
          }
          finish = chunk.candidates?.[0]?.finishReason ?? finish;
        }

        if (finish === FinishReason.MAX_TOKENS) {
          controller.enqueue(encoder.encode(' …'));
        } else if (!wroteSomething) {
          // SAFETY, RECITATION, or a turn that produced nothing at all. The
          // customer gets a way forward either way.
          controller.enqueue(
            encoder.encode(
              "I can't help with that one, but the shop can — message us on WhatsApp and a person will pick it up.",
            ),
          );
        }
      } catch (error) {
        // A failure mid-stream: end the reply cleanly with a line the customer
        // can act on, and log the class of failure without the key.
        console.error('[assistant] stream failed:', error instanceof Error ? error.message : error);
        controller.enqueue(
          encoder.encode(
            `${wroteSomething ? '\n\n' : ''}Something went wrong on my side. Please try again, or message the shop on WhatsApp.`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return { kind: 'stream', body };
}
