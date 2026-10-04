'use client';

import { Camera, CheckCircle2, LockKeyhole, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function ProofOfDelivery() {
  const [photo, setPhoto] = useState(false);
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState(false);
  return <Card><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]"><LockKeyhole className="h-5 w-5" /></span><div><h2 className="font-extrabold">Proof of delivery</h2><p className="text-xs text-[var(--color-gray-500)]">Available after delivery</p></div></div>{verified ? <div className="mt-5 flex items-center gap-3 rounded-lg bg-green-50 p-4 text-sm font-semibold text-green-700"><CheckCircle2 className="h-5 w-5" />Delivery confirmed and securely recorded.</div> : <div className="mt-5 space-y-4"><label className={`flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center ${photo ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-[var(--color-gray-300)]'}`}><input type="file" accept="image/*" className="sr-only" onChange={() => setPhoto(true)} />{photo ? <><CheckCircle2 className="h-6 w-6 text-[var(--color-primary-dark)]" /><span className="mt-2 text-xs font-bold">Photo attached</span></> : <><Camera className="h-6 w-6 text-[var(--color-gray-500)]" /><span className="mt-2 text-xs font-bold">Attach delivery photo</span><span className="mt-1 text-[11px] text-[var(--color-gray-500)]">Taken by the rider at handover</span></>}</label><div><label htmlFor="delivery-code" className="mb-2 block text-sm font-bold">Patient delivery code</label><Input id="delivery-code" inputMode="numeric" maxLength={4} placeholder="Enter 4-digit code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 4))} /></div><Button className="w-full" disabled={!photo || code.length !== 4} onClick={() => setVerified(true)}><UploadCloud className="h-4 w-4" />Submit proof of delivery</Button></div>}</Card>;
}
