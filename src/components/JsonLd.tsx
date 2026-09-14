import { jsonLdString } from '@/lib/seo';

/**
 * One structured-data block.
 *
 * A `type="application/ld+json"` script is data, not code: the browser never
 * executes it, so the CSP's `script-src` — which blocks every inline script
 * without the per-request nonce — does not apply, and Google's crawler reads
 * it from the HTML without running anything. `dangerouslySetInnerHTML` is the
 * only way React will emit raw JSON into a script element; `jsonLdString`
 * escapes `<` so the content cannot close the tag early.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />
  );
}
