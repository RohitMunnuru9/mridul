/**
 * What has been done in the shop, and by whom.
 *
 * `admin_audit_logs` has existed since 0007 and was empty until now, because
 * nothing could write to it. It records the changes worth being able to look
 * back at: money, access, stock and fulfilment.
 *
 * Owners only, which is the policy in 0007 rather than a choice made here.
 *
 * Two honest limits, said on the page as well as here. The log starts from the
 * day this was switched on — there is nothing before it and never will be. And
 * a failed write does not fail the action that caused it, so this records what
 * was done and is not proof of what was not.
 */

import type { Metadata } from 'next';
import { History } from 'lucide-react';
import { actionLabel, describeChanges, NOTABLE_ACTIONS } from '@mridul/database';
import { can, currentAdmin, sessionClient } from '@mridul/supabase/server';
import { formatDateTime } from '@mridul/utils';
import { PageHead, Panel, Pill } from '../../components/ui';

export const metadata: Metadata = { title: 'Activity | Mridul Admin' };

type Entry = {
  id: string;
  actor_email: string;
  action: string;
  entity: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
};

export default async function ActivityPage() {
  const admin = await currentAdmin();

  if (!can(admin)) {
    return (
      <>
        <PageHead title="Activity" />
        <div className="awaiting">
          <h2>Only the shop owner can see this</h2>
          <p>The record of who changed what is the owner&apos;s to read.</p>
        </div>
      </>
    );
  }

  const db = await sessionClient();
  const { data, error } = await db.rpc('admin_audit_trail', { p_limit: 100 });

  // PGRST202 means migration 0023 has not been applied. That is a setup step,
  // not a fault, and saying so beats an error page.
  const notSetUp = error?.code === 'PGRST202';
  const entries = (data ?? []) as unknown as Entry[];

  return (
    <>
      <PageHead
        title="Activity"
        subtitle="Changes to money, access, stock and orders — who made them, and when."
      />

      {notSetUp ? (
        <div className="awaiting">
          <h2>Not switched on yet</h2>
          <p>
            The activity record needs migration 0023 to be run on the database.
            Until then nothing is being written down.
          </p>
        </div>
      ) : error ? (
        <div className="awaiting">
          <h2>The activity record could not be read</h2>
          <p>{error.message}</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="awaiting">
          <h2>Nothing recorded yet</h2>
          <p>
            Changes to discount codes, access, stock and orders will appear here
            as they happen. Nothing before today is recorded — the log starts
            when it was switched on.
          </p>
        </div>
      ) : (
        <Panel
          title="Recent changes"
          note={`${entries.length} most recent, newest first.`}
        >
          <ul className="activity-list">
            {entries.map((entry) => {
              const detail = describeChanges(entry.before, entry.after);
              return (
                <li key={entry.id}>
                  <div className="activity-head">
                    <strong>{actionLabel(entry.action)}</strong>
                    {NOTABLE_ACTIONS.has(entry.action) && <Pill tone="low">Worth noticing</Pill>}
                  </div>
                  <p className="activity-who">
                    {entry.actor_email} · {formatDateTime(entry.created_at)}
                  </p>
                  {entry.entity_id && (
                    <p className="activity-what">
                      <code>{entry.entity_id}</code>
                    </p>
                  )}
                  {detail.length > 0 && (
                    <ul className="activity-changes">
                      {detail.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <p className="panel-note">
        <History aria-hidden="true" /> This records what was done. It is not
        proof of what was not: if writing an entry ever fails, the change still
        goes through rather than the shop stopping, so there can be gaps.
      </p>
    </>
  );
}
