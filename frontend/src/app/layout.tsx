import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
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

export const metadata: Metadata = {
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AppShell>{children}</AppShell>
        <Toaster position="bottom-right" offset={16} mobileOffset={{ bottom: '88px' }} closeButton />
      </body>
    </html>
  );
}
