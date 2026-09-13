'use client';

/**
 * Contact and delivery details.
 *
 * Every field is controlled rather than left to the DOM. That is the whole
 * point of this component: a form action that fails must leave the address
 * exactly as it was typed. An uncontrolled form can be reset out from under
 * somebody by a re-render, and asking a customer to retype their address
 * because the server was slow is the fastest way to lose the order.
 */

import { useActionState, useState } from 'react';
import { CheckCircle2, MapPin, Phone, UserRound } from 'lucide-react';
import { saveDeliveryDetails, type DeliveryResult } from './actions';

type Defaults = {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
};

const INITIAL: DeliveryResult = { ok: false, message: '' };

export function DeliveryForm({ email, defaults }: { email: string; defaults: Defaults }) {
  const [form, setForm] = useState({
    ...defaults,
    phone: defaults.phone.replace(/^\+91/, ''),
  });
  const [state, action, pending] = useActionState(
    async (_previous: DeliveryResult, data: FormData) => saveDeliveryDetails(data),
    INITIAL,
  );

  const set = (field: keyof Defaults) => (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <form action={action} className="delivery-form">
      <section className="checkout-section">
        <div className="checkout-section-head">
          <span><UserRound aria-hidden="true" /></span>
          <div><small>Contact</small><h2>Who is receiving the order?</h2></div>
        </div>
        <div className="checkout-fields two-columns">
          <label><span>Full name *</span><input autoComplete="name" name="full_name" onChange={set('fullName')} required value={form.fullName} /></label>
          <label><span>Email for order updates</span><input disabled value={email} /></label>
          <label className="phone-field"><span>Mobile number *</span><div><strong>+91</strong><input autoComplete="tel" inputMode="numeric" maxLength={10} minLength={10} name="phone" onChange={set('phone')} pattern="[6-9][0-9]{9}" placeholder="9876543210" required value={form.phone} /></div><small>Order confirmation and delivery updates will be sent here.</small></label>
        </div>
      </section>

      <section className="checkout-section">
        <div className="checkout-section-head">
          <span><MapPin aria-hidden="true" /></span>
          <div><small>Delivery</small><h2>Complete address</h2></div>
        </div>
        <div className="checkout-fields">
          <label><span>House number, building and street *</span><input autoComplete="address-line1" minLength={5} name="line1" onChange={set('line1')} required value={form.line1} /></label>
          <label><span>Apartment, floor or area</span><input autoComplete="address-line2" name="line2" onChange={set('line2')} value={form.line2} /></label>
          <label><span>Landmark</span><input name="landmark" onChange={set('landmark')} value={form.landmark} /></label>
          <div className="two-columns">
            <label><span>City *</span><input autoComplete="address-level2" name="city" onChange={set('city')} required value={form.city} /></label>
            <label><span>State *</span><input autoComplete="address-level1" name="state" onChange={set('state')} required value={form.state} /></label>
          </div>
          <label className="pincode-field"><span>Pincode *</span><input autoComplete="postal-code" inputMode="numeric" maxLength={6} minLength={6} name="pincode" onChange={set('pincode')} pattern="[1-9][0-9]{5}" required value={form.pincode} /><small>Six digits; the first digit cannot be zero.</small></label>
        </div>
      </section>

      {state.message && <p className={`delivery-message ${state.ok ? 'is-ok' : 'is-bad'}`} role="status">{state.ok && <CheckCircle2 aria-hidden="true" />}{state.message}</p>}
      <button className="delivery-submit" disabled={pending} type="submit">{pending ? 'Saving…' : 'Save and continue'}</button>
      <p className="delivery-privacy"><Phone aria-hidden="true" /> We use these details only to fulfil your order and send delivery updates.</p>
    </form>
  );
}
