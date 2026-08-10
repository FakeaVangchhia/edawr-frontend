import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, Manrope } from 'next/font/google';
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
};

export const viewport: Viewport = {
  // Matches the header gradient so the phone's status bar blends into the app
  // rather than sitting on a white strip above it.
  themeColor: '#2e1065',
  width: 'device-width',
  initialScale: 1,
  // Deliberately NOT maximumScale: 1. Locking zoom is a common storefront
  // habit and an accessibility failure — anyone who needs to enlarge text to
  // read a price must be able to.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${ibmPlexSans.variable} ${manrope.variable} h-full antialiased`}
    >
      {/* No cart provider: the basket is a module-level external store (see
          lib/cart-store.ts), so it survives navigation without one — and stays
          in sync across browser tabs, which a React context could not do. */}
      <body className="min-h-full">{children}</body>
    </html>
  );
}
