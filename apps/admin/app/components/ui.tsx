/**
 * Small presentational pieces shared across admin pages, so every section
 * looks the same and a new page is a data question rather than a layout one.
 */

import Link from 'next/link';
import { ArrowUpRight, Info } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Media lives in the storefront's `public` folder, so the admin loads it from
 * that origin rather than keeping a second copy that could drift. Once files
 * move to Supabase Storage the URLs become absolute and this prefix stops
 * being applied.
 */
const MEDIA_ORIGIN =
  process.env.NEXT_PUBLIC_STOREFRONT_ORIGIN ?? 'http://localhost:3000';

export function mediaUrl(url: string): string {
  return url.startsWith('/') ? `${MEDIA_ORIGIN}${url}` : url;
}

export function PageHead({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="admin-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="admin-head-actions">{actions}</div>}
    </header>
  );
}

export function StatCard({
  label,
  value,
  note,
  pending = false,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  pending?: boolean;
}) {
  return (
    <div className={`stat-card${pending ? ' is-pending' : ''}`}>
      <dt>{label}</dt>
      <dd>{pending ? '—' : value}</dd>
      {note && <small>{note}</small>}
    </div>
  );
}

export function Panel({
  title,
  note,
  children,
  wide = false,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={`panel${wide ? ' is-wide' : ''}`}>
      <div className="panel-head">
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Used wherever a section depends on a table that does not exist yet. Better
 * to name the blocker than to fill the screen with invented rows.
 */
export function AwaitingBackend({
  title,
  body,
  needs,
}: {
  title: string;
  body: string;
  needs: string[];
}) {
  return (
    <div className="awaiting">
      <Info aria-hidden="true" />
      <h2>{title}</h2>
      <p>{body}</p>
      <ul>
        {needs.map((need) => (
          <li key={need}>
            <code>{need}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Pill({
  tone,
  children,
}: {
  tone: 'ok' | 'low' | 'out' | 'muted';
  children: ReactNode;
}) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

/**
 * A thumbnail that renders the image exactly as the storefront crops it, so
 * what the admin sees is what a customer sees. A plain `img` on purpose: these
 * are cross-origin while media is served by the storefront, and an admin
 * thumbnail is not worth an image-optimiser round trip.
 */
export function MediaThumb({
  url,
  alt,
  focal,
  size = 56,
}: {
  url: string;
  alt: string;
  focal: string;
  size?: number;
}) {
  return (
    <span className="media-thumb" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mediaUrl(url)} alt={alt} style={{ objectPosition: focal }} />
    </span>
  );
}

/**
 * Opens the corresponding storefront page in a new tab.
 *
 * The origin comes from the same variable `mediaUrl` uses, rather than being
 * written out here. It was hardcoded to localhost, so every "View listing" in
 * the deployed admin pointed at a machine that was not running.
 */
export function ViewOnSite({ href, label = 'View' }: { href: string; label?: string }) {
  return (
    <a
      className="view-on-site"
      href={`${MEDIA_ORIGIN}${href}`}
      rel="noreferrer noopener"
      target="_blank"
    >
      {label}
      <ArrowUpRight aria-hidden="true" />
    </a>
  );
}

export function InternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="internal-link" href={href}>
      {children}
    </Link>
  );
}
