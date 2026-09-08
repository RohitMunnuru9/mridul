import Link from 'next/link';
import {
  ArrowRight,
  Flower2,
  Gem,
  Gift,
  Scissors,
  Sparkles,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { getMoodTiles } from '@mridul/database';

/** Icon keys are stored as data, so the map lives with the markup. */
const ICONS: Record<string, LucideIcon> = {
  waves: Waves,
  sparkles: Sparkles,
  scissors: Scissors,
  gem: Gem,
  flower: Flower2,
  gift: Gift,
};

export async function CategoryRail() {
  const tiles = await getMoodTiles();

  return (
    <section
      className="category-section"
      id="categories"
      aria-labelledby="category-title"
    >
      <div className="compact-section-heading">
        <div>
          <p>Find your way in</p>
          <h2 id="category-title">Shop by mood</h2>
        </div>
        <Link href="/shop/sarees">
          See all <ArrowRight aria-hidden="true" />
        </Link>
      </div>
      <div className="category-grid">
        {tiles.map((tile) => {
          const Icon = ICONS[tile.icon] ?? Sparkles;
          return (
            <Link className="category-card" href={tile.href} key={tile.id}>
              <span className={`category-orbit tone-${tile.tone}`}>
                <Icon aria-hidden="true" strokeWidth={1.15} />
              </span>
              <strong>{tile.label}</strong>
              <small>{tile.note}</small>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
