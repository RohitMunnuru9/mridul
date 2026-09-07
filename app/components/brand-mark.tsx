import { Flower2 } from 'lucide-react';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <a className="brand-mark" href="#top" aria-label="Mridul by MR home">
      <Flower2 aria-hidden="true" strokeWidth={1.3} />
      <span>
        <strong>Mridul</strong>
        {!compact && <small>by MR</small>}
      </span>
    </a>
  );
}
