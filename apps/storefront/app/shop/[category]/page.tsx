/**
 * Category listing — where the Sarees and Blouses buttons in the header land.
 *
 * The route is dynamic on the slug, so the two categories that exist today and
 * any the admin panel adds later are all served by this file.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronRight } from 'lucide-react';
import { getCategories, getCategoryBySlug } from '@mridul/database';
import type { RawSearchParams } from '@mridul/validation';
import { ProductListing } from '@/app/components/product-listing';

type PageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<RawSearchParams>;
};

/** Pre-renders the categories that exist at build time. */
export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: 'Not found | Mridul by MR' };

  return {
    title: `${category.name} | Mridul by MR`,
    description: category.intro,
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  return (
    <div className="listing-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <ChevronRight aria-hidden="true" />
        <Link href="/shop">Shop</Link>
        <ChevronRight aria-hidden="true" />
        <span aria-current="page">{category.name}</span>
      </nav>

      <ProductListing
        scope={{ kind: 'category', slug: category.slug }}
        basePath={`/shop/${category.slug}`}
        eyebrow={category.tagline}
        title={category.name}
        intro={category.intro}
        note={category.description}
        heroImage={category.heroImage}
        searchParams={await searchParams}
        emptyBody={`Try widening the price band or clearing a colour — the rest of the ${category.name.toLowerCase()} are still here.`}
      />
    </div>
  );
}
