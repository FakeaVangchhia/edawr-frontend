import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { connection } from 'next/server';
import { Analytics } from '@vercel/analytics/next';
import { Toaster } from '@/components/ui/sonner';
import { AppShell } from '@/components/AppShell';
import { SITE_URL } from '@/lib/seo';
import './globals.css';

/**
 * Inter through `next/font`, not a Google Fonts <link>.
 *
 * The CSP in `src/proxy.ts` names no external font or style origin, so a
 * stylesheet link to fonts.googleapis.com would simply be blocked and the whole
 * page would fall back to system sans. `next/font` downloads the face at build
 * time and self-hosts it, which is both faster and the only version that works
 * under this policy.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

/**
 * The place name is in the title on purpose. "Everything you need, delivered
 * in minutes" is the brand line and stays on the page; a search for grocery
 * delivery is a search for grocery delivery *somewhere*, and the title is the
 * first thing Google matches against. "Aizawl" and "Mizoram" are the words a
 * customer types.
 */
const TITLE = 'eDawr — Grocery delivery in Aizawl in 15 minutes';
const DESCRIPTION =
  'Order groceries online in Aizawl, Mizoram. Fresh produce, snacks, beverages and household essentials delivered to your door in 15 minutes, with live tracking on every order.';

/**
 * Google Search Console ownership token, if one is set.
 *
 * Pasting the `<meta name="google-site-verification">` content here is the
 * quickest of the verification methods and the only one that ships with the
 * code. Optional: DNS verification works without it, and an unset variable
 * emits nothing.
 */
const GOOGLE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

/**
 * `metadataBase` is the origin `og:image`, `twitter:image` and every
 * canonical URL are resolved against — see `lib/seo.ts` for why it lives
 * there. Next emits the file-convention images as **absolute** URLs because
 * that is the only kind a crawler can fetch; without a base it falls back to
 * `http://localhost:3000`, silently, inside someone else's crawler.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s | eDawr' },
  description: DESCRIPTION,
  applicationName: 'eDawr',
  manifest: '/manifest.webmanifest',
  keywords: [
    'grocery delivery Aizawl',
    'online grocery Mizoram',
    'quick commerce Aizawl',
    '15 minute delivery',
    'eDawr',
  ],
  // The defaults, spelled out: index everything that does not say otherwise,
  // and let Google show a large product image and a full snippet. The
  // per-customer pages (cart, checkout, account, tracking) each override this
  // with `noindex`, and `robots.ts` keeps crawlers off them entirely.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  ...(GOOGLE_VERIFICATION ? { verification: { google: GOOGLE_VERIFICATION } } : {}),
  openGraph: {
    siteName: 'eDawr',
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    locale: 'en_IN',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  /**
   * Forces every route to render per request, and this is load-bearing rather
   * than ceremony.
   *
   * `src/proxy.ts` issues a fresh CSP nonce on every request, and the policy it
   * builds uses `'strict-dynamic'` — which tells a CSP3 browser to ignore the
   * `'self'` source entirely and trust only scripts carrying the nonce. A
   * statically prerendered page ships HTML whose `<script>` tags were written
   * at build time and carry no nonce at all, so the browser blocks every one of
   * them: the page paints, never hydrates, and the console fills with CSP
   * violations.
   *
   * It only breaks in `next build`. `next dev` renders per request anyway, so
   * this was invisible in development and would have appeared for the first
   * time on the deployed storefront, on twelve prerendered routes at once —
   * home, cart, checkout, products, categories, search, orders, offers,
   * account, addresses and both error pages. The console's root layout already
   * does this; the storefront's did not.
   */
  await connection();

  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AppShell>{children}</AppShell>
        {/*
          The mobile offset clears both pieces of bottom chrome, and is derived
          rather than guessed.

          It was a flat `88px`, chosen when the tab bar was assumed to be 68px
          tall. The bar is actually `--tabbar-height` — 56px plus the
          home-indicator inset — so on an iPhone it is ~90px and the toast's
          bottom edge sat behind it. Worse, cart and checkout stack a sticky
          action bar (~77px) directly on top, which a toast at 88px covered
          almost entirely: on the cart that is the "Undo" on a just-emptied
          basket, and on checkout it is the Place order button.

          `5.5rem` is that action bar plus a little air, so a toast sits above
          the tallest chrome any screen puts at the bottom.
        */}
        <Toaster
          position="bottom-right"
          offset={16}
          mobileOffset={{ bottom: 'calc(var(--tabbar-height) + 5.5rem)' }}
          closeButton
        />
        {/*
          Vercel Web Analytics. Renders nothing itself; on mount it appends a
          `<script src="/_vercel/insights/script.js">` and page views POST to
          `/_vercel/insights/view`, both same-origin, so `connect-src 'self'`
          in `src/proxy.ts` already covers the beacon. The injected tag needs no
          nonce: it is created by a nonced script, and `'strict-dynamic'`
          trusts what a trusted script creates. Off Vercel the script 404s and
          the component stays silent.
        */}
        <Analytics />
      </body>
    </html>
  );
}
