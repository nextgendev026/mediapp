import { maintenanceGuard } from '@/lib/server/settings';
import { PharmacistShell } from '@/components/shell/PharmacistShell';

export const dynamic = 'force-dynamic';

export default async function PharmacistLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await maintenanceGuard();
  return <PharmacistShell>{children}</PharmacistShell>;
}
