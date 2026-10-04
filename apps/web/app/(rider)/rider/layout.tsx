import { maintenanceGuard } from '@/lib/server/settings';
import { RiderShell } from '@/components/shell/RiderShell';

export const dynamic = 'force-dynamic';

export default async function RiderLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await maintenanceGuard();
  return <RiderShell>{children}</RiderShell>;
}
