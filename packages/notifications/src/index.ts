/**
 * Customer notification contract (WhatsApp Cloud API to begin with).
 *
 * Order code raises a typed event; it does not know or care which channel
 * delivers it. Adding email or SMS later means adding a channel, not editing
 * the order flow.
 *
 * WhatsApp requires pre-approved templates for business-initiated messages, so
 * an event maps to a template name plus its ordered variables rather than to
 * free text.
 */

export type NotificationEvent =
  | 'order_confirmed'
  | 'payment_successful'
  | 'order_packed'
  | 'order_shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'order_cancelled'
  | 'refund_processed';

export type Recipient = {
  /** E.164, e.g. +919876543210. */
  phone: string;
  name?: string;
};

export type NotificationPayload = {
  event: NotificationEvent;
  recipient: Recipient;
  /** Ordered template variables, already formatted for display. */
  variables: string[];
  /** Carried for audit and for de-duplicating retries. */
  orderId: string;
};

export interface NotificationChannel {
  readonly name: string;
  send(payload: NotificationPayload): Promise<{ messageId: string }>;
}

/** Approved template name per event. Keep in step with the Meta console. */
export const TEMPLATES: Record<NotificationEvent, string> = {
  order_confirmed: 'mridul_order_confirmed',
  payment_successful: 'mridul_payment_successful',
  order_packed: 'mridul_order_packed',
  order_shipped: 'mridul_order_shipped',
  out_for_delivery: 'mridul_out_for_delivery',
  delivered: 'mridul_delivered',
  order_cancelled: 'mridul_order_cancelled',
  refund_processed: 'mridul_refund_processed',
};

/**
 * Fans one event out to every configured channel.
 *
 * A failed notification must never fail the order it describes, so each send
 * is isolated and its error is returned for logging rather than thrown.
 */
export async function notify(
  channels: NotificationChannel[],
  payload: NotificationPayload,
): Promise<{ channel: string; messageId?: string; error?: string }[]> {
  return Promise.all(
    channels.map(async (channel) => {
      try {
        const { messageId } = await channel.send(payload);
        return { channel: channel.name, messageId };
      } catch (error) {
        return {
          channel: channel.name,
          error: error instanceof Error ? error.message : 'unknown error',
        };
      }
    }),
  );
}
