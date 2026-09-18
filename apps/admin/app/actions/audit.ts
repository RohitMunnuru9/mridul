'use server';

/**
 * Writing to the audit log.
 *
 * Called after a write has already succeeded, never before. An entry saying a
 * price changed when it did not is worse than no entry: it makes the log
 * something to argue with rather than something to check.
 *
 * ---------------------------------------------------------------------------
 * Why a failed log does not fail the action
 *
 * This swallows its own errors on purpose, and that is a real trade rather
 * than laziness.
 *
 * The strict choice — fail the action if it cannot be logged — is right for a
 * bank, where an unlogged change is worse than no change. It is wrong here. It
 * would mean that the day something goes wrong with the log, the shop cannot
 * dispatch a parcel, correct a stock count or stop a discount code that is
 * being abused. A saree shop losing a day of trading to protect a record of
 * that trading has the trade backwards.
 *
 * So a failure is written to the server log and the shop carries on. What that
 * costs is the honest part: the audit trail can have gaps, and it should not
 * be relied on to PROVE that something did not happen. It is a record of what
 * was done, not evidence of what was not.
 *
 * `actor_id` and `actor_email` are not passed from here. The database reads
 * them from the session, so nothing in this file can attribute an action to
 * somebody else.
 */

import type { Json } from '@mridul/types';
import { sessionClient } from '@mridul/supabase/server';

/** Anything that survives a round trip through jsonb, and nothing that does
 *  not — a Date or an undefined silently becomes something else in a column
 *  that is supposed to be the record. */
export type AuditDetail = { [key: string]: Json } | null;

export async function audit(
  action: string,
  entity: string,
  entityId?: string | null,
  before?: AuditDetail,
  after?: AuditDetail,
): Promise<void> {
  try {
    const db = await sessionClient();
    const { error } = await db.rpc('record_admin_action', {
      p_action: action,
      p_entity: entity,
      p_entity_id: entityId ?? null,
      p_before: before ?? null,
      p_after: after ?? null,
    });
    if (error) {
      // PGRST202 simply means migration 0023 has not been applied yet, which
      // is not worth a stack trace on every admin action.
      if (error.code !== 'PGRST202') {
        console.error('[audit] could not record', action, entity, error.message);
      }
    }
  } catch (cause) {
    console.error('[audit] could not record', action, entity, cause);
  }
}
