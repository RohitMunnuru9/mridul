import { ArrowRight, Flower2 } from 'lucide-react';

export function OccasionEdit() {
  return (
    <section className="occasion-section" id="occasions" aria-label="Curated edits">
      <article className="occasion-visual">
        <div>
          <p>Everyday, extraordinary</p>
          <h2>Quiet pieces with a little more feeling.</h2>
          <a href="#new-arrivals">Shop ready to wear <ArrowRight aria-hidden="true" /></a>
        </div>
      </article>
      <article className="occasion-note">
        <Flower2 aria-hidden="true" />
        <p>The blouse edit</p>
        <h2>Fits that feel like you.</h2>
        <p className="occasion-body">Considered shapes, gentle structure, and details made to be seen.</p>
        <a href="#new-arrivals">Explore blouses <ArrowRight aria-hidden="true" /></a>
      </article>
      <article className="occasion-impact">
        <p>Conscious choices</p>
        <h2>Brighter tomorrows.</h2>
        <a href="#story">Our impact <ArrowRight aria-hidden="true" /></a>
      </article>
    </section>
  );
}
