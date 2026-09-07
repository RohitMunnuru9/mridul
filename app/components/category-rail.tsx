import { ArrowRight } from 'lucide-react';
import { categories } from '../catalog';

export function CategoryRail() {
  return (
    <section className="category-section" id="categories" aria-labelledby="category-title">
      <div className="compact-section-heading">
        <div>
          <p>Find your way in</p>
          <h2 id="category-title">Shop by mood</h2>
        </div>
        <a href="#new-arrivals">See all <ArrowRight aria-hidden="true" /></a>
      </div>
      <div className="category-grid">
        {categories.map(({ href, icon: Icon, label, note, tone }) => (
          <a className="category-card" href={href} key={label}>
            <span className={`category-orbit tone-${tone}`}>
              <Icon aria-hidden="true" strokeWidth={1.15} />
            </span>
            <strong>{label}</strong>
            <small>{note}</small>
          </a>
        ))}
      </div>
    </section>
  );
}
