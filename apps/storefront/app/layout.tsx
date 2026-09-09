import type { Metadata } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import './globals.css';
import './editorial.css';
import './header-refinement.css';
import './curated-edits.css';
import './journal-story.css';
import { SiteFooter } from './components/site-footer';
import { StorefrontHeader } from './components/storefront-header';
import { SilkInteractions } from './components/silk-interactions';
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
  const [categories, collections, settings, copy, menus] = await Promise.all([
    getCategories(),
    getCollections(),
    getSiteSettings(),
    getContentBlocks(),
    getNavigationMenus(),
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
          />
          <SilkInteractions />
          <main id="top">{children}</main>
          <SiteFooter
            categories={categories}
            collections={collections}
            settings={settings}
            copy={copy}
          />
          <WhatsAppButton phone={settings.contact.whatsapp} />
          <ToastHost />
        </StoreProvider>
      </body>
    </html>
  );
}
