export interface TrustBadgesProps {
  ppbLicence: string;
  kmhfrId: string;
  pharmacistRegNo: string;
  isShaEmpanelled: boolean;
}

export function TrustBadges({
  ppbLicence,
  kmhfrId,
  pharmacistRegNo,
  isShaEmpanelled
}: TrustBadgesProps) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#6B7280]">
      <li>
        <a
          href={`https://web.pharmacyboardkenya.org/verify?licence=${encodeURIComponent(ppbLicence)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:text-[#168A3C] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1DA84A]"
        >
          PPB Licence: <strong>{ppbLicence}</strong>
        </a>
      </li>
      <li>
        KMHFR: <strong>{kmhfrId}</strong>
      </li>
      <li>
        Pharmacist: <strong>{pharmacistRegNo}</strong>
      </li>
      {isShaEmpanelled ? <li className="text-green-700">SHA Empanelled</li> : null}
    </ul>
  );
}
