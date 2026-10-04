'use client';

import { FileImage, LoaderCircle, ScanText, UploadCloud, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export function PrescriptionUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [medication, setMedication] = useState('');
  const [scanning, setScanning] = useState(false);
  const [complete, setComplete] = useState(false);

  function selectFile(next: File | null) {
    setFile(next);
    setComplete(false);
    if (next) {
      setScanning(true);
      window.setTimeout(() => { setScanning(false); setMedication('Amoxicillin 500mg'); }, 900);
    }
  }

  return <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]"><Card><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><UploadCloud className="h-5 w-5" /></span><div><h2 className="font-extrabold">Upload a prescription</h2><p className="text-xs text-[var(--color-gray-500)]">A clear photo works best</p></div></div><label className={`mt-5 flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition ${file ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-[var(--color-gray-300)] bg-[var(--color-gray-50)] hover:border-[var(--color-primary)]'}`}><input type="file" accept="image/*,.pdf" className="sr-only" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} />{file ? <><span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[var(--color-primary-dark)]"><FileImage className="h-6 w-6" /></span><span className="mt-3 text-sm font-bold">{file.name}</span><span className="mt-1 text-xs text-[var(--color-gray-500)]">Tap to replace</span></> : <><span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[var(--color-secondary)] shadow-sm"><UploadCloud className="h-6 w-6" /></span><span className="mt-3 text-sm font-bold">Drop a photo here or browse</span><span className="mt-1 text-xs text-[var(--color-gray-500)]">JPG, PNG, or PDF · Max 10MB</span></>}</label><div className="mt-4 flex items-start gap-2 text-xs text-[var(--color-gray-500)]"><ScanText className="mt-0.5 h-4 w-4 text-[var(--color-primary)]" />We use secure text extraction to suggest medication details. Always check them before sending.</div></Card><Card><div className="flex items-center justify-between"><div><h2 className="font-extrabold">Review details</h2><p className="mt-1 text-xs text-[var(--color-gray-500)]">Correct anything the scan found</p></div>{scanning && <LoaderCircle className="h-5 w-5 animate-spin text-[var(--color-primary)]" />}</div><div className="mt-5 space-y-4"><div><label htmlFor="medication-name" className="mb-2 block text-sm font-bold">Medication name</label><Input id="medication-name" value={medication} onChange={(event) => setMedication(event.target.value)} placeholder="Search or type a medicine" /></div><div><label htmlFor="medication-notes" className="mb-2 block text-sm font-bold">Prescription notes</label><Textarea id="medication-notes" placeholder="Dosage, duration, or anything your pharmacist should know" /></div><div className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">Only a licensed pharmacist can approve a prescription. A clinician may contact you if more information is needed.</div><Button className="w-full" onClick={() => setComplete(true)} disabled={!medication || scanning}>{complete ? 'Sent for pharmacist review' : 'Send for pharmacist review'}</Button>{complete && <p role="status" className="text-center text-sm font-semibold text-green-700">Your prescription is in the secure review queue.</p>}</div></Card></div>;
}
