import { Award, Building2, ShieldCheck } from 'lucide-react';

interface TrustBadgesProps {
  ppbLicence: string;
  kmhfrId: string;
  pharmacistRegNo: string;
  isShaEmpanelled: boolean;
}

export function TrustBadges({ ppbLicence, kmhfrId, pharmacistRegNo, isShaEmpanelled }: TrustBadgesProps) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--color-gray-600)]">
      <a
        href={`https://web.pharmacyboardkenya.org/verify?licence=${ppbLicence}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-1.5 rounded hover:text-[var(--color-primary-dark)]"
      >
        <ShieldCheck className="h-4 w-4 text-[var(--color-primary)]" aria-hidden="true" />
        <span>PPB licence: <strong>{ppbLicence}</strong></span>
      </a>
      <span className="inline-flex min-h-11 items-center gap-1.5">
        <Building2 className="h-4 w-4 text-[var(--color-secondary)]" aria-hidden="true" />
        <span>KMHFR: <strong>{kmhfrId}</strong></span>
      </span>
      <span className="inline-flex min-h-11 items-center gap-1.5">
        <Award className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
        <span>Pharmacist: <strong>{pharmacistRegNo}</strong></span>
      </span>
      {isShaEmpanelled && <span className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-green-700"><ShieldCheck className="h-4 w-4" aria-hidden="true" />SHA empanelled</span>}
    </div>
  );
}
