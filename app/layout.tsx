import type { Metadata } from 'next';
import { IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700'],
  variable: '--font-ibm-plex-mono',
});

export const metadata: Metadata = {
  title: 'Tokamak ZK-Rollup Manager',
  description: 'User-friendly interface for Tokamak ZK Rollup Manager operations with zero-knowledge proofs',
  keywords: ['Tokamak', 'ZK Rollup', 'Bridge', 'Ethereum', 'DeFi', 'Zero-Knowledge', 'Privacy'],
  authors: [{ name: 'Tokamak Network' }],
  metadataBase: new URL('http://localhost:3000'),
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  other: {
    'Content-Language': 'en-US',
  },
  openGraph: {
    title: 'Tokamak ZK-Rollup Manager',
    description: 'Secure and efficient bridging solution with zero-knowledge proofs',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tokamak ZK-Rollup Manager',
    description: 'Secure and efficient bridging solution with zero-knowledge proofs',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4fc3f7',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-US" className="scroll-smooth" suppressHydrationWarning>
      <head></head>
      <body
        className={`${ibmPlexMono.variable} antialiased space-background text-white`}
        style={{ fontFamily: 'var(--font-ibm-plex-mono), "IBM Plex Mono", monospace' }}
      >
        <Providers>
          <div className="min-h-dvh space-background transition-colors duration-300">
            {children}
          </div>
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}