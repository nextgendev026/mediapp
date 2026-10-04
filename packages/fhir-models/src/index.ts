export const FHIR_R4_VERSION = '4.0.1' as const;
export const FHIR_CONTENT_TYPE = 'application/fhir+json' as const;

export type FhirJsonPrimitive = string | number | boolean | null;
export type FhirJsonValue = FhirJsonPrimitive | FhirJsonValue[] | { [key: string]: FhirJsonValue };

export interface FhirCoding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirIdentifier {
  use?: string;
  type?: FhirCodeableConcept;
  system?: string;
  value?: string;
  period?: FhirPeriod;
  assigner?: FhirReference;
}

export interface FhirReference {
  reference?: string;
  type?: string;
  identifier?: FhirIdentifier;
  display?: string;
}

export interface FhirAttachment {
  contentType?: string;
  language?: string;
  data?: string;
  url?: string;
  size?: number;
  hash?: string;
  title?: string;
  creation?: string;
}

export interface FhirAnnotation {
  authorReference?: FhirReference;
  authorString?: string;
  time?: string;
  text?: string;
}

export interface FhirPeriod {
  start?: string;
  end?: string;
}

export interface FhirRange {
  low?: FhirQuantity;
  high?: FhirQuantity;
}

export interface FhirQuantity {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: string;
  code?: string;
}

export interface FhirRatio {
  numerator?: FhirQuantity;
  denominator?: FhirQuantity;
}

export interface FhirMeta {
  versionId?: string;
  lastUpdated?: string;
  source?: string;
  profile?: string[];
  security?: FhirCoding[];
  tag?: FhirCoding[];
}

export interface FhirNarrative {
  status: 'generated' | 'extensions' | 'additional' | 'empty';
  div: string;
}

export interface FhirExtension {
  url: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueString?: string;
  valueDateTime?: string;
  valueUri?: string;
  valueCode?: string;
  valueId?: string;
  valueDecimal?: number;
  valueDate?: string;
  valueInstant?: string;
  valueTime?: string;
  valueQuantity?: FhirQuantity;
  valueCodeableConcept?: FhirCodeableConcept;
  valueReference?: FhirReference;
}

export interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: FhirMeta;
  implicitRules?: string;
  language?: string;
  text?: FhirNarrative;
  contained?: FhirResource[];
  extension?: FhirExtension[];
  modifierExtension?: FhirExtension[];
}

export interface FhirHumanName {
  use?: string;
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: FhirPeriod;
}

export interface FhirContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: string;
  rank?: number;
  period?: FhirPeriod;
}

export interface FhirAddress {
  use?: string;
  type?: string;
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: FhirPeriod;
}

export interface FhirPatient extends FhirResource {
  resourceType: 'Patient';
  identifier?: FhirIdentifier[];
  active?: boolean;
  name?: FhirHumanName[];
  telecom?: FhirContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  address?: FhirAddress[];
  maritalStatus?: FhirCodeableConcept;
  multipleBirthBoolean?: boolean;
  multipleBirthInteger?: number;
  communication?: FhirCommunication[];
  generalPractitioner?: FhirReference[];
  managingOrganization?: FhirReference;
  link?: FhirPatientLink[];
}

export interface FhirCommunication {
  language?: FhirCodeableConcept;
  preferred?: boolean;
}

export interface FhirPatientLink {
  other?: FhirReference;
  type?: 'replaced-by' | 'replaces' | 'refer' | 'seealso';
}

export interface FhirPractitioner extends FhirResource {
  resourceType: 'Practitioner';
  identifier?: FhirIdentifier[];
  active?: boolean;
  name?: FhirHumanName[];
  telecom?: FhirContactPoint[];
  qualification?: FhirQualification[];
  communication?: FhirCodeableConcept[];
}

export interface FhirQualification {
  identifier?: FhirIdentifier[];
  code?: FhirCodeableConcept;
  period?: FhirPeriod;
  issuer?: FhirReference;
}

export interface FhirOrganization extends FhirResource {
  resourceType: 'Organization';
  identifier?: FhirIdentifier[];
  active?: boolean;
  type?: FhirCodeableConcept[];
  name?: string;
  alias?: string[];
  telecom?: FhirContactPoint[];
  address?: FhirAddress[];
  partOf?: FhirReference;
  contact?: FhirOrganizationContact[];
}

export interface FhirOrganizationContact {
  purpose?: FhirCodeableConcept;
  name?: FhirHumanName;
  telecom?: FhirContactPoint[];
}

export type FhirMedicationRequestStatus = 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';
export type FhirMedicationRequestIntent = 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
export type FhirRequestPriority = 'routine' | 'urgent' | 'asap' | 'stat';

export interface FhirTimingRepeat {
  boundsPeriod?: FhirPeriod;
  boundsDuration?: FhirQuantity;
  boundsRange?: FhirRange;
  frequency?: number;
  frequencyMax?: number;
  period?: number;
  periodMax?: number;
  duration?: number;
  durationMax?: number;
  durationUnit?: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo' | 'a';
  timeOfDay?: string[];
  when?: string[];
  offset?: number;
}

export interface FhirTiming {
  event?: string[];
  repeat?: FhirTimingRepeat;
  code?: FhirCodeableConcept;
}

export interface FhirDoseAndRate {
  type?: FhirCodeableConcept;
  doseRange?: FhirRange;
  doseQuantity?: FhirQuantity;
  rateRatio?: FhirRatio;
  rateRange?: FhirRange;
  rateQuantity?: FhirQuantity;
}

export interface FhirDosageInstruction {
  sequence?: number;
  text?: string;
  additionalInstruction?: FhirCodeableConcept[];
  patientInstruction?: string;
  timing?: FhirTiming;
  asNeededBoolean?: boolean;
  asNeededCodeableConcept?: FhirCodeableConcept;
  site?: FhirCodeableConcept;
  route?: FhirCodeableConcept;
  method?: FhirCodeableConcept;
  doseAndRate?: FhirDoseAndRate[];
  maxDosePerPeriod?: FhirRatio;
  maxDosePerAdministration?: FhirQuantity;
  maxDosePerLifetime?: FhirQuantity;
}

export interface FhirDispenseRequest {
  initialFill?: FhirInitialFill;
  dispenseInterval?: FhirTiming;
  validityPeriod?: FhirPeriod;
  numberOfRepeatsAllowed?: number;
  quantity?: FhirQuantity;
  expectedSupplyDuration?: FhirQuantity;
  performer?: FhirReference;
}

export interface FhirInitialFill {
  quantity?: FhirQuantity;
  duration?: FhirQuantity;
}

export interface FhirMedicationRequestNote extends FhirAnnotation {
  authorReference?: FhirReference;
}

export interface FhirMedicationRequest extends FhirResource {
  resourceType: 'MedicationRequest';
  identifier?: FhirIdentifier[];
  status: FhirMedicationRequestStatus;
  statusReason?: FhirCodeableConcept[];
  intent: FhirMedicationRequestIntent;
  category?: FhirCodeableConcept[];
  priority?: FhirRequestPriority;
  doNotPerform?: boolean;
  reportedBoolean?: boolean;
  reportedReference?: FhirReference;
  medicationCodeableConcept?: FhirCodeableConcept;
  medicationReference?: FhirReference;
  subject?: FhirReference;
  encounter?: FhirReference;
  supportingInformation?: FhirReference[];
  authoredOn?: string;
  requester?: FhirReference;
  performer?: FhirReference;
  performerType?: FhirCodeableConcept;
  recorder?: FhirReference;
  reasonCode?: FhirCodeableConcept[];
  reasonReference?: FhirReference[];
  note?: FhirMedicationRequestNote[];
  dosageInstruction?: FhirDosageInstruction[];
  dispenseRequest?: FhirDispenseRequest;
  substitution?: FhirSubstitution;
  priorPrescription?: FhirReference;
  detectedIssue?: FhirReference[];
  eventHistory?: FhirReference[];
}

export interface FhirSubstitution {
  allowedBoolean?: boolean;
  allowedCodeableConcept?: FhirCodeableConcept;
  reason?: FhirCodeableConcept;
}

export interface FhirEncounter extends FhirResource {
  resourceType: 'Encounter';
  identifier?: FhirIdentifier[];
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  class?: FhirCoding;
  type?: FhirCodeableConcept[];
  subject?: FhirReference;
  participant?: FhirEncounterParticipant[];
  period?: FhirPeriod;
  reasonCode?: FhirCodeableConcept[];
  serviceProvider?: FhirReference;
}

export interface FhirEncounterParticipant {
  type?: FhirCodeableConcept[];
  period?: FhirPeriod;
  individual?: FhirReference;
}

export interface FhirObservation extends FhirResource {
  resourceType: 'Observation';
  identifier?: FhirIdentifier[];
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime?: string;
  issued?: string;
  performer?: FhirReference[];
  valueQuantity?: FhirQuantity;
  valueCodeableConcept?: FhirCodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  interpretation?: FhirCodeableConcept[];
}

export interface FhirBundleEntry<T extends FhirResource = FhirResource> {
  fullUrl?: string;
  resource?: T;
  search?: FhirBundleEntrySearch;
  request?: FhirBundleEntryRequest;
  response?: FhirBundleEntryResponse;
}

export interface FhirBundleEntrySearch {
  mode?: 'match' | 'include' | 'outcome';
  score?: number;
}

export interface FhirBundleEntryRequest {
  method?: string;
  url?: string;
}

export interface FhirBundleEntryResponse {
  status?: string;
  location?: string;
  etag?: string;
  lastModified?: string;
}

export interface FhirBundle<T extends FhirResource = FhirResource> extends FhirResource {
  resourceType: 'Bundle';
  identifier?: FhirIdentifier;
  type: 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history' | 'searchset' | 'collection' | 'subscription-notification';
  timestamp?: string;
  total?: number;
  link?: FhirBundleLink[];
  entry?: FhirBundleEntry<T>[];
  signature?: FhirSignature;
}

export interface FhirBundleLink {
  relation: string;
  url: string;
}

export interface FhirSignature {
  type: FhirCoding[];
  when?: string;
  who?: FhirReference;
  onBehalfOf?: FhirReference;
  targetFormat?: string;
  sigFormat?: string;
  data?: string;
}

export interface FhirOperationOutcomeIssue {
  severity?: 'fatal' | 'error' | 'warning' | 'information';
  code?: string;
  diagnostics?: string;
  location?: string[];
  expression?: string[];
}

export interface FhirOperationOutcome extends FhirResource {
  resourceType: 'OperationOutcome';
  issue: FhirOperationOutcomeIssue[];
}

export interface MedicationRequestInput {
  id?: string;
  status?: FhirMedicationRequestStatus;
  intent?: FhirMedicationRequestIntent;
  medicationCodeableConcept?: FhirCodeableConcept;
  medicationReference?: FhirReference;
  subjectReference: string;
  subjectDisplay?: string;
  requesterReference?: string;
  requesterDisplay?: string;
  authoredOn?: string;
  dosageInstruction?: FhirDosageInstruction;
  dispenseRequest?: FhirDispenseRequest;
  note?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isFhirResource(value: unknown): value is FhirResource {
  return isRecord(value) && typeof value.resourceType === 'string';
}

export function isMedicationRequest(value: unknown): value is FhirMedicationRequest {
  return isFhirResource(value) && value.resourceType === 'MedicationRequest';
}

export function createMedicationRequest(input: MedicationRequestInput): FhirMedicationRequest {
  const resource: FhirMedicationRequest = {
    resourceType: 'MedicationRequest',
    status: input.status ?? 'active',
    intent: input.intent ?? 'order',
    subject: {
      reference: input.subjectReference,
      ...(input.subjectDisplay === undefined ? {} : { display: input.subjectDisplay })
    },
    authoredOn: input.authoredOn ?? new Date().toISOString()
  };

  if (input.id !== undefined) resource.id = input.id;
  if (input.medicationCodeableConcept !== undefined) resource.medicationCodeableConcept = input.medicationCodeableConcept;
  if (input.medicationReference !== undefined) resource.medicationReference = input.medicationReference;
  if (input.requesterReference !== undefined) {
    resource.requester = {
      reference: input.requesterReference,
      ...(input.requesterDisplay === undefined ? {} : { display: input.requesterDisplay })
    };
  }
  if (input.dosageInstruction !== undefined) resource.dosageInstruction = [input.dosageInstruction];
  if (input.dispenseRequest !== undefined) resource.dispenseRequest = input.dispenseRequest;
  if (input.note !== undefined) resource.note = [{ text: input.note }];

  return resource;
}

export function serializeFhirResource(resource: FhirResource): string {
  return JSON.stringify(resource);
}
