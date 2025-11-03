import type { Metadata } from 'next';
import { Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

const inter = Inter({ subsets: ['latin'] });
const ibmPlexMono = IBM_Plex_Mono({ 
  weight: ['400', '500', '600'], 
  subsets: ['latin'],
  variable: '--font-ibm-plex-mono'
});

export const metadata: Metadata = {
  title: 'Tokamak ZKP Channel Manager',
  description: 'User-friendly interface for Tokamak ZKP Channel Manager operations',
  keywords: ['Tokamak', 'ZKP', 'Channel', 'Ethereum', 'DeFi', 'Zero-Knowledge Proof'],
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
    title: 'Tokamak ZKP Channel Manager',
    description: 'Secure and efficient bridging solution with zero-knowledge proofs',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tokamak ZKP Channel Manager',
    description: 'Secure and efficient channel management with zero-knowledge proofs',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-US" className="scroll-smooth m-0 p-0">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Jersey+10&display=swap" rel="stylesheet" />
      </head>
      <body className={`${inter.className} ${ibmPlexMono.variable} antialiased m-0 p-0 overflow-x-hidden`}>
        <Providers>
          {children}
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}