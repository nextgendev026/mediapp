import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { AuditViewer } from '@/components/admin/AuditViewer';
import { requireRole } from '@/lib/server/guard';

export const dynamic = 'force-dynamic';

export default async function AuditLogPage() {
  const guard = await requireRole(['admin']);
  if ('error' in guard) redirect('/login');
  return (
    <div>
      <PageHeader eyebrow="Compliance" title="Audit log" description="Every sensitive action, immutably recorded: who, what, when, and why." />
      <AuditViewer />
    </div>
  );
}
