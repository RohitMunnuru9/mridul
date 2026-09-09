import Link from 'next/link';
import Image from 'next/image';
import { Star } from 'lucide-react';
import type { Testimonial } from '@mridul/types';
import { Botanical } from './botanical';

/**
 * What customers said.
 *
 * Renders nothing until a real review has been published — the same shape as
 * the journal and the rails, which also return null when they have nothing to
 * show. No review is seeded and none is invented here: a testimonial names a
 * person, and inventing one would put words in a stranger's mouth and mislead
 * every shopper who read it.
 *
 * Reviews are added and published in the admin, under Homepage.
 */
export function TestimonialsSection({ reviews }: { reviews: Testimonial[] }) {
  if (reviews.length === 0) return null;

  return (
    <section className="reviews" aria-labelledby="reviews-title">
      <header className="reviews-head">
        <p>In their words</p>
        <h2 id="reviews-title">Happy customers</h2>
      </header>

      <ul className="reviews-grid">
        {reviews.map((review, index) => (
          <li
            className={`review-card ${index % 2 === 0 ? 'is-blush' : 'is-cream'}${
              review.media ? ' has-photo' : ''
            }`}
            key={review.id}
          >
            {/* The drawing is what fills an empty corner. A review with its own
                picture does not need one, and two together is clutter. */}
            {review.media ? (
              <div className="review-photo">
                <Image
                  alt={review.media.alt}
                  fill
                  sizes="(max-width: 720px) 40vw, 12rem"
                  src={review.media.url}
                  style={{ objectPosition: review.media.focal }}
                />
              </div>
            ) : (
              <Botanical variant={index % 2 === 0 ? 'bloom' : 'sprig'} />
            )}

            <div className="review-stars" aria-label={`${review.rating} out of 5`}>
              {Array.from({ length: 5 }, (_, star) => (
                <Star
                  aria-hidden="true"
                  className={star < review.rating ? 'is-filled' : undefined}
                  key={star}
                />
              ))}
            </div>

            {/* A quotation this time — someone did say it. */}
            <blockquote>{review.body}</blockquote>

            <footer className="review-by">
              <cite>{review.author}</cite>
              {review.location && <span>{review.location}</span>}
              {review.productSlug && review.productName && (
                <Link href={`/product/${review.productSlug}`}>{review.productName}</Link>
              )}
            </footer>
          </li>
        ))}
      </ul>
    </section>
  );
}
