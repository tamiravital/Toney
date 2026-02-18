import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToneyProvider } from '@/context/ToneyContext';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Toney \u2014 Your Money Coach',
  description: 'Finally feel good about money. AI-powered coaching that understands your money patterns.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Toney',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('toney_theme');if(t&&t!=='default'){document.documentElement.setAttribute('data-theme',t)}var m=document.querySelector('meta[name="theme-color"]');if(m){var c=getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();if(c)m.setAttribute('content',c)}}catch(e){}})()` }} />
        <meta name="theme-color" content="#f9fafb" />
      </head>
      <body className="font-sans antialiased">
        <ToneyProvider>
          {children}
        </ToneyProvider>
      </body>
    </html>
  );
}
