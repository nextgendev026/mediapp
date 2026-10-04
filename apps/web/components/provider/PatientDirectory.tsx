'use client';

import { CalendarDays, ChevronRight, ClipboardList, LoaderCircle, Phone, Pill, RefreshCw, Search, ShieldAlert, WalletCards } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatKES } from '@/lib/utils/format-currency';

interface NextAppointment {
  id: string;
  date: string;
  time: string;
  mode: string;
  status: string;
  providerId: string;
}

interface PatientRow {
  id: string;
  fullName: string;
  phone: string;
  county?: string | undefined;
  gender?: string | undefined;
  dob?: string | undefined;
  allergies?: string[] | undefined;
  createdAt: string;
  lastVisitAt?: string | undefined;
  encounterCount: number;
  nextAppointment: NextAppointment | null;
  openBalance: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(value?: string | undefined): string {
  if (!value) return 'No visits yet';
  const [y, m, d] = value.slice(0, 10).split('-');
  if (!y || !m || !d) return value;
  return `${d} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function PatientDirectory() {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError('');
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : '';
      const res = await fetch(`/api/patients${params}`, { headers: { 'X-Afya-Client': 'web' } });
      if (!res.ok) throw new Error('Could not load patients.');
      const data = (await res.json()) as { patients: PatientRow[] };
      setRows(data.patients);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load patients.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query, load]);

  return (
    <div>
      <Card className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-gray-500)]" />
          <input
            className="min-h-11 w-full rounded-lg border border-[var(--color-gray-300)] bg-white pl-10 pr-3 text-sm outline-none focus:border-[var(--color-primary)]"
            placeholder="Search by name or phone number"
            aria-label="Search patients"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <p className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-gray-500)]">
          <ShieldAlert className="h-4 w-4 text-[var(--color-primary)]" />
          Every chart view is recorded in the audit trail
        </p>
      </Card>

      {error && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-700">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load(query.trim())}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </Card>
      )}

      {loading && !error && (
        <Card className="flex items-center justify-center gap-2 py-10 text-sm font-semibold text-[var(--color-gray-500)]">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading patients
        </Card>
      )}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          title={query ? 'No matching patients' : 'No patients yet'}
          description={query ? 'Try a different name or phone number.' : 'Patients appear here once they book a consultation with you.'}
          icon={Search}
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((patient) => {
            const allergies = patient.allergies ?? [];
            const next = patient.nextAppointment;
            return (
              <Card key={patient.id} className="p-0">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-extrabold text-blue-700">
                    {initials(patient.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-extrabold">{patient.fullName}</p>
                      {patient.county && <Badge tone="neutral">{patient.county}</Badge>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-gray-600)]">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {patient.phone}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Last visit {formatDate(patient.lastVisitAt)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <ClipboardList className="h-3.5 w-3.5" />
                        {patient.encounterCount} encounter{patient.encounterCount === 1 ? '' : 's'}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <WalletCards className="h-3.5 w-3.5" />
                        {patient.openBalance > 0 ? `${formatKES(patient.openBalance)} due` : 'No balance'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {allergies.length > 0 ? (
                        <Badge tone="warning">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Allergies: {allergies.join(', ')}
                        </Badge>
                      ) : (
                        <Badge tone="success">No allergies recorded</Badge>
                      )}
                      {next && (
                        <Badge tone="info">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Next {formatDate(next.date)} {next.time}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/provider/patients/${patient.id}`}>
                      <Button variant="outline" size="sm">
                        Open chart
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <Link href={next ? `/provider/consultations/${next.id}` : `/provider/prescriptions/new?patientId=${patient.id}`}>
                      <Button size="sm">
                        <Pill className="h-3.5 w-3.5" />
                        Consult
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
