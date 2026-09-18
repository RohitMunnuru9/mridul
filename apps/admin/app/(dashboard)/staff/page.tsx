/**
 * Who can get into the shop.
 *
 * Until now the only way to give somebody access was an INSERT written by hand
 * in the Supabase SQL editor — which meant the shop could not see who already
 * had it either. There is currently a second owner account that nobody would
 * find out about from the admin.
 *
 * Only an owner can open this. Not because the list is dangerous to read, but
 * because who holds the keys is not an order manager's business, and 0001
 * already decides that: `admin_roles_select_super`.
 */

import type { Metadata } from 'next';
import { KeyRound, ShieldAlert } from 'lucide-react';
import {
  ADMIN_ROLES,
  canRevoke,
  fetchStaff,
  grantableRoles,
  ROLE_LABEL,
  ROLE_MEANING,
} from '@mridul/database';
import { can, currentAdmin, sessionClient } from '@mridul/supabase/server';
import { formatDateTime } from '@mridul/utils';
import { grantRole, revokeRole } from '../../actions/staff';
import { EditForm, Field, Select } from '../../components/form';
import { PageHead, Panel, Pill } from '../../components/ui';

export const metadata: Metadata = { title: 'Who has access | Mridul Admin' };

export default async function StaffPage() {
  const admin = await currentAdmin();

  if (!can(admin)) {
    return (
      <>
        <PageHead title="Who has access" />
        <div className="awaiting">
          <h2>Only the shop owner can see this</h2>
          <p>
            Who holds the keys to the shop is the owner&apos;s business. Ask
            them if you need access to something.
          </p>
        </div>
      </>
    );
  }

  const db = await sessionClient();
  const staff = await fetchStaff(db);
  const owners = staff.filter((member) => member.roles.includes('super_admin'));

  return (
    <>
      <PageHead
        title="Who has access"
        subtitle={`${staff.length} ${staff.length === 1 ? 'person' : 'people'} · ${owners.length} with full owner access`}
      />

      {owners.length > 1 && (
        <p className="admin-safe-note">
          <KeyRound aria-hidden="true" />
          <span>
            {owners.length} accounts have <strong>full owner access</strong>:
            everything, including prices, discount codes and this page. Worth
            checking that is all of them and only them.
          </span>
        </p>
      )}

      {staff.map((member) => {
        const unknown = member.email === null;
        return (
          <Panel
            key={member.userId}
            title={member.email ?? 'Account could not be read'}
            note={
              member.fullName
                ? `${member.fullName} · let in ${formatDateTime(member.grantedAt)}`
                : `Let in ${formatDateTime(member.grantedAt)}`
            }
          >
            {unknown && (
              <p className="panel-note is-warning">
                <ShieldAlert aria-hidden="true" />
                <strong>This role belongs to an account that no longer reads back.</strong>
                It still grants access. Remove it unless you know whose it is.
              </p>
            )}

            <ul className="order-facts">
              <li>
                {member.roles.map((role) => (
                  <Pill key={role} tone={role === 'super_admin' ? 'low' : 'ok'}>
                    {ROLE_LABEL[role]}
                  </Pill>
                ))}
              </li>
              <li>
                Last signed in{' '}
                {member.lastSignInAt ? formatDateTime(member.lastSignInAt) : 'never'}
              </li>
            </ul>

            {/* One row per role held, because taking away "Orders" and taking
                away "Owner" are different decisions and should not share a
                button. */}
            {member.roles.map((role) => {
              const allowed = canRevoke(staff, member.userId, role);
              return (
                <div className="staff-role-row" key={role}>
                  <span>
                    <strong>{ROLE_LABEL[role]}</strong>
                    <small>{ROLE_MEANING[role]}</small>
                  </span>
                  {allowed.ok ? (
                    <EditForm action={revokeRole} submitLabel="Remove" compact danger>
                      <input name="user_id" type="hidden" value={member.userId} />
                      <input name="role" type="hidden" value={role} />
                    </EditForm>
                  ) : (
                    <small className="staff-role-locked">{allowed.reason}</small>
                  )}
                </div>
              );
            })}

            {grantableRoles(member).length > 0 && (
              <EditForm action={grantRole} submitLabel="Add this too" compact>
                <input name="email" type="hidden" value={member.email ?? ''} />
                <Select
                  label="Give them something else"
                  name="role"
                  options={grantableRoles(member).map((role) => ({
                    value: role,
                    label: `${ROLE_LABEL[role]} — ${ROLE_MEANING[role]}`,
                  }))}
                />
              </EditForm>
            )}
          </Panel>
        );
      })}

      <Panel
        title="Give somebody access"
        note="They need to have signed in to the shop at least once first, with their own email."
      >
        <EditForm action={grantRole} submitLabel="Give access">
          <Field
            hint="The address they sign in with."
            label="Email"
            name="email"
            placeholder="someone@example.com"
            required
            type="email"
          />
          <Select
            label="What they can do"
            name="role"
            options={ADMIN_ROLES.map((role) => ({
              value: role,
              label: `${ROLE_LABEL[role]} — ${ROLE_MEANING[role]}`,
            }))}
          />
        </EditForm>
        <p className="panel-note">
          This cannot make an account. Ask them to sign in to the shop once and
          then add them here, so the password stays theirs rather than one
          passed around.
        </p>
      </Panel>
    </>
  );
}
