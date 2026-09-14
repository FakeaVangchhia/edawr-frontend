import { describe, expect, it } from 'vitest';

import { promoDestination } from '@/lib/promo-link';

describe('promoDestination()', () => {
  it('treats a path, or nothing, as a page of the shop', () => {
    expect(promoDestination(null)).toEqual({ href: '/products', external: false, newTab: false, cta: 'Shop now' });
    expect(promoDestination('/offers')).toMatchObject({ href: '/offers', external: false });
  });

  it('hands a phone, WhatsApp or mail link to the other app in the same tab', () => {
    expect(promoDestination('https://wa.me/919812345678')).toMatchObject({ external: true, newTab: false, cta: 'Message on WhatsApp' });
    expect(promoDestination('tel:+919812345678')).toMatchObject({ external: true, newTab: false, cta: 'Call now' });
    expect(promoDestination('mailto:a@b.co')).toMatchObject({ external: true, newTab: false, cta: 'Email us' });
  });

  it('opens a website in a new tab', () => {
    expect(promoDestination('https://example.com/sale')).toEqual({
      href: 'https://example.com/sale',
      external: true,
      newTab: true,
      cta: 'Learn more',
    });
  });
});
