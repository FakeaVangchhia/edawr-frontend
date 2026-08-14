import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import { IBM_Plex_Sans, Manrope } from 'next/font/google';
import LiquidBackdrop from '@/components/store/LiquidBackdrop';
import './globals.css';

const ibmPlexSans = IBM_Plex_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-ibm-plex',
});

const manrope = Manrope({
  weight: ['500', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  title: 'eDawr · Groceries in 15 minutes',
  description:
    'Fresh groceries, snacks and daily essentials delivered across Aizawl in 15 minutes.',
  applicationName: 'eDawr',
  // Without a base, Next emits relative Open Graph URLs and warns at build.
  // A share card with a relative image URL renders as a blank card.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  manifest: '/manifest.webmanifest',
  // `src/app/favicon.ico` is picked up by Next's file convention and covers the
  // legacy path; this adds the scalable one, which is what a modern tab and the
  // manifest both prefer. Declared explicitly rather than as `src/app/icon.svg`
  // so the manifest can point at the same stable URL.
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }] },
  openGraph: {
    title: 'eDawr · Groceries in 15 minutes',
    description:
      'Fresh groceries, snacks and daily essentials delivered across Aizawl in 15 minutes.',
    siteName: 'eDawr',
    type: 'website',
  },
};

export const viewport: Viewport = {
  // Matches the page ground so the phone's status bar blends into the app
  // rather than sitting on a darker strip above it. Must stay in step with
  // `background_color` in public/manifest.webmanifest — a manifest still
  // naming the old dark ground gives a light app a dark splash screen.
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  // Deliberately NOT maximumScale: 1. Locking zoom is a common storefront
  // habit and an accessibility failure — anyone who needs to enlarge text to
  // read a price must be able to.
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /**
   * Opt every route into dynamic rendering.
   *
   * This is load-bearing for the Content Security Policy, not a performance
   * choice. `src/proxy.ts` sends `script-src 'nonce-…' 'strict-dynamic'`, and
   * the nonce is generated per request — but a *statically prerendered* page's
   * HTML is written at build time, when no request and therefore no nonce
   * exists. Its script tags ship without a nonce, and because `'strict-dynamic'`
   * makes a CSP3 browser ignore `'self'`, every one of them is blocked: the page
   * paints server HTML and never hydrates. No search, no add to cart, no admin
   * console.
   *
   * It does not reproduce under `next dev`, which renders everything
   * dynamically — so it ships green and breaks only once deployed.
   *
   * Awaiting a connection here costs this app nothing real: every page fetches
   * its data from the API in the browser, so there was never meaningful HTML to
   * prerender. See the Next.js CSP guide, "Adding a nonce with Proxy".
   */
  await connection();

  return (
    <html
      lang="en"
      className={`${ibmPlexSans.variable} ${manrope.variable} h-full antialiased`}
    >
      {/* No cart provider: the basket is a module-level external store (see
          lib/cart-store.ts), so it survives navigation without one — and stays
          in sync across browser tabs, which a React context could not do. */}
      <body className="min-h-full">
        {/* First tab stop on every page. The store header has five controls
            before the first product, so without this a keyboard or switch user
            walks the whole of it on each navigation. Off-screen until focused,
            so it costs a pointer user nothing. */}
        <a href="#main" className="skip-link">
          Skip to products
        </a>
        {/* The page ground, fixed behind everything at -z-10. Server-rendered,
            no JavaScript. */}
        <LiquidBackdrop />
        {children}
      </body>
    </html>
  );
}
