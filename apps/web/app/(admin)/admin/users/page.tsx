import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { UserManager } from '@/components/admin/UserManager';
import { requireRole } from '@/lib/server/guard';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const guard = await requireRole(['admin']);
  if ('error' in guard) redirect('/login');
  return (
    <div>
      <PageHeader eyebrow="Access control" title="User management" description="Search, create, re-role, suspend, and inspect every account on the platform." />
      <UserManager viewerId={guard.caller.userId} />
    </div>
  );
}
