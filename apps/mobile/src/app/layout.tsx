import type { Metadata, Viewport } from 'next';
import { Geist, Plus_Jakarta_Sans, Fraunces, Lora, DM_Serif_Display } from 'next/font/google';
import './globals.css';
import { ToneyProvider } from '@/context/ToneyContext';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta',
  subsets: ['latin'],
});

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
});

const lora = Lora({
  variable: '--font-lora',
  subsets: ['latin'],
});

const dmSerif = DM_Serif_Display({
  variable: '--font-dm-serif',
  weight: '400',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#4f46e5" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('toney_theme');if(t&&t!=='default')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()` }} />
      </head>
      <body className={`${geistSans.variable} ${plusJakarta.variable} ${fraunces.variable} ${lora.variable} ${dmSerif.variable} font-sans antialiased`}>
        <ToneyProvider>
          {children}
        </ToneyProvider>
      </body>
    </html>
  );
}
