import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsPanel } from '@/components/admin/SettingsPanel';
import { requireRole } from '@/lib/server/guard';
import { getSettings } from '@/lib/server/settings';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const guard = await requireRole(['admin']);
  if ('error' in guard) redirect('/login');
  const settings = await getSettings();
  return (
    <div>
      <PageHeader
        eyebrow="Platform configuration"
        title="Settings"
        description="Site identity, feature toggles, commerce pricing, and governance thresholds for AfyaCommerce."
      />
      <SettingsPanel initial={settings} />
    </div>
  );
}
