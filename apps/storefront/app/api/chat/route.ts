import { ApiError } from '@google/genai';
import { NextResponse } from 'next/server';
import { answer, isConfigured, parseTurns, throttled } from './assistant';

/**
 * POST /api/chat — the shop assistant.
 *
 * The browser sends the conversation so far (text only, its own turns and the
 * assistant's); this validates it, prices nothing, trusts nothing in it as a
 * fact, and streams the reply back as plain text. The key never leaves here.
 *
 * Status codes the panel understands:
 *   503 assistant_unconfigured — no key on the server; the panel shows the
 *       WhatsApp hand-off instead of a broken chat.
 *   429 — too many messages from this address in the window.
 *   400 — the body is not a conversation this will answer.
 */
export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: 'assistant_unconfigured' }, { status: 503 });
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  if (throttled(ip)) {
    return NextResponse.json({ error: 'too_many_messages' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const parsed = parseTurns(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: 'bad_request', reason: parsed.reason }, { status: 400 });
  }

  try {
    const outcome = await answer(parsed.contents);
    if (outcome.kind === 'error') {
      return NextResponse.json({ error: outcome.message }, { status: outcome.status });
    }
    return new Response(outcome.body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    // The key is never in any of these messages, but the status tells the log —
    // and the panel — what actually went wrong.
    if (error instanceof ApiError) {
      if (error.status === 401 || error.status === 403) {
        console.error('[assistant] the API key was rejected');
        return NextResponse.json({ error: 'assistant_unconfigured' }, { status: 503 });
      }
      if (error.status === 429) {
        return NextResponse.json({ error: 'assistant_busy' }, { status: 429 });
      }
      console.error(`[assistant] API error ${error.status}: ${error.message}`);
      return NextResponse.json({ error: 'assistant_unavailable' }, { status: 502 });
    }
    console.error('[assistant] failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'assistant_unavailable' }, { status: 502 });
  }
}

export function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}
