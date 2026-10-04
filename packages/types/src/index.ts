export const USER_ROLES = ['patient', 'provider', 'pharmacist', 'admin', 'rider'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const LANGUAGES = ['en', 'sw'] as const;
export type Language = (typeof LANGUAGES)[number];

export const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const;
export type Gender = (typeof GENDERS)[number];

export const PRODUCT_CATEGORIES = ['prescription', 'otc', 'device', 'supplement'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRESCRIPTION_STATUSES = ['pending', 'approved', 'dispensed', 'cancelled', 'expired'] as const;
export type PrescriptionStatus = (typeof PRESCRIPTION_STATUSES)[number];

export const SHA_CLAIM_STATUSES = ['not_submitted', 'submitted', 'approved', 'rejected'] as const;
export type ShaClaimStatus = (typeof SHA_CLAIM_STATUSES)[number];

export const CONSULTATION_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'] as const;
export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number];

export const CONSULTATION_TYPES = ['video', 'audio', 'chat'] as const;
export type ConsultationType = (typeof CONSULTATION_TYPES)[number];

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['mpesa', 'airtel_money', 'pesalink', 'card', 'sha', 'cash'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const DELIVERY_STATUSES = ['pending', 'confirmed', 'dispatched', 'in_transit', 'delivered', 'failed', 'cancelled'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DELIVERY_METHODS = ['boda', 'pickup_point', 'clinic_collection'] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export const TRANSACTION_STATUSES = ['initiated', 'pending', 'succeeded', 'failed', 'reversed'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_PROVIDERS = ['mpesa', 'airtel_money', 'pesalink', 'card', 'sha'] as const;
export type TransactionProvider = (typeof TRANSACTION_PROVIDERS)[number];

export const CONSENT_TYPES = [
  'phi_processing',
  'telehealth',
  'prescription_sharing',
  'marketing',
  'research',
  'data_sharing_third_party'
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export const AUDIT_ACTIONS = ['READ', 'CREATE', 'UPDATE', 'DELETE', 'DISPENSE', 'EXPORT'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_PURPOSES = ['treatment', 'payment', 'audit', 'admin'] as const;
export type AuditPurpose = (typeof AUDIT_PURPOSES)[number];

export type EntityId = string;
export type IsoDate = string;
export type IsoDateTime = string;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface Profile {
  id: EntityId;
  role: UserRole;
  full_name: string;
  phone: string;
  email: string | null;
  national_id: string | null;
  odpc_consent_given: boolean;
  odpc_consent_timestamp: IsoDateTime | null;
  mfa_enabled: boolean;
  preferred_language: Language;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface Pharmacy {
  id: EntityId;
  name: string;
  ppb_licence_number: string;
  ppb_licence_expiry: IsoDate;
  kmhfr_facility_id: string;
  pharmacist_registration_number: string;
  physical_address: string;
  county: string;
  gps_lat: number | null;
  gps_lng: number | null;
  delivery_radius_km: number;
  is_active: boolean;
  is_sha_empanelled: boolean;
  created_at: IsoDateTime;
}

export interface Provider {
  id: EntityId;
  profile_id: EntityId | null;
  licence_number: string;
  specialisation: string;
  telemedicine_registry_id: string | null;
  is_available: boolean;
  consultation_fee_kes: number | null;
  created_at: IsoDateTime;
}

export interface Patient {
  id: EntityId;
  profile_id: EntityId;
  date_of_birth: IsoDate;
  gender: Gender | null;
  sha_member_number: string | null;
  blood_type: string | null;
  allergies: string[];
  chronic_conditions: string[];
  primary_county: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface Product {
  id: EntityId;
  pharmacy_id: EntityId | null;
  name: string;
  generic_name: string | null;
  swahili_name: string | null;
  category: ProductCategory;
  price_kes: number;
  stock_quantity: number;
  reorder_threshold: number;
  batch_number: string | null;
  expiry_date: IsoDate | null;
  requires_prescription: boolean;
  ppb_registration_number: string | null;
  image_url: string | null;
  search_vector: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface Prescription {
  id: EntityId;
  patient_id: EntityId | null;
  provider_id: EntityId | null;
  pharmacy_id: EntityId | null;
  medication_name: string;
  generic_name: string | null;
  dosage: string;
  frequency: string;
  duration_days: number | null;
  refills_remaining: number;
  status: PrescriptionStatus;
  fhir_resource: JsonObject | null;
  clinical_notes: string | null;
  sha_claim_status: ShaClaimStatus;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface SoapNotes {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface Consultation {
  id: EntityId;
  patient_id: EntityId | null;
  provider_id: EntityId | null;
  scheduled_at: IsoDateTime;
  started_at: IsoDateTime | null;
  ended_at: IsoDateTime | null;
  status: ConsultationStatus;
  consultation_type: ConsultationType | null;
  fee_kes: number | null;
  payment_status: PaymentStatus;
  soap_notes: SoapNotes | null;
  created_at: IsoDateTime;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DeliveryAddress {
  phone: string;
  landmark: string;
  county: string;
  gps_lat: number | null;
  gps_lng: number | null;
  notes: string | null;
}

export interface ProofOfDelivery {
  photo_url: string | null;
  otp_verified: boolean;
  gps_at_delivery: Coordinates | null;
  timestamp: IsoDateTime | null;
}

export interface Order {
  id: EntityId;
  order_number: string;
  patient_id: EntityId | null;
  pharmacy_id: EntityId | null;
  prescription_id: EntityId | null;
  subtotal_kes: number;
  delivery_fee_kes: number;
  total_kes: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  payment_reference: string | null;
  mpesa_checkout_request_id: string | null;
  mpesa_receipt_number: string | null;
  delivery_status: DeliveryStatus;
  delivery_method: DeliveryMethod | null;
  delivery_address: DeliveryAddress;
  rider_id: EntityId | null;
  proof_of_delivery: ProofOfDelivery | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface OrderItem {
  id: EntityId;
  order_id: EntityId;
  product_id: EntityId | null;
  quantity: number;
  unit_price_kes: number;
  line_total_kes: number;
}

export interface PaymentTransaction {
  id: EntityId;
  order_id: EntityId | null;
  provider: TransactionProvider;
  provider_reference: string | null;
  amount_kes: number;
  status: TransactionStatus;
  request_payload: JsonValue | null;
  callback_payload: JsonValue | null;
  idempotency_key: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface Rider {
  id: EntityId;
  profile_id: EntityId;
  plate_number: string;
  transport_licence_number: string;
  transport_licence_expiry: IsoDate;
  county: string;
  is_available: boolean;
  current_lat: number | null;
  current_lng: number | null;
  last_ping_at: IsoDateTime | null;
  rating: number;
  created_at: IsoDateTime;
}

export interface AuditLog {
  id: string | number;
  actor_id: EntityId | null;
  actor_role: UserRole | null;
  action: AuditAction;
  resource_type: string;
  resource_id: EntityId | null;
  phi_accessed: boolean;
  purpose: AuditPurpose | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: JsonValue | null;
  timestamp: IsoDateTime;
}

export interface ConsentRecord {
  id: EntityId;
  profile_id: EntityId;
  consent_type: ConsentType;
  granted: boolean;
  granted_at: IsoDateTime;
  revoked_at: IsoDateTime | null;
  ip_address: string | null;
  policy_version: string;
}

export interface CatalogQuery {
  search?: string;
  category?: ProductCategory;
  county?: string;
  requires_prescription?: boolean;
  page?: number;
  page_size?: number;
}

export interface PageInfo {
  page: number;
  page_size: number;
  total: number;
  has_next: boolean;
}

export interface Page<T> {
  data: T[];
  page_info: PageInfo;
}

export interface ApiErrorPayload {
  code?: string;
  message: string;
  details?: JsonValue;
}

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiErrorPayload };

export interface MpesaStkPushRequest {
  phone: string;
  amount: number;
  orderId: string;
  orderNumber: string;
}

export interface MpesaStkPushResponse {
  CheckoutRequestID: string;
  MerchantRequestID?: string;
  ResponseCode?: string;
  CustomerMessage?: string;
}

export interface PaymentStatusResponse {
  status: TransactionStatus | 'unknown';
  provider_reference?: string | null;
  mpesa_receipt_number?: string | null;
  callback_payload?: JsonValue | null;
}

export interface CreatePrescriptionInput {
  patient_id: string;
  provider_id: string;
  pharmacy_id?: string | null;
  medication_name: string;
  generic_name?: string | null;
  dosage: string;
  frequency: string;
  duration_days?: number | null;
  refills_remaining?: number;
  clinical_notes?: string | null;
}

export interface CreateOrderItemInput {
  product_id: string;
  quantity: number;
  unit_price_kes?: number;
}

export interface CreateOrderInput {
  patient_id: string;
  pharmacy_id: string;
  prescription_id?: string | null;
  delivery_address: DeliveryAddress;
  delivery_method?: DeliveryMethod;
  items: CreateOrderItemInput[];
  payment_method?: PaymentMethod;
}

export interface AuditQuery {
  actor_id?: string;
  action?: AuditAction;
  resource_type?: string;
  from?: IsoDateTime;
  to?: IsoDateTime;
  page?: number;
  page_size?: number;
}

export const KENYA_COUNTIES = [
  'Baringo',
  'Bomet',
  'Bungoma',
  'Busia',
  'Elgeyo-Marakwet',
  'Embu',
  'Garissa',
  'Homa Bay',
  'Isiolo',
  'Kajiado',
  'Kakamega',
  'Kericho',
  'Kiambu',
  'Kilifi',
  'Kirinyaga',
  'Kisii',
  'Kisumu',
  'Kitui',
  'Kwale',
  'Laikipia',
  'Lamu',
  'Machakos',
  'Makueni',
  'Mandera',
  'Marsabit',
  'Meru',
  'Migori',
  'Mombasa',
  "Murang'a",
  'Nairobi',
  'Nakuru',
  'Nandi',
  'Narok',
  'Nyamira',
  'Nyandarua',
  'Nyeri',
  'Samburu',
  'Siaya',
  'Taita-Taveta',
  'Tana River',
  'Tharaka-Nithi',
  'Trans Nzoia',
  'Turkana',
  'Uasin Gishu',
  'Vihiga',
  'Wajir',
  'West Pokot'
] as const;
export type KenyaCounty = (typeof KENYA_COUNTIES)[number];

export const KENYAN_PHONE_REGEX = /^(?:\+254|254|0)(7\d{8}|1\d{8})$/;

export function isKenyanPhone(input: string): boolean {
  return KENYAN_PHONE_REGEX.test(input.trim());
}

export function normalizeKenyanPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('254')) return `+${digits}`;
  if (digits.startsWith('0')) return `+254${digits.slice(1)}`;
  return `+254${digits}`;
}

export function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
}

export function createOrderNumber(date = new Date(), sequence = 1): string {
  return `AFY-${date.getUTCFullYear()}-${String(sequence).padStart(6, '0')}`;
}

export function isTerminalPaymentStatus(status: TransactionStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'reversed';
}
