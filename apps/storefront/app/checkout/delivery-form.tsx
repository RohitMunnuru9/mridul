'use client';

import { useActionState } from 'react';
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
  const [state, action, pending] = useActionState(
    async (_previous: DeliveryResult, data: FormData) => saveDeliveryDetails(data),
    INITIAL,
  );

  return (
    <form action={action} className="delivery-form">
      <section className="checkout-section">
        <div className="checkout-section-head">
          <span><UserRound aria-hidden="true" /></span>
          <div><small>Contact</small><h2>Who is receiving the order?</h2></div>
        </div>
        <div className="checkout-fields two-columns">
          <label><span>Full name *</span><input autoComplete="name" defaultValue={defaults.fullName} name="full_name" required /></label>
          <label><span>Email for order updates</span><input disabled value={email} /></label>
          <label className="phone-field"><span>Mobile number *</span><div><strong>+91</strong><input autoComplete="tel" defaultValue={defaults.phone.replace(/^\+91/, '')} inputMode="numeric" maxLength={10} minLength={10} name="phone" pattern="[6-9][0-9]{9}" placeholder="9876543210" required /></div><small>Order confirmation and delivery updates will be sent here.</small></label>
        </div>
      </section>

      <section className="checkout-section">
        <div className="checkout-section-head">
          <span><MapPin aria-hidden="true" /></span>
          <div><small>Delivery</small><h2>Complete address</h2></div>
        </div>
        <div className="checkout-fields">
          <label><span>House number, building and street *</span><input autoComplete="address-line1" defaultValue={defaults.line1} name="line1" required /></label>
          <label><span>Apartment, floor or area</span><input autoComplete="address-line2" defaultValue={defaults.line2} name="line2" /></label>
          <label><span>Landmark</span><input defaultValue={defaults.landmark} name="landmark" /></label>
          <div className="two-columns">
            <label><span>City *</span><input autoComplete="address-level2" defaultValue={defaults.city} name="city" required /></label>
            <label><span>State *</span><input autoComplete="address-level1" defaultValue={defaults.state} name="state" required /></label>
          </div>
          <label className="pincode-field"><span>Pincode *</span><input autoComplete="postal-code" defaultValue={defaults.pincode} inputMode="numeric" maxLength={6} minLength={6} name="pincode" pattern="[1-9][0-9]{5}" required /><small>Six digits; the first digit cannot be zero.</small></label>
        </div>
      </section>

      {state.message && <p className={`delivery-message ${state.ok ? 'is-ok' : 'is-bad'}`} role="status">{state.ok && <CheckCircle2 aria-hidden="true" />}{state.message}</p>}
      <button className="delivery-submit" disabled={pending} type="submit">{pending ? 'Saving…' : 'Save and continue to payment'}</button>
      <p className="delivery-privacy"><Phone aria-hidden="true" /> We use these details only to fulfil your order and send delivery updates.</p>
    </form>
  );
}

