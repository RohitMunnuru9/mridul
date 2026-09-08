import type { Metadata } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import './globals.css';
import { MobileBottomNav } from './components/mobile-bottom-nav';
import { SiteFooter } from './components/site-footer';
import { StorefrontHeader } from './components/storefront-header';
import { ToastHost } from './components/toast-host';
import { WhatsAppButton } from './components/whatsapp-button';
import { StoreProvider } from './providers/store-provider';
import {
  getCategories,
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

export const metadata: Metadata = {
  title: 'Mridul by MR | Sarees made to stay with you',
  description:
    'Thoughtfully made sarees and modern Indian clothing, rooted in craft and designed for today.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Navigation is data, not markup: the header, footer and mobile bar all read
  // the same catalogue, so the admin panel becomes the single place to change
  // what the storefront offers.
  const [categories, collections, menus, settings, copy] = await Promise.all([
    getCategories(),
    getCollections(),
    getNavigationMenus(),
    getSiteSettings(),
    getContentBlocks(),
  ]);

  return (
    <html lang="en">
      <body className={`${manrope.variable} ${cormorant.variable} antialiased`}>
        <StoreProvider>
          <StorefrontHeader
            menus={menus}
            collections={collections}
            announcements={settings.announcements}
            strapline={copy.header_strapline ?? ''}
          />
          <main id="top">{children}</main>
          <SiteFooter
            categories={categories}
            collections={collections}
            settings={settings}
            copy={copy}
          />
          <MobileBottomNav />
          <WhatsAppButton phone={settings.contact.whatsapp} />
          <ToastHost />
        </StoreProvider>
      </body>
    </html>
  );
}
