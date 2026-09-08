import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { connection } from 'next/server';
import { Toaster } from '@/components/ui/sonner';
import { AppShell } from '@/components/AppShell';
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

const TITLE = 'eDawr — Everything you need, delivered in minutes';
const DESCRIPTION =
  'Groceries, fresh produce, snacks, beverages and household essentials delivered across Aizawl in minutes. Live tracking on every order.';

/**
 * The origin `og:image` and `twitter:image` are resolved against.
 *
 * `src/app/opengraph-image.png` and `twitter-image.png` are file-convention
 * metadata, and Next emits them as **absolute** URLs because that is the only
 * kind a social crawler can fetch. Without a base it falls back to
 * `http://localhost:3000` and every shared link renders a broken image — a
 * build-time warning, and nothing at runtime, because the failure happens
 * inside someone else's crawler.
 *
 * Overridable so a preview deployment advertises its own cards, but with a real
 * default: the alternative is remembering to set a variable whose absence is
 * invisible until a customer shares the shop.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://edawr.in';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s | eDawr' },
  description: DESCRIPTION,
  applicationName: 'eDawr',
  manifest: '/manifest.webmanifest',
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
      </body>
    </html>
  );
}
