/**
 * The journal's decisions.
 *
 * Where "Read the story" leads is decided once, in journalHref, so the
 * homepage, the index and the sitemap cannot disagree. And a body is rendered
 * as text — paragraphs, nothing interpreted — so what is pasted into the
 * admin cannot become markup on a page every visitor loads.
 */

import { describe, expect, it } from 'vitest';
import { hasStory, journalHref, paragraphs, readingMinutes, slugify } from '@mridul/database';

describe('journalHref', () => {
  it('leads to the story when the post has one', () => {
    expect(journalHref({ slug: 'drape', body: 'Start with the pleats.', href: '/shop/sarees' }))
      .toBe('/journal/drape');
  });

  it('keeps leading to the listing when there is no story yet', () => {
    // The three seed posts. They have pointed at listings since the shop
    // opened and must keep doing so until somebody writes them a story.
    expect(journalHref({ slug: 'drape', body: '', href: '/shop/sarees' })).toBe('/shop/sarees');
  });

  it('does not count whitespace as a story', () => {
    expect(journalHref({ slug: 'x', body: '  \n\n  ', href: '/shop' })).toBe('/shop');
    expect(hasStory({ body: ' \n ' })).toBe(false);
  });

  it('falls back to the homepage rather than an empty href', () => {
    expect(journalHref({ slug: 'x', body: '', href: '' })).toBe('/');
  });
});

describe('paragraphs', () => {
  it('splits on blank lines and keeps single breaks inside a paragraph', () => {
    const body = 'First line\nstill first.\n\nSecond.\n\n\n\nThird.';
    expect(paragraphs(body)).toEqual(['First line\nstill first.', 'Second.', 'Third.']);
  });

  it('copes with Windows line endings', () => {
    expect(paragraphs('One.\r\n\r\nTwo.')).toEqual(['One.', 'Two.']);
  });

  it('ignores blank lines that are only spaces', () => {
    expect(paragraphs('One.\n   \nTwo.')).toEqual(['One.', 'Two.']);
  });

  it('returns nothing for an empty body rather than one empty paragraph', () => {
    expect(paragraphs('')).toEqual([]);
    expect(paragraphs('\n\n')).toEqual([]);
  });

  it('leaves anything that looks like markup exactly as text', () => {
    // Rendering is React text nodes, so this is escaped on the way out; the
    // helper must not strip or "fix" it either way.
    expect(paragraphs('<script>alert(1)</script>')).toEqual(['<script>alert(1)</script>']);
  });
});

describe('slugify', () => {
  it('makes an address a person could read out', () => {
    expect(slugify('Five ways to drape for today')).toBe('five-ways-to-drape-for-today');
  });

  it('drops punctuation and accents', () => {
    expect(slugify("The art of the blouse: what's underneath, café-style!")).toBe(
      'the-art-of-the-blouse-what-s-underneath-cafe-style',
    );
  });

  it('never starts or ends with a hyphen, even after being cut short', () => {
    const long = slugify('a'.repeat(58) + ' word more words');
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.startsWith('-')).toBe(false);
    expect(long.endsWith('-')).toBe(false);
    expect(slugify('  --hello--  ')).toBe('hello');
  });
});

describe('readingMinutes', () => {
  it('never says zero minutes', () => {
    expect(readingMinutes('Short.')).toBe(1);
    expect(readingMinutes('')).toBe(1);
  });

  it('rounds to the nearest minute at two hundred words a minute', () => {
    expect(readingMinutes(Array(600).fill('word').join(' '))).toBe(3);
  });
});
