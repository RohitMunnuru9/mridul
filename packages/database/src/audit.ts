/**
 * Reading the audit trail.
 *
 * The entries themselves are written by `record_admin_action`, which takes the
 * actor from the session rather than from the caller. What is here is the part
 * that turns a stored row into something a person can read.
 */

export type AuditEntry = {
  id: string;
  actorEmail: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

/** `entity.verb` is how the code names an action; this is how a person would. */
export const ACTION_LABEL: Record<string, string> = {
  'coupon.create': 'Made a discount code',
  'coupon.update': 'Changed a discount code',
  'coupon.start': 'Started a discount code',
  'coupon.stop': 'Stopped a discount code',
  'access.grant': 'Gave somebody access',
  'access.revoke': 'Took away access',
  'order.status': 'Moved an order on',
  'order.dispatch': 'Dispatched an order',
  'order.delivered': 'Marked an order delivered',
  'stock.set': 'Changed stock',
};

/** Money and access are what somebody comes to this page looking for. */
export const NOTABLE_ACTIONS = new Set([
  'access.grant',
  'access.revoke',
  'coupon.create',
  'coupon.update',
]);

export function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

/**
 * The before and after as sentences, and ONLY the keys that actually moved.
 *
 * An entry that lists nine unchanged fields beside the one that changed buries
 * the thing somebody came to find. Comparing by JSON rather than by identity
 * so that a value which was rewritten to the same thing does not count as a
 * change.
 */
export function describeChanges(before: unknown, after: unknown): string[] {
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

  const from = isRecord(before) ? before : {};
  const to = isRecord(after) ? after : {};
  const keys = [...new Set([...Object.keys(from), ...Object.keys(to)])];

  const show = (value: unknown): string => {
    if (value === null || value === undefined) return 'nothing';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return keys
    .filter((key) => JSON.stringify(from[key]) !== JSON.stringify(to[key]))
    .map((key) => {
      const label = key.replace(/_/g, ' ');
      if (!(key in from)) return `${label}: ${show(to[key])}`;
      if (!(key in to)) return `${label}: was ${show(from[key])}`;
      return `${label}: ${show(from[key])} → ${show(to[key])}`;
    });
}
