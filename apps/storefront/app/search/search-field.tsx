'use client';

/**
 * Search box on the results page.
 *
 * Submits as a plain GET form to `/search`, so it works without JavaScript and
 * the resulting URL is the page. Clearing it navigates back to the prompt.
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SearchField({ term }: { term: string }) {
  const router = useRouter();
  const [value, setValue] = useState(term);

  return (
    <form
      action="/search"
      className="search-page-field"
      method="get"
      onSubmit={(event) => {
        event.preventDefault();
        const next = value.trim();
        router.push(next ? `/search?q=${encodeURIComponent(next)}` : '/search');
      }}
      role="search"
    >
      <Search aria-hidden="true" />
      <label className="sr-only" htmlFor="search-term">
        Search products
      </label>
      <input
        autoComplete="off"
        id="search-term"
        name="q"
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search sarees, blouses, fabrics…"
        type="search"
        value={value}
      />
      {value && (
        <button
          aria-label="Clear search"
          className="search-clear"
          onClick={() => {
            setValue('');
            router.push('/search');
          }}
          type="button"
        >
          <X aria-hidden="true" />
        </button>
      )}
      <Button className="search-submit" type="submit">
        Search
      </Button>
    </form>
  );
}
