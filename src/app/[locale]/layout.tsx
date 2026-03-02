import type { Metadata } from 'next'
import type { Viewport } from 'next'

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "fr" }];
}

export const metadata: Metadata = {
  title: 'Interligens',
  description: 'Anti-scam blockchain security scanner',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Interligens',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#F85B05',
}

export default function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
