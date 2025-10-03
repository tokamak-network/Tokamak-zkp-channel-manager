import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Tokamak ZK Rollup Manager',
  description: 'User-friendly interface for Tokamak ZK Rollup Manager operations',
  keywords: ['Tokamak', 'ZK Rollup', 'Bridge', 'Ethereum', 'DeFi'],
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
    title: 'Tokamak ZK Rollup Manager',
    description: 'Secure and efficient bridging solution with zero-knowledge proofs',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tokamak ZK Rollup Manager',
    description: 'Secure and efficient bridging solution with zero-knowledge proofs',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0ea5e9',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-US" className="scroll-smooth">
      <body className={`${inter.className} antialiased`}>
        <Providers>
          <div className="min-h-dvh bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-slate-900 transition-colors duration-300" style={{backgroundSize: '100% 120vh', backgroundAttachment: 'fixed'}}>
            {children}
          </div>
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}