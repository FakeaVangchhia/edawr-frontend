import type { Metadata } from 'next';
import { CategoryPage } from './CategoryPage';
import { JsonLd } from '@/components/JsonLd';
import { slugify } from '@/lib/catalogue';
import { breadcrumbJsonLd, seoSignal } from '@/lib/seo';
import { fetchCategories } from '@/lib/store-api';

/**
 * `params` is a Promise in this version of Next.js and must be awaited — both
 * here and in `generateMetadata`. This is one of the framework's breaking
 * changes; see `frontend/AGENTS.md`.
 */

/**
 * The category's real name for the <title> and the breadcrumb.
 *
 * Resolved against the category list rather than reconstructed from the slug:
 * "dairy-and-bread" un-slugs to "Dairy And Bread", and the shop calls it
 * "Dairy & Bread" — which is also what a customer searches for. The list is
 * one small request and a crawler reads the title without running any of the
 * page, so it is worth making here. Falls back to the un-slugged words when
 * the API is unreachable, so the page still has a title.
 */
async function categoryName(slug: string): Promise<string> {
  try {
    const match = (await fetchCategories(seoSignal())).find(
      (category) => slugify(category.name) === slug,
    );
    if (match) return match.name;
  } catch {
    // Fall through to the approximation.
  }
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const name = await categoryName(slug);
  return {
    title: name,
    description: `Everything eDawr stocks in ${name}, delivered across Aizawl in minutes.`,
    alternates: { canonical: `/category/${slug}` },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const name = await categoryName(slug);
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name, path: `/category/${slug}` },
        ])}
      />
      <CategoryPage slug={slug} />
    </>
  );
}
