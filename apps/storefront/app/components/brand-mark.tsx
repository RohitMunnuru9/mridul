import Link from 'next/link';
import { Flower2 } from 'lucide-react';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand-mark" href="/" aria-label="Mridul by MR home">
      <Flower2 aria-hidden="true" strokeWidth={1.3} />
      <span>
        <strong>Mridul</strong>
        {!compact && <small>by MR</small>}
      </span>
    </Link>
  );
}
