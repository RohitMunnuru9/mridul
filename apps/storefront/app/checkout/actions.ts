'use server';

import { revalidatePath } from 'next/cache';
import { sessionClient } from '@mridul/supabase/server';

export type DeliveryResult = { ok: boolean; message: string };

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

function indianPhone(value: string): string | null {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (!/^[6-9][0-9]{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

export async function saveDeliveryDetails(formData: FormData): Promise<DeliveryResult> {
  const db = await sessionClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, message: 'Your session expired. Please sign in again.' };

  const fullName = text(formData, 'full_name');
  const phone = indianPhone(text(formData, 'phone'));
  const line1 = text(formData, 'line1');
  const line2 = text(formData, 'line2');
  const landmark = text(formData, 'landmark');
  const city = text(formData, 'city');
  const state = text(formData, 'state');
  const pincode = text(formData, 'pincode').replace(/\s/g, '');

  if (fullName.length < 2) return { ok: false, message: 'Enter the recipient’s full name.' };
  if (!phone) return { ok: false, message: 'Enter a valid 10-digit Indian mobile number.' };
  if (line1.length < 5) return { ok: false, message: 'Enter the house number and street address.' };
  if (!city || !state) return { ok: false, message: 'Enter the city and state.' };
  if (!/^[1-9][0-9]{5}$/.test(pincode)) return { ok: false, message: 'Enter a valid 6-digit Indian pincode.' };

  const { error: profileError } = await db
    .from('profiles')
    .update({ full_name: fullName, phone })
    .eq('id', user.id);
  if (profileError) return { ok: false, message: profileError.message };

  const address = {
    full_name: fullName,
    phone,
    line1,
    line2: line2 || null,
    landmark: landmark || null,
    city,
    state,
    pincode,
    country: 'IN' as const,
    is_default: true,
  };

  const { data: existing, error: lookupError } = await db
    .from('addresses')
    .select('id')
    .eq('customer_id', user.id)
    .eq('is_default', true)
    .maybeSingle();
  if (lookupError) return { ok: false, message: lookupError.message };

  const result = existing
    ? await db.from('addresses').update(address).eq('id', existing.id)
    : await db.from('addresses').insert({ ...address, customer_id: user.id });
  if (result.error) return { ok: false, message: result.error.message };

  revalidatePath('/checkout');
  revalidatePath('/account');
  return { ok: true, message: 'Delivery details saved. You are ready for payment.' };
}

