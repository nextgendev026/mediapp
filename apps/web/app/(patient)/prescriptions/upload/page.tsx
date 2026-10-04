import { PageHeader } from '@/components/shared/PageHeader';
import { PrescriptionUpload } from '@/components/pharmacy/PrescriptionUpload';

export default function UploadPrescriptionPage() {
  return <div><PageHeader eyebrow="Secure upload" title="Upload a prescription" description="Send a clear image or PDF to a licensed pharmacist for review. Your file is encrypted and never shared without your consent." backHref="/prescriptions" /><PrescriptionUpload /><p className="mt-5 text-center text-xs text-[var(--color-gray-500)]">Need help? Call our care team on 0800 722 000.</p></div>;
}
