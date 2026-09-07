import { ArrowRight } from 'lucide-react';

const stories = [
  { title: 'Five ways to drape for today', className: 'journal-drape' },
  { title: 'The art of the blouse', className: 'journal-blouse' },
  { title: 'Festive, without the fuss', className: 'journal-festive' },
];

export function JournalSection() {
  return (
    <section className="journal-section" aria-labelledby="journal-title">
      <div className="compact-section-heading">
        <div>
          <p>Notes from our world</p>
          <h2 id="journal-title">The style journal</h2>
        </div>
        <a href="#footer">View all <ArrowRight aria-hidden="true" /></a>
      </div>
      <div className="journal-grid">
        {stories.map((story) => (
          <a className={`journal-card ${story.className}`} href="#story" key={story.title}>
            <span>Read the story</span>
            <h3>{story.title}</h3>
            <ArrowRight aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
}
