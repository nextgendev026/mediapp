import 'server-only';

export interface FhirClientOptions {
  baseUrl?: string;
  accessToken?: string;
}

export async function fhirRequest<T>(path: string, options: RequestInit & FhirClientOptions = {}) {
  const baseUrl = options.baseUrl ?? process.env.HIE_BASE_URL;
  const accessToken = options.accessToken ?? process.env.HIE_ACCESS_TOKEN;
  if (!baseUrl) throw new Error('FHIR integration is not configured');
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/fhir+json');
  headers.set('Content-Type', 'application/fhir+json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  if (!response.ok) throw new Error(`FHIR request failed with ${response.status}`);
  return (await response.json()) as T;
}
