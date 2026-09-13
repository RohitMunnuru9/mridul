import Image from 'next/image';
import Link from 'next/link';

/**
 * The brand mark.
 *
 * The supplied wordmark, which already contains both "Mridul" and "BY MR" and
 * the leaf — so the separate icon and the sub-line that used to be set in type
 * beside it have gone; repeating them would say the name twice.
 *
 * The file is cropped to the artwork and its cream ground keyed out, so the
 * same image sits on the cream header, the cream footer and the wine
 * transition panel without a pale rectangle behind it.
 *
 * `alt` carries the name because this is the link home, not decoration: with
 * images off, or read aloud, "Mridul by MR home" is the whole of what it says.
 */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      aria-label="Mridul by MR home"
      className={`brand-mark${compact ? ' is-compact' : ''}`}
      href="/"
    >
      <Image
        alt="Mridul by MR"
        height={336}
        priority
        sizes="(max-width: 720px) 190px, 240px"
        src="/images/brand/mridul-wordmark.webp"
        width={1100}
      />
    </Link>
  );
}
