/**
 * Settings.
 *
 * The handful of values that appear all over the storefront. Changing the
 * free-shipping figure here moves the bag meter, the product page and the
 * delivery check together, because they all read this one row.
 */

import type { Metadata } from 'next';
import { getContentBlocks, getSiteSettings } from '@mridul/database';
import { updateContentBlock, updateSettings } from '../../actions/content';
import { EditForm, Field, FieldRow, TextArea } from '../../components/form';
import { PageHead, Panel } from '../../components/ui';

export const metadata: Metadata = { title: 'Settings | Mridul Admin' };

/** The prose blocks worth exposing, with a plain-English label for each. */
const BLOCKS: { key: string; label: string; hint: string }[] = [
  { key: 'header_strapline', label: 'Line beside the quote', hint: 'Top of every page' },
  { key: 'footer_brand_line', label: 'Footer brand line', hint: 'Under the logo' },
  { key: 'footer_quote', label: 'Footer quote', hint: 'The pull quote' },
  {
    key: 'pdp_shipping_returns',
    label: 'Shipping and returns',
    hint: 'Product page accordion',
  },
  {
    key: 'pdp_why_it_costs',
    label: 'Why it costs what it costs',
    hint: 'Product page accordion',
  },
];

export default async function SettingsPage() {
  const [settings, copy] = await Promise.all([getSiteSettings(), getContentBlocks()]);

  return (
    <>
      <PageHead title="Settings" subtitle="Values the whole storefront reads." />

      <Panel
        title="Shipping and contact"
        note="The free-shipping figure appears in the bag, on every product page and in the delivery check."
      >
        <EditForm action={updateSettings}>
          <FieldRow>
            <Field
              label="Free shipping above"
              name="free_shipping"
              defaultValue={settings.freeShippingThresholdPaise / 100}
              hint="In rupees"
            />
            <Field
              label="Flat rate below that"
              name="flat_shipping"
              defaultValue={settings.flatShippingPaise / 100}
              hint="In rupees"
            />
          </FieldRow>
          <FieldRow>
            <Field
              label="WhatsApp number"
              name="whatsapp"
              defaultValue={settings.contact.whatsapp}
              hint="Used by the chat button"
            />
            <Field
              label="Contact email"
              name="email"
              defaultValue={settings.contact.email}
            />
          </FieldRow>
          <TextArea
            label="Quotes above the header"
            name="quotes"
            defaultValue={settings.quotes.join('\n')}
            rows={5}
            hint="One per line. They rotate."
          />
        </EditForm>
      </Panel>

      <Panel title="Site copy" note="Wording that appears in the header, footer and product pages.">
        <div className="panel-stack">
          {BLOCKS.map((block) => (
            <EditForm action={updateContentBlock} key={block.key} compact>
              <input name="key" type="hidden" value={block.key} />
              <TextArea
                label={block.label}
                name="body"
                defaultValue={copy[block.key] ?? ''}
                rows={2}
                hint={block.hint}
              />
            </EditForm>
          ))}
        </div>
      </Panel>
    </>
  );
}
