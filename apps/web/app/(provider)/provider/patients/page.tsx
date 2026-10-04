import { redirect } from 'next/navigation';
import { PatientDirectory } from '@/components/provider/PatientDirectory';
import { PageHeader } from '@/components/shared/PageHeader';
import { requireRole } from '@/lib/server/guard';

export const dynamic = 'force-dynamic';

export default async function ProviderPatientsPage() {
  const guard = await requireRole(['provider']);
  if ('error' in guard) redirect(guard.error.status === 401 ? '/login' : '/provider/dashboard');

  return (
    <div>
      <PageHeader
        eyebrow="Clinical records"
        title="Patient directory"
        description="Search every active patient, review balances and allergies, then open the chart or start a consultation."
      />
      <PatientDirectory />
    </div>
  );
}
