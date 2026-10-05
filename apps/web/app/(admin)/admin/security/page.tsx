import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { SecurityPanel } from '@/components/admin/SecurityPanel';
import { requireRole } from '@/lib/server/guard';

export const dynamic = 'force-dynamic';

export default async function AdminSecurityPage() {
  const guard = await requireRole(['admin']);
  if ('error' in guard) redirect('/login');
  return (
    <div>
      <PageHeader
        eyebrow="Self-healing security"
        title="Security operations"
        description="Real-time threat detection, automatic IP blocking, account locking, session key rotation, and lockdown control."
      />
      <SecurityPanel />
    </div>
  );
}
