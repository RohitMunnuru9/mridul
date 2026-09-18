/**
 * Who can get into the shop, and the one mistake with no way back.
 *
 * Giving somebody a role is reversible. Removing the LAST owner is not: after
 * that nobody can grant the role again, because granting it requires being
 * one. Every catalogue edit, every order, every discount code ends up behind a
 * door whose only key has been posted through it, and the way out is the
 * Supabase SQL editor — which is not something a shop owner should have to be
 * told about at the worst possible moment.
 *
 * The database refuses this too (migration 0022, with a lock so two people
 * cannot each remove the other at the same instant). These tests cover the
 * half that stops the button being offered at all, so nobody discovers the
 * rule by pressing it.
 */

import { describe, expect, it } from 'vitest';
import {
  ADMIN_ROLES,
  canRevoke,
  grantableRoles,
  ROLE_LABEL,
  ROLE_MEANING,
  type AdminRole,
  type StaffMember,
} from '@mridul/database';

function member(userId: string, roles: AdminRole[]): StaffMember {
  return {
    userId,
    email: `${userId}@example.com`,
    fullName: null,
    roles,
    grantedAt: '2026-09-01T00:00:00Z',
    lastSignInAt: null,
  };
}

describe('canRevoke', () => {
  it('refuses to remove the only owner', () => {
    const staff = [member('a', ['super_admin']), member('b', ['order_manager'])];
    const result = canRevoke(staff, 'a', 'super_admin');
    expect(result.ok).toBe(false);
  });

  it('allows it once there is a second owner', () => {
    const staff = [member('a', ['super_admin']), member('b', ['super_admin'])];
    expect(canRevoke(staff, 'a', 'super_admin').ok).toBe(true);
    expect(canRevoke(staff, 'b', 'super_admin').ok).toBe(true);
  });

  it('never blocks any other role, even for the only owner', () => {
    // An owner who also manages orders can drop the orders role freely; it is
    // only the last key to the door that is protected.
    const staff = [member('a', ['super_admin', 'order_manager'])];
    expect(canRevoke(staff, 'a', 'order_manager').ok).toBe(true);
    expect(canRevoke(staff, 'a', 'support').ok).toBe(true);
  });

  it('does not block removing an owner role from somebody who has none', () => {
    const staff = [member('a', ['super_admin']), member('b', ['support'])];
    expect(canRevoke(staff, 'b', 'super_admin').ok).toBe(true);
  });

  it('gives a reason that says what to do, not just no', () => {
    const staff = [member('a', ['super_admin'])];
    const result = canRevoke(staff, 'a', 'super_admin');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.toLowerCase()).toContain('owner');
    }
  });

  it('is safe on an empty shop rather than throwing', () => {
    expect(canRevoke([], 'a', 'super_admin').ok).toBe(true);
  });
});

describe('grantableRoles', () => {
  it('offers only what somebody does not already have', () => {
    const offered = grantableRoles(member('a', ['super_admin', 'support']));
    expect(offered).not.toContain('super_admin');
    expect(offered).not.toContain('support');
    expect(offered).toContain('order_manager');
  });

  it('offers nothing to somebody who holds everything', () => {
    expect(grantableRoles(member('a', [...ADMIN_ROLES]))).toEqual([]);
  });

  it('offers all five to somebody with none', () => {
    expect(grantableRoles(member('a', []))).toHaveLength(ADMIN_ROLES.length);
  });
});

describe('role wording', () => {
  it('describes every role, so no dropdown entry is a bare enum', () => {
    for (const role of ADMIN_ROLES) {
      expect(ROLE_LABEL[role]).toBeTruthy();
      expect(ROLE_MEANING[role].length).toBeGreaterThan(20);
    }
  });

  it('warns about what owner access really means', () => {
    expect(ROLE_MEANING.super_admin.toLowerCase()).toContain('everything');
  });
});
