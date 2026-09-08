/**
 * Settings.
 *
 * Site-wide values the storefront actually reads — the announcement strip, the
 * free-shipping threshold, the WhatsApp number, the social links. The
 * threshold in particular is worth having in one place: the announcement bar,
 * the bag meter, the product page delivery check and the shipping module all
 * read this single figure, so they cannot drift apart.
 */

import type { Metadata } from 'next';
import { getSiteSettings } from '@mridul/database';
import { formatPaise } from '@mridul/utils';
import { FREE_SHIPPING_THRESHOLD_PAISE, FALLBACK_SHIPPING_PAISE } from '@mridul/shipping';
import { TEMPLATES } from '@mridul/notifications';
import { PageHead, Panel, Pill, StatCard } from '../components/ui';

export const metadata: Metadata = { title: 'Settings | Mridul Admin' };

const INTEGRATIONS = [
  {
    name: 'Supabase',
    role: 'Database, auth and storage',
    status: 'pending' as const,
    note: 'Not connected. Every section here reads seed data until it is.',
  },
  {
    name: 'Razorpay',
    role: 'Payments',
    status: 'pending' as const,
    note: 'Contract defined in @mridul/payments. Needs keys and a webhook endpoint.',
  },
  {
    name: 'WhatsApp Cloud API',
    role: 'Order notifications',
    status: 'pending' as const,
    note: 'Templates listed below need approval in the Meta console.',
  },
  {
    name: 'Shipping provider',
    role: 'Rates and tracking',
    status: 'undecided' as const,
    note: 'Deliberately unchosen. Anything implementing ShippingProvider drops in.',
  },
];

export default async function SettingsPage() {
  const settings = await getSiteSettings();

  return (
    <>
      <PageHead
        title="Settings"
        subtitle="Site-wide values and the state of each integration."
      />

      <dl className="stat-grid">
        <StatCard
          label="Free shipping over"
          value={formatPaise(settings.freeShippingThresholdPaise)}
          note="one figure, read everywhere"
        />
        <StatCard
          label="Flat shipping"
          value={formatPaise(FALLBACK_SHIPPING_PAISE)}
          note="below the threshold"
        />
        <StatCard
          label="Return window"
          value={`${settings.returnWindowDays} days`}
          note="from delivery"
        />
        <StatCard
          label="Announcements"
          value={settings.announcements.length}
          note="rotating in the header"
        />
      </dl>

      <div className="panel-row">
        <Panel title="Brand" note="Shown in the header, footer and page titles.">
          <dl className="field-list">
            <div>
              <dt>Name</dt>
              <dd className="field-strong">{settings.brandName}</dd>
            </div>
            <div>
              <dt>Tagline</dt>
              <dd>{settings.tagline}</dd>
            </div>
            <div>
              <dt>Customer domain</dt>
              <dd>
                <code>mridulbymr.com</code>
              </dd>
            </div>
            <div>
              <dt>Admin domain</dt>
              <dd>
                <code>admin.mridulbymr.com</code>
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Contact" note="Used by the WhatsApp button and the footer.">
          <dl className="field-list">
            <div>
              <dt>WhatsApp</dt>
              <dd>{settings.contact.whatsapp}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{settings.contact.email}</dd>
            </div>
            <div>
              <dt>Instagram</dt>
              <dd>
                <code>{settings.contact.instagram}</code>
              </dd>
            </div>
            <div>
              <dt>YouTube</dt>
              <dd>
                <code>{settings.contact.youtube}</code>
              </dd>
            </div>
          </dl>
        </Panel>
      </div>

      <Panel
        title="Announcement bar"
        note="Cycles in the strip above the header. Desktop shows the first three; a phone rotates through all of them."
      >
        <table>
          <thead>
            <tr>
              <th className="numeric">#</th>
              <th>Message</th>
              <th>Shown on desktop</th>
            </tr>
          </thead>
          <tbody>
            {settings.announcements.map((message, index) => (
              <tr key={message}>
                <td className="numeric">{index + 1}</td>
                <td>{message}</td>
                <td>
                  <Pill tone={index < 3 ? 'ok' : 'muted'}>
                    {index < 3 ? 'Yes' : 'Mobile only'}
                  </Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Shipping" note="Interim rules until a courier is contracted.">
        <div className="prose">
          <p>
            Orders above{' '}
            <strong>{formatPaise(FREE_SHIPPING_THRESHOLD_PAISE)}</strong> ship free;
            everything below is quoted a flat{' '}
            <strong>{formatPaise(FALLBACK_SHIPPING_PAISE)}</strong>. This is a
            placeholder, and it is clearly labelled as an estimate wherever a
            customer sees it.
          </p>
          <p>
            Once a provider is chosen, real rates come from the destination pincode
            and this fallback is retired. Nothing in checkout needs to change,
            because nothing imports a provider directly.
          </p>
        </div>
      </Panel>

      <Panel
        title="WhatsApp templates"
        note="Business-initiated messages need pre-approved templates. These names must match the Meta console."
      >
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Template</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(TEMPLATES).map(([event, template]) => (
              <tr key={event}>
                <td>
                  <code>{event}</code>
                </td>
                <td>
                  <code>{template}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Integrations">
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Role</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {INTEGRATIONS.map((integration) => (
              <tr key={integration.name}>
                <td>
                  <strong>{integration.name}</strong>
                </td>
                <td>{integration.role}</td>
                <td>
                  <Pill tone={integration.status === 'pending' ? 'low' : 'muted'}>
                    {integration.status === 'pending' ? 'Not connected' : 'Undecided'}
                  </Pill>
                </td>
                <td className="cell-wrap">{integration.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel
        title="Policy pages"
        note="Listed in the footer as plain text rather than links, so nothing leads to a 404."
      >
        <ul className="tag-list">
          {settings.pendingPolicies.map((policy) => (
            <li key={policy}>
              <strong>{policy}</strong>
              <code>needs content</code>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
