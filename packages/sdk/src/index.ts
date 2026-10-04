import type {
  AuditAction,
  AuditLog,
  AuditPurpose,
  AuditQuery,
  CatalogQuery,
  Consultation,
  CreateOrderInput,
  CreatePrescriptionInput,
  JsonValue,
  MpesaStkPushRequest,
  MpesaStkPushResponse,
  Order,
  Page,
  PaymentStatusResponse,
  Prescription,
  Product,
  DeliveryStatus
} from '@afyacommerce/types';
import type { FhirMedicationRequest, FhirResource } from '@afyacommerce/fhir-models';

export interface AfyaCommerceClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  getAccessToken?: () => string | null | Promise<string | null>;
  defaultHeaders?: HeadersInit;
  timeoutMs?: number;
}

export type QueryValue = string | number | boolean | undefined;
export type QueryParams = Record<string, QueryValue>;

export interface RequestOptions {
  method?: RequestInit['method'];
  body?: unknown;
  query?: QueryParams;
  headers?: HeadersInit;
  signal?: AbortSignal;
  auth?: boolean;
}

export interface OrderQuery {
  status?: DeliveryStatus;
  page?: number;
  page_size?: number;
}

export interface RecordAuditInput {
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  phiAccessed?: boolean;
  purpose?: AuditPurpose;
  metadata?: JsonValue;
}

export class AfyaCommerceError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly details: unknown;

  constructor(message: string, status = 0, code: string | null = null, details: unknown = null) {
    super(message);
    this.name = 'AfyaCommerceError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function queryFrom(values: Record<string, QueryValue>): QueryParams {
  const query: QueryParams = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) query[key] = value;
  }
  return query;
}

function errorDetails(payload: unknown): { message: string; code: string | null; details: unknown } {
  if (isRecord(payload)) {
    const message = typeof payload.message === 'string'
      ? payload.message
      : typeof payload.error === 'string'
        ? payload.error
        : 'The API request failed';
    const code = typeof payload.code === 'string' ? payload.code : null;
    return { message, code, details: payload.details ?? payload };
  }
  if (typeof payload === 'string' && payload.length > 0) {
    return { message: payload, code: null, details: null };
  }
  return { message: 'The API request failed', code: null, details: null };
}

export class AfyaCommerceClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly getAccessToken: (() => string | null | Promise<string | null>) | null;
  private readonly defaultHeaders: Headers;
  private readonly timeoutMs: number;

  constructor(options: AfyaCommerceClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.getAccessToken = options.getAccessToken ?? null;
    this.defaultHeaders = new Headers(options.defaultHeaders);
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}/${path.replace(/^\/+/, '')}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers = new Headers(this.defaultHeaders);
    for (const [key, value] of new Headers(options.headers).entries()) headers.set(key, value);

    const bodyIsPresent = options.body !== undefined && options.body !== null;
    if (bodyIsPresent && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

    if (options.auth !== false) {
      const token = await this.getAccessToken?.();
      if (!token) throw new AfyaCommerceError('An access token is required for this request', 401);
      headers.set('Authorization', `Bearer ${token}`);
    }

    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener('abort', forwardAbort, { once: true });
    }
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const requestInit: RequestInit = {
      method: options.method ?? 'GET',
      headers,
      signal: controller.signal
    };
    if (bodyIsPresent) {
      const serializedBody = JSON.stringify(options.body);
      if (serializedBody !== undefined) requestInit.body = serializedBody;
    }

    try {
      const response = await this.fetchImpl(url, requestInit);
      const rawBody = await response.text();
      let payload: unknown = rawBody;
      if (rawBody.length > 0) {
        try {
          payload = JSON.parse(rawBody) as unknown;
        } catch {
          payload = rawBody;
        }
      } else {
        payload = undefined;
      }

      if (!response.ok) {
        const details = errorDetails(payload);
        throw new AfyaCommerceError(details.message, response.status, details.code, details.details);
      }
      return payload as T;
    } catch (error) {
      if (error instanceof AfyaCommerceError) throw error;
      if (controller.signal.aborted && !options.signal?.aborted) {
        throw new AfyaCommerceError('The API request timed out', 408);
      }
      const message = error instanceof Error ? error.message : 'Network request failed';
      throw new AfyaCommerceError(message);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', forwardAbort);
    }
  }

  getCatalog(query: CatalogQuery = {}): Promise<Page<Product>> {
    return this.request<Page<Product>>('/api/products', {
      auth: false,
      query: queryFrom({
        search: query.search,
        category: query.category,
        county: query.county,
        requires_prescription: query.requires_prescription,
        page: query.page,
        page_size: query.page_size
      })
    });
  }

  getProduct(productId: string): Promise<Product> {
    return this.request<Product>(`/api/products/${encodeURIComponent(productId)}`, { auth: false });
  }

  getPrescriptions(): Promise<Page<Prescription>> {
    return this.request<Page<Prescription>>('/api/prescriptions');
  }

  getPrescription(prescriptionId: string): Promise<Prescription> {
    return this.request<Prescription>(`/api/prescriptions/${encodeURIComponent(prescriptionId)}`);
  }

  createPrescription(input: CreatePrescriptionInput): Promise<Prescription> {
    return this.request<Prescription>('/api/prescriptions', {
      method: 'POST',
      body: input
    });
  }

  getConsultations(): Promise<Page<Consultation>> {
    return this.request<Page<Consultation>>('/api/consultations');
  }

  getConsultation(consultationId: string): Promise<Consultation> {
    return this.request<Consultation>(`/api/consultations/${encodeURIComponent(consultationId)}`);
  }

  getOrders(query: OrderQuery = {}): Promise<Page<Order>> {
    return this.request<Page<Order>>('/api/orders', {
      query: queryFrom({
        status: query.status,
        page: query.page,
        page_size: query.page_size
      })
    });
  }

  getOrder(orderId: string): Promise<Order> {
    return this.request<Order>(`/api/orders/${encodeURIComponent(orderId)}`);
  }

  createOrder(input: CreateOrderInput): Promise<Order> {
    return this.request<Order>('/api/orders', {
      method: 'POST',
      body: input
    });
  }

  getPaymentStatus(providerReference: string): Promise<PaymentStatusResponse> {
    return this.request<PaymentStatusResponse>(`/api/mpesa/status/${encodeURIComponent(providerReference)}`);
  }

  initiateMpesaStkPush(input: MpesaStkPushRequest): Promise<MpesaStkPushResponse> {
    return this.request<MpesaStkPushResponse>('/api/mpesa/stk-push', {
      method: 'POST',
      body: input
    });
  }

  getMedicationRequest(prescriptionId: string): Promise<FhirMedicationRequest> {
    return this.request<FhirMedicationRequest>(`/fhir/MedicationRequest/${encodeURIComponent(prescriptionId)}`);
  }

  getFhirResource<T extends FhirResource>(resourcePath: string, query?: QueryParams): Promise<T> {
    return this.request<T>(`/fhir/${resourcePath.replace(/^\/+/, '')}`, { query: query ?? {} });
  }

  getAuditLogs(query: AuditQuery = {}): Promise<Page<AuditLog>> {
    return this.request<Page<AuditLog>>('/api/audit-log', {
      query: queryFrom({
        actor_id: query.actor_id,
        action: query.action,
        resource_type: query.resource_type,
        from: query.from,
        to: query.to,
        page: query.page,
        page_size: query.page_size
      })
    });
  }

  recordAudit(input: RecordAuditInput): Promise<void> {
    return this.request<void>('/api/audit-log', {
      method: 'POST',
      body: {
        action: input.action,
        resource_type: input.resourceType,
        resource_id: input.resourceId ?? null,
        phi_accessed: input.phiAccessed ?? false,
        purpose: input.purpose ?? 'treatment',
        metadata: input.metadata ?? null
      }
    });
  }
}

export function createAfyaCommerceClient(options: AfyaCommerceClientOptions): AfyaCommerceClient {
  return new AfyaCommerceClient(options);
}
