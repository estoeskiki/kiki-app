import type { Metadata } from 'next';
import { Space_Grotesk, Syne } from 'next/font/google';
import { cookies } from 'next/headers';
import './globals.css';

// Self-hosted by next/font, unlike the design reference's <link> to
// fonts.googleapis.com — no render-blocking third-party request, and the CSP in
// next.config.ts can keep font-src locked to 'self'.
const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const syne = Syne({
  variable: '--font-syne',
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Kiki · Consola Admin',
  description: 'Monitoreo y gestión de pedidos, menús y locales.',
  // An admin console has no business in a search index.
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Dark is the product default; the toggle in the sidebar writes this cookie.
  // Reading it server-side means the correct theme is in the first paint
  // instead of flashing light and correcting on hydration.
  const theme = (await cookies()).get('kiki-theme')?.value === 'light' ? 'light' : 'dark';

  return (
    <html
      lang="es"
      data-theme={theme}
      className={`${spaceGrotesk.variable} ${syne.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
