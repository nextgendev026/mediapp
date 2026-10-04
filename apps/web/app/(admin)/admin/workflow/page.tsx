import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { WorkflowBoard } from '@/components/admin/WorkflowBoard';
import { requireRole } from '@/lib/server/guard';

export const dynamic = 'force-dynamic';

export default async function WorkflowPage() {
  const guard = await requireRole(['admin']);
  if ('error' in guard) redirect('/login');
  return (
    <div>
      <PageHeader
        eyebrow="Clinical operations"
        title="Visit workflow board"
        description="Front desk intake through checkout: track every visit by stage, assign clinicians, and move patients along the pathway."
      />
      <WorkflowBoard />
    </div>
  );
}
