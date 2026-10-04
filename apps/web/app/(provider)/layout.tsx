import { maintenanceGuard } from '@/lib/server/settings';
import { ProviderShell } from '@/components/shell/ProviderShell';

export const dynamic = 'force-dynamic';

export default async function ProviderLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await maintenanceGuard();
  return <ProviderShell>{children}</ProviderShell>;
}
