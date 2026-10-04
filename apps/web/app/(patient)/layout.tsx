import { maintenanceGuard } from '@/lib/server/settings';
import { PatientShell } from '@/components/shell/PatientShell';

export const dynamic = 'force-dynamic';

export default async function PatientLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await maintenanceGuard();
  return <PatientShell>{children}</PatientShell>;
}
