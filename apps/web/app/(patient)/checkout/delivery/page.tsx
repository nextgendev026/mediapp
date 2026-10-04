'use client';

import { ArrowRight, MapPin, Phone, Save } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DeliverySelector, type DeliveryMethod } from '@/components/checkout/DeliverySelector';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCart } from '@/components/shared/AppProviders';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getDeliveryFee, KENYA_COUNTIES } from '@/lib/utils/counties';
import { isValidKenyanPhone, normalizeKenyanPhone } from '@/lib/utils/validate-phone';

export default function DeliveryCheckoutPage() {
  const router = useRouter();
  const { items, subtotal } = useCart();
  const [method, setMethod] = useState<DeliveryMethod>('boda');
  const [phone, setPhone] = useState('0712345678');
  const [county, setCounty] = useState('Nairobi');
  const [landmark, setLandmark] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const fee = getDeliveryFee(county) + (method === 'boda' ? 0 : method === 'pickup' ? -150 : -200);
  function continueToPayment() {
    if (!isValidKenyanPhone(phone)) { setError('Enter a valid Kenyan phone number.'); return; }
    if (landmark.trim().length < 3) { setError('Add a nearby landmark so your rider can find you.'); return; }
    window.localStorage.setItem('afya-delivery', JSON.stringify({ phone: normalizeKenyanPhone(phone), county, landmark, notes, method, fee: Math.max(0, fee) }));
    router.push('/checkout/payment');
  }
  return <div><PageHeader eyebrow="Step 1 of 2" title="Delivery details" description="We use a phone number and landmark instead of a street address." backHref="/checkout" /><div className="grid gap-6 lg:grid-cols-[1fr_0.38fr]"><div className="space-y-6"><Card><div className="flex items-center gap-2"><Phone className="h-5 w-5 text-[var(--color-primary)]" /><h2 className="font-extrabold">How can we reach you?</h2></div><div className="mt-5 grid gap-5 sm:grid-cols-2"><div><label htmlFor="delivery-phone" className="mb-2 block text-sm font-bold">Phone number</label><Input id="delivery-phone" type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></div><div><label htmlFor="delivery-county" className="mb-2 block text-sm font-bold">County</label><Select id="delivery-county" value={county} onChange={(event) => setCounty(event.target.value)}>{KENYA_COUNTIES.map((item) => <option key={item}>{item}</option>)}</Select></div></div><p className="mt-2 text-xs text-[var(--color-gray-500)]">We only use this number for delivery coordination and order updates.</p></Card><Card><div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-[var(--color-accent)]" /><h2 className="font-extrabold">Nearby landmark</h2></div><div className="mt-5"><label htmlFor="delivery-landmark" className="mb-2 block text-sm font-bold">Tell your rider where to find you</label><Textarea id="delivery-landmark" value={landmark} onChange={(event) => setLandmark(event.target.value)} placeholder="e.g. Near Equity Bank, Kasarani, opposite the blue water tank" /><p className="mt-2 text-xs text-[var(--color-gray-500)]">Avoid sharing a full national ID or sensitive medical information.</p></div><div className="mt-5"><label htmlFor="delivery-notes" className="mb-2 block text-sm font-bold">Extra delivery notes <span className="font-normal text-[var(--color-gray-500)]">(optional)</span></label><Textarea id="delivery-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. Gate colour, best contact time" className="min-h-20" /></div><button type="button" className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs font-bold text-[var(--color-secondary)]"><Save className="h-3.5 w-3.5" />Save this address for next time</button></Card><Card><div className="mb-4 flex items-center gap-2"><TruckIcon /><h2 className="font-extrabold">Delivery method</h2></div><DeliverySelector value={method} onChange={setMethod} county={county} /></Card></div><div className="space-y-4"><OrderSummary deliveryFee={Math.max(0, fee)} actionHref={undefined} /><Card><p className="text-xs leading-5 text-[var(--color-gray-500)]"><strong className="text-[var(--color-gray-900)]">Estimated total: </strong> includes delivery for {county}. Final ETA is confirmed after payment.</p><Button className="mt-4 w-full" onClick={continueToPayment} disabled={!items.length}>Continue to payment<ArrowRight className="ml-2 h-4 w-4" /></Button>{error && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p>}</Card></div></div></div>;
}

function TruckIcon() { return <span className="text-xl" aria-hidden="true">🛵</span>; }
