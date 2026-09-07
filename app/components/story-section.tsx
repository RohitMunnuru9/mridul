import { ArrowRight, HeartHandshake, RefreshCcw, ShieldCheck, Truck } from 'lucide-react';
import Image from 'next/image';

const values = [
  { icon: Truck, title: 'Free shipping', note: 'Above ₹1,999' },
  { icon: RefreshCcw, title: 'Easy returns', note: 'Within 7 days' },
  { icon: ShieldCheck, title: 'Secure payments', note: 'Protected, always' },
  { icon: HeartHandshake, title: 'Support artisans', note: 'Weavers first' },
];

export function StorySection() {
  return (
    <>
      <section className="story-section" id="story" aria-labelledby="story-title">
        <div className="story-image"><Image fill sizes="(max-width: 860px) 100vw, 55vw" src="/images/artisan-loom-story.png" alt="Artisan hands weaving rose and moss threads on a wooden handloom" /></div>
        <div className="story-copy">
          <p>Rooted in her</p>
          <h2 id="story-title">A more mindful kind of modern.</h2>
          <p className="story-body">Every Mridul piece begins with a conversation—with a weaver, a landscape, and a feeling worth translating into cloth.</p>
          <div className="story-stats">
            <span><strong>14</strong> craft clusters</span><span><strong>280+</strong> artisan partners</span><span><strong>100%</strong> considered</span>
          </div>
          <a href="#footer">Our story <ArrowRight aria-hidden="true" /></a>
        </div>
      </section>
      <section className="value-strip" aria-label="Shopping benefits">
        {values.map(({ icon: Icon, note, title }) => (
          <div key={title}><Icon aria-hidden="true" strokeWidth={1.25} /><span><strong>{title}</strong><small>{note}</small></span></div>
        ))}
      </section>
    </>
  );
}
