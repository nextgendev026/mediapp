import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataExport } from '@/components/admin/DataExport';
import { requireRole } from '@/lib/server/guard';

export const dynamic = 'force-dynamic';

export default async function AdminExportPage() {
  const guard = await requireRole(['admin']);
  if ('error' in guard) redirect('/login');

  return (
    <div>
      <PageHeader
        eyebrow="Regulatory reporting"
        title="Data export"
        description="Download user, clinical, and financial datasets as native Excel workbooks or CSV for reporting and audits."
      />
      <DataExport />
    </div>
  );
}
