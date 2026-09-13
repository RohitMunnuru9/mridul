import type { Metadata } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import './globals.css';
import './editorial.css';
import './header-refinement.css';
import './curated-edits.css';
import './journal-story.css';
import './footer-reviews.css';
import './orders.css';
import { SiteFooter } from './components/site-footer';
import { StorefrontHeader } from './components/storefront-header';
import { SilkInteractions } from './components/silk-interactions';
import { ToastHost } from './components/toast-host';
import { HelpChat } from './components/help-chat';
import { StoreProvider } from './providers/store-provider';
import {
  getCategories,
  getHelpProducts,
  getCollections,
  getContentBlocks,
  getNavigationMenus,
  getSiteSettings,
} from '@mridul/database';

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
});

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['400', '500', '600'],
});

const SITE =
  process.env.NEXT_PUBLIC_STOREFRONT_ORIGIN ?? 'https://mridul-storefront.vercel.app';

export const metadata: Metadata = {
  // Without this every canonical and social URL is relative, which a crawler
  // and a link preview both read as broken.
  metadataBase: new URL(SITE),
  title: 'Mridul by MR | Sarees made to stay with you',
  description:
    'Thoughtfully made sarees and modern Indian clothing, rooted in craft and designed for today.',
  // The file has been sitting in `public` unreferenced, so every tab showed a
  // blank page icon and browsers fell back to asking for /favicon.ico, which
  // does not exist.
  icons: { icon: '/favicon.svg', apple: '/images/brand/mridul-emblem.webp' },
  openGraph: {
    type: 'website',
    siteName: 'Mridul by MR',
    title: 'Mridul by MR | Sarees made to stay with you',
    description:
      'Thoughtfully made sarees and modern Indian clothing, rooted in craft and designed for today.',
    images: ['/images/saree-homepage-hero.webp'],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [categories, collections, settings, copy, menus, helpProducts] =
    await Promise.all([
      getCategories(),
      getCollections(),
      getSiteSettings(),
      getContentBlocks(),
      getNavigationMenus(),
      // What the help panel answers catalogue questions from. Read here with
      // everything else rather than fetched by the panel, so it costs one more
      // parallel query rather than a second round trip.
      getHelpProducts(),
    ]);

  return (
    <html lang="en">
      <body className={`${manrope.variable} ${cormorant.variable} antialiased`}>
        <StoreProvider>
          <StorefrontHeader
            menus={menus}
            collections={collections.filter(
              (collection) => collection.showInNav,
            )}
            announcements={settings.announcements}
            quotes={settings.quotes}
            whatsapp={settings.contact.whatsapp}
          />
          <SilkInteractions />
          <main id="top">{children}</main>
          <SiteFooter
            categories={categories}
            collections={collections}
            settings={settings}
            copy={copy}
          />
          {/* Every figure comes from Settings, so the answers cannot drift
              from what checkout actually charges. */}
          <HelpChat
            facts={{
              freeShippingThresholdPaise: settings.freeShippingThresholdPaise,
              flatShippingPaise: settings.flatShippingPaise,
              returnWindowDays: settings.returnWindowDays,
              email: settings.contact.email,
              whatsapp: settings.contact.whatsapp,
            }}
            products={helpProducts}
          />
          <ToastHost />
        </StoreProvider>
      </body>
    </html>
  );
}
