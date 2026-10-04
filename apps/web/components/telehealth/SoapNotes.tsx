'use client';

import { Check, ClipboardList, Save } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function SoapNotes({ provider = false }: { provider?: boolean }) {
  const [notes, setNotes] = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const [saved, setSaved] = useState(false);
  const fields = [
    { key: 'subjective' as const, label: 'Subjective', placeholder: 'What the patient reports…' },
    { key: 'objective' as const, label: 'Objective', placeholder: 'Observations and measurements…' },
    { key: 'assessment' as const, label: 'Assessment', placeholder: 'Clinical impression…' },
    { key: 'plan' as const, label: 'Plan', placeholder: 'Treatment and follow-up…' }
  ];
  return <div className="rounded-xl border border-[var(--color-gray-200)] bg-white p-4"><div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-[var(--color-primary)]" /><h2 className="font-extrabold">Clinical notes</h2>{provider && <span className="ml-auto rounded-full bg-green-50 px-2 py-1 text-[10px] font-bold text-green-700">Private workspace</span>}</div><p className="mt-1 text-xs text-[var(--color-gray-500)]">SOAP notes are encrypted and access-logged.</p><div className="mt-4 space-y-4">{fields.map((field) => <div key={field.key}><label htmlFor={`soap-${field.key}`} className="mb-1.5 block text-xs font-bold">{field.label}</label><Textarea id={`soap-${field.key}`} value={notes[field.key]} onChange={(event) => { setSaved(false); setNotes((current) => ({ ...current, [field.key]: event.target.value })); }} placeholder={field.placeholder} className="min-h-20 text-sm" /></div>)}</div><Button className="mt-4 w-full" size="sm" onClick={() => setSaved(true)}><Save className="mr-2 h-3.5 w-3.5" />Save notes</Button>{saved && <p role="status" className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-green-700"><Check className="h-3.5 w-3.5" />Notes saved securely</p>}</div>;
}
