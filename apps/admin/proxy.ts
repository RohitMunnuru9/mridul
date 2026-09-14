/**
 * Keeping the signed-in session alive.
 *
 * This is `proxy.ts`, not `middleware.ts`, and the name matters. The router
 * supports both, but Vercel's platform treats a root `middleware.ts` as its
 * own Edge Middleware and tries to run it — which fails here, because this
 * build already bundles it into the server function. That mistake took both
 * apps down with MIDDLEWARE_INVOCATION_FAILED on every request, including the
 * login page. `proxy` is the convention Next renamed it to for exactly this
 * reason, and the platform leaves it alone.
 *
 * This exists because of one detail in how Supabase sessions work. An access
 * token lasts an hour. When it expires the client refreshes it — and that
 * refresh *rotates* the refresh token, so the old one stops working the moment
 * the new one is issued.
 *
 * A server component cannot write cookies. `sessionClient()` swallows that,
 * correctly, because there is nothing else it can do. But it means a refresh
 * that happens while rendering a page hands back new tokens that are never
 * saved: the browser keeps the old refresh token, which the rotation has just
 * revoked. The next navigation then fails to refresh at all, and the layout
 * sees no user and sends the admin to the sign-in page — in the middle of a
 * session, with no explanation, having done nothing wrong.
 *
 * Middleware runs before the page and *can* write cookies. So the refresh
 * happens here, where the result can be kept.
 *
 * It deliberately does no authorisation. Who may see what is decided by
 * `admin_roles` in Postgres and by the dashboard layout; this only makes sure
 * the request arrives carrying a session that is still valid.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Anything with a file extension — a photograph, the stylesheet, robots.txt.
 * None of them carry a session, and refreshing one costs a round trip to
 * Supabase that the request does not need.
 */
const LOOKS_LIKE_A_FILE = /\.[a-z0-9]+$/i;

export async function proxy(request: NextRequest) {
  if (LOOKS_LIKE_A_FILE.test(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without configuration there is no session to refresh. Let the request
  // through; the page will explain itself far better than a blank 500.
  if (!url || !anon) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        // Both halves matter: the request copy so anything later in this same
        // request sees the fresh token, and the response copy so the browser
        // actually keeps it.
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // The call itself is the point: it refreshes an expired token and, through
  // setAll above, that refresh finally gets written down.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  /**
   * Everything but the build's own output. The file-extension check at the top
   * of this module handles the rest: an extension alternation here is rejected
   * by the router as an ambiguous pattern, and one place to look is clearer.
   */
  matcher: ['/((?!_next/static|_next/image).*)'],
};
