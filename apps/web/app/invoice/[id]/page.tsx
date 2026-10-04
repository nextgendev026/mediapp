import { notFound, redirect } from 'next/navigation';
import { Phone, Printer } from 'lucide-react';
import { PrintButton } from '@/components/billing/PrintButton';
import { requireRole } from '@/lib/server/guard';
import { getInvoice } from '@/lib/server/billing';
import { getDb } from '@/lib/server/store';
import { formatKES } from '@/lib/utils/format-currency';

export const dynamic = 'force-dynamic';

export default async function InvoicePage({ params }: { params: { id: string } }) {
  const guard = await requireRole(['admin', 'patient', 'provider', 'pharmacist']);
  if ('error' in guard) redirect('/login');

  const invoice = await getInvoice(params.id);
  if (!invoice) notFound();
  if (guard.caller.role === 'patient' && invoice.patientId !== guard.caller.userId) notFound();

  const db = await getDb();
  const patient = db.users.find((u) => u.id === invoice.patientId);
  const payments = db.payments.filter((p) => p.invoiceId === invoice.id);
  const balance = invoice.totalKes - invoice.paidKes;
  const vatKes = 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between print:hidden">
        <a href={guard.caller.role === 'admin' ? '/admin/accounting' : '/orders'} className="text-sm font-bold text-[var(--color-primary-dark)] hover:underline">
          ← Back
        </a>
        <PrintButton />
      </div>

      <article className="rounded-2xl border border-[var(--color-gray-200)] bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <header className="flex items-start justify-between border-b border-[var(--color-gray-200)] pb-6">
          <div>
            <p className="text-xl font-extrabold">Afya<span className="text-[var(--color-primary)]">Commerce</span></p>
            <p className="mt-1 text-xs leading-5 text-[var(--color-gray-500)]">
              Licensed retail pharmacy &amp; telehealth clinic<br />
              KMPDC / PPB accredited · KMHFR Facility ID on file<br />
              P.O. Box 40217–00100, Nairobi, Kenya
            </p>
          </div>
          <div className="text-right">
            <p className="eyebrow">Tax invoice</p>
            <p className="mt-1 font-mono text-lg font-extrabold">{invoice.number}</p>
            <p className="mt-1 text-xs text-[var(--color-gray-500)]">Issued {new Date(invoice.issuedAt).toLocaleDateString('en-KE')}</p>
            <p className="text-xs text-[var(--color-gray-500)]">Due {new Date(invoice.dueAt).toLocaleDateString('en-KE')}</p>
          </div>
        </header>

        <section className="grid gap-6 border-b border-[var(--color-gray-200)] py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-gray-500)]">Billed to</p>
            <p className="mt-2 font-extrabold">{invoice.patientName}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--color-gray-600)]"><Phone className="h-3.5 w-3.5" />{invoice.patientPhone || '—'}</p>
            {patient?.county && <p className="text-sm text-[var(--color-gray-600)]">{patient.county} County</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-gray-500)]">Source</p>
            <p className="mt-2 text-sm font-bold capitalize">{invoice.sourceType.replace('_', ' ')}</p>
            <p className="mt-1 text-xs text-[var(--color-gray-500)]">Status: {invoice.status.replace('_', ' ')}</p>
          </div>
        </section>

        <section className="py-6">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-gray-200)] text-xs uppercase tracking-wide text-[var(--color-gray-500)]">
                <th className="pb-3 font-bold">Description</th>
                <th className="pb-3 text-right font-bold">Qty</th>
                <th className="pb-3 text-right font-bold">Unit</th>
                <th className="pb-3 text-right font-bold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-gray-100)]">
              {invoice.lines.map((line, index) => (
                <tr key={index}>
                  <td className="py-3">{line.description}</td>
                  <td className="py-3 text-right">{line.qty}</td>
                  <td className="py-3 text-right">{formatKES(line.unitPriceKes)}</td>
                  <td className="py-3 text-right font-bold">{formatKES(line.qty * line.unitPriceKes)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-5 ml-auto max-w-xs space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-[var(--color-gray-600)]">Subtotal</span><span>{formatKES(invoice.totalKes - vatKes)}</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-gray-600)]">VAT (16%, incl.)</span><span>{formatKES(vatKes)}</span></div>
            <div className="flex justify-between border-t border-[var(--color-gray-200)] pt-2 font-extrabold"><span>Total</span><span>{formatKES(invoice.totalKes)}</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-gray-600)]">Paid</span><span className="font-bold text-green-700">{formatKES(invoice.paidKes)}</span></div>
            <div className={`flex justify-between rounded-lg px-3 py-2 ${balance > 0 ? 'bg-orange-50 text-orange-800' : 'bg-green-50 text-green-800'}`}>
              <span className="font-bold">Balance due</span><span className="font-extrabold">{formatKES(balance)}</span>
            </div>
          </div>
        </section>

        {payments.length > 0 && (
          <section className="border-t border-[var(--color-gray-200)] pt-5">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-gray-500)]">Payments applied</p>
            <div className="mt-2 space-y-1.5">
              {payments.map((p) => (
                <p key={p.id} className="text-sm">
                  <span className="font-mono text-xs font-bold">{p.receiptNo}</span> — {formatKES(p.amountKes)} via {p.method.toUpperCase()} · ref {p.reference} · {new Date(p.paidAt).toLocaleString('en-KE')}
                </p>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-6 border-t border-[var(--color-gray-200)] pt-5 text-xs leading-5 text-[var(--color-gray-500)]">
          <p>Pay via M-PESA Paybill (statement: {invoice.number}). Goods once dispensed are not returnable except per PPB guidelines. This invoice is system-generated; queries: billing@afyacommerce.co.ke · 0800 722 000.</p>
          <p className="mt-2 flex items-center gap-1.5"><Printer className="h-3.5 w-3.5" />Generated by AfyaCommerce billing · retain for your records</p>
        </footer>
      </article>
    </div>
  );
}
