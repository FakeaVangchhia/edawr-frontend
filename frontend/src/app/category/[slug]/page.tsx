import type { Metadata } from 'next';
import { CategoryPage } from './CategoryPage';

/**
 * `params` is a Promise in this version of Next.js and must be awaited — both
 * here and in `generateMetadata`. This is one of the framework's breaking
 * changes; see `frontend/AGENTS.md`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // The slug is all that is known server-side: resolving it to a display name
  // needs the category list, which is fetched in the browser. Turning the slug
  // back into words is a fair approximation for a <title>.
  const name = slug.replace(/-/g, ' ');
  return {
    title: name.replace(/\b\w/g, (letter) => letter.toUpperCase()),
    description: `Everything eDawr stocks in ${name}, delivered across Aizawl in minutes.`,
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CategoryPage slug={slug} />;
}
