/**
 * Discount codes.
 *
 * The bag page has asked every customer for a discount code since the shop
 * opened, and until now there was no way to make one — or, more to the point,
 * to see the ones that already existed or switch them off. Three codes have
 * been live on the site this whole time.
 *
 * Reading is open to an order manager or support; writing is the owner's
 * alone, decided by the policy in 0005 rather than by this page. The page only
 * hides the controls somebody cannot use.
 *
 * Nothing here decides what a customer is charged. A coupon row is a rule;
 * `validate_coupon` applies it to the server's own subtotal at checkout, and
 * `place_order` applies it again before the total is written.
 */

import type { Metadata } from 'next';
import { TicketPercent } from 'lucide-react';
import { couponState, couponValue, fetchCoupons, type Coupon } from '@mridul/database';
import { can, currentAdmin, sessionClient } from '@mridul/supabase/server';
import { formatDateTime, formatPaise } from '@mridul/utils';
import { createCoupon, setCouponActive, updateCoupon } from '../../actions/coupons';
import { EditForm, Field, FieldRow, Select, TextArea, Toggle } from '../../components/form';
import { PageHead, Panel, Pill } from '../../components/ui';

export const metadata: Metadata = { title: 'Discount codes | Mridul Admin' };

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` and nothing else. */
function forInput(iso: string | null): string {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(
    at.getHours(),
  )}:${pad(at.getMinutes())}`;
}

/** The fields shared by making a code and changing one. */
function CouponFields({ coupon }: { coupon?: Coupon }) {
  return (
    <>
      <FieldRow>
        <Field
          defaultValue={coupon?.code ?? ''}
          hint="Letters and numbers. Customers type this, so keep it short."
          label="Code"
          name="code"
          placeholder="FESTIVE500"
          required
        />
        <Select
          defaultValue={coupon?.percentOff !== null && coupon !== undefined ? 'percent' : 'amount'}
          label="Kind of discount"
          name="kind"
          options={[
            { value: 'percent', label: 'A percentage off' },
            { value: 'amount', label: 'An amount off' },
          ]}
        />
      </FieldRow>

      {/* Both are shown, and the kind above decides which one is read. A field
          that appears and disappears as you choose needs JavaScript to be
          right, and gets this form wrong when it is not. */}
      <FieldRow>
        <Field
          defaultValue={coupon?.percentOff ?? ''}
          hint="1 to 100. Used when the kind is a percentage."
          label="Percentage off"
          name="percent_off"
          type="number"
        />
        <Field
          defaultValue={
            coupon?.amountOffPaise !== null && coupon?.amountOffPaise !== undefined
              ? coupon.amountOffPaise / 100
              : ''
          }
          hint="In rupees. Used when the kind is an amount."
          label="Amount off"
          name="amount_off"
        />
      </FieldRow>

      <FieldRow>
        <Field
          defaultValue={coupon ? coupon.minSubtotalPaise / 100 : ''}
          hint="In rupees. Blank means any order."
          label="Minimum spend"
          name="min_subtotal"
        />
        <Field
          defaultValue={coupon?.maxRedemptions ?? ''}
          hint="Blank means unlimited."
          label="How many times it can be used"
          name="max_redemptions"
          type="number"
        />
      </FieldRow>

      <FieldRow>
        <Field
          defaultValue={forInput(coupon?.startsAt ?? null)}
          hint="Blank means straight away."
          label="Starts"
          name="starts_at"
          type="datetime-local"
        />
        <Field
          defaultValue={forInput(coupon?.endsAt ?? null)}
          hint="Blank means it never expires."
          label="Ends"
          name="ends_at"
          type="datetime-local"
        />
      </FieldRow>

      <TextArea
        defaultValue={coupon?.description ?? ''}
        hint="For you, not the customer. Why this code exists."
        label="Note"
        name="description"
        rows={2}
      />

      <Toggle
        defaultChecked={coupon?.isActive ?? true}
        hint="Switched off, the code stops working immediately."
        label="Working"
        name="is_active"
      />
    </>
  );
}

export default async function CouponsPage() {
  const db = await sessionClient();
  const [coupons, admin] = await Promise.all([fetchCoupons(db), currentAdmin()]);

  // Only the owner may write, and 0005 is what enforces it. This just decides
  // whether to put controls in front of somebody who would be refused.
  const canEdit = can(admin);

  const live = coupons.filter((coupon) => couponState(coupon).live).length;
  const redeemed = coupons.reduce((total, coupon) => total + coupon.redemptionCount, 0);

  return (
    <>
      <PageHead
        title="Discount codes"
        subtitle={`${live} working right now · ${coupons.length} in total · used ${redeemed} times`}
      />

      {live > 0 && (
        <p className="admin-safe-note">
          <TicketPercent aria-hidden="true" />
          <span>
            {live === 1 ? 'One code works' : `${live} codes work`} on the website
            right now. Anyone who knows the words can use{' '}
            {live === 1 ? 'it' : 'them'} at checkout.
          </span>
        </p>
      )}

      {coupons.length === 0 ? (
        <div className="awaiting">
          <h2>No discount codes yet</h2>
          <p>
            The bag page asks every customer for a code. Make one below and it
            starts working straight away.
          </p>
        </div>
      ) : (
        coupons.map((coupon) => {
          const state = couponState(coupon);
          const used = coupon.maxRedemptions
            ? `${coupon.redemptionCount} of ${coupon.maxRedemptions} used`
            : `used ${coupon.redemptionCount} times`;

          return (
            <Panel
              key={coupon.id}
              title={coupon.code}
              note={`${couponValue(coupon)}${
                coupon.minSubtotalPaise > 0
                  ? ` on orders over ${formatPaise(coupon.minSubtotalPaise)}`
                  : ' on any order'
              } · ${used}`}
            >
              <ul className="order-facts">
                <li>
                  <Pill tone={state.live ? 'ok' : 'out'}>
                    {state.live ? 'Working' : state.reason}
                  </Pill>
                </li>
                {coupon.startsAt && <li>Starts {formatDateTime(coupon.startsAt)}</li>}
                {coupon.endsAt && <li>Ends {formatDateTime(coupon.endsAt)}</li>}
                {coupon.description && <li>{coupon.description}</li>}
              </ul>

              {canEdit ? (
                <>
                  {/* The thing most likely to be wanted in a hurry, on its own,
                      so stopping a code does not mean filling in a form. */}
                  <EditForm
                    action={setCouponActive}
                    submitLabel={coupon.isActive ? 'Stop this code' : 'Start it again'}
                    compact
                    danger={coupon.isActive}
                  >
                    <input name="id" type="hidden" value={coupon.id} />
                    <input name="active" type="hidden" value={String(!coupon.isActive)} />
                  </EditForm>

                  <EditForm action={updateCoupon} submitLabel="Save changes">
                    <input name="id" type="hidden" value={coupon.id} />
                    <CouponFields coupon={coupon} />
                  </EditForm>
                </>
              ) : (
                <p className="panel-note">
                  You can see the codes but only the shop owner can change them.
                </p>
              )}
            </Panel>
          );
        })
      )}

      {canEdit && (
        <Panel
          title="Make a new code"
          note="It starts working as soon as you save it, unless you give it a start date."
        >
          <EditForm action={createCoupon} submitLabel="Create the code">
            <CouponFields />
          </EditForm>
        </Panel>
      )}
    </>
  );
}
