/**
 * Where a banner goes, and how the card should say so.
 *
 * `Promo.link` is a storefront path or one of the external destinations the
 * API allows — `https://`/`http://` (a website, or WhatsApp via wa.me),
 * `tel:` and `mailto:`. The API is the gate on what the string may be; this
 * only reads it. A storefront path is a client-side navigation; anything
 * else is a real anchor, because `next/link` would try to route it. A
 * website opens in a new tab so the shop stays open behind it; a phone,
 * WhatsApp or mail link hands off to another app and a new tab would be an
 * empty one.
 */

export type PromoDestination = {
  href: string;
  /** True for anything that is not a page of this storefront. */
  external: boolean;
  /** Websites only — see above. */
  newTab: boolean;
  /** The button label: "Shop now" is wrong for a phone number. */
  cta: string;
};

export function promoDestination(link: string | null | undefined): PromoDestination {
  const href = (link ?? '').trim() || '/products';
  if (href.startsWith('/')) {
    return { href, external: false, newTab: false, cta: 'Shop now' };
  }
  const lower = href.toLowerCase();
  if (lower.startsWith('https://wa.me/') || lower.startsWith('https://api.whatsapp.com/')) {
    return { href, external: true, newTab: false, cta: 'Message on WhatsApp' };
  }
  if (lower.startsWith('tel:')) {
    return { href, external: true, newTab: false, cta: 'Call now' };
  }
  if (lower.startsWith('mailto:')) {
    return { href, external: true, newTab: false, cta: 'Email us' };
  }
  return { href, external: true, newTab: true, cta: 'Learn more' };
}
