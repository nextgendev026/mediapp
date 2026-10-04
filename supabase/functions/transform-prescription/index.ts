import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type JsonRecord = Record<string, unknown>;

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ALLOWED_ORIGIN?: string;
}

interface PrescriptionRow {
  id: string;
  patient_id: string | null;
  provider_id: string | null;
  pharmacy_id: string | null;
  medication_name: string;
  generic_name: string | null;
  dosage: string;
  frequency: string;
  duration_days: number | null;
  refills_remaining: number;
  status: "pending" | "approved" | "dispensed" | "cancelled" | "expired";
  fhir_resource: JsonRecord | null;
  clinical_notes: string | null;
  created_at: string;
  updated_at: string;
  patients: {
    id: string;
    profile_id: string | null;
    sha_member_number: string | null;
    allergies: string[] | null;
    profiles: { full_name: string; phone: string } | null;
  } | null;
  providers: {
    id: string;
    profile_id: string | null;
    licence_number: string;
    specialisation: string;
    profiles: { full_name: string } | null;
  } | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 16_384;

function env(name: keyof Env): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function response(body: unknown, status = 200, origin = ""): Response {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function requestOrigin(request: Request, allowed: string): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const allowedOrigins = allowed.split(",").map((value) => value.trim()).filter(Boolean);
  return allowedOrigins.includes(origin) ? origin : null;
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

function isServiceRequest(request: Request, serviceKey: string): boolean {
  return bearerToken(request) === serviceKey;
}

async function readJson(request: Request): Promise<JsonRecord> {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new Error("request too large");
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new Error("invalid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid body");
  return value as JsonRecord;
}

function statusForPrescription(status: PrescriptionRow["status"]): string {
  if (status === "dispensed") return "completed";
  if (status === "approved") return "active";
  if (status === "cancelled") return "stopped";
  if (status === "expired") return "draft";
  return "draft";
}

function buildFhirResource(prescription: PrescriptionRow): JsonRecord {
  const sourceDate = Date.parse(prescription.updated_at || prescription.created_at);
  const baseTime = Number.isFinite(sourceDate) ? sourceDate : Date.now();
  const patientName = prescription.patients?.profiles?.full_name;
  const providerName = prescription.providers?.profiles?.full_name;
  const resource: JsonRecord = {
    resourceType: "MedicationRequest",
    id: prescription.id,
    meta: {
      lastUpdated: prescription.updated_at,
      profile: ["http://hl7.org/fhir/StructureDefinition/MedicationRequest"],
    },
    status: statusForPrescription(prescription.status),
    intent: "order",
    medicationCodeableConcept: {
      text: prescription.medication_name,
      ...(prescription.generic_name
        ? { coding: [{ system: "http://snomed.info/sct", display: prescription.generic_name }] }
        : {}),
    },
    subject: {
      reference: `Patient/${prescription.patient_id}`,
      ...(patientName ? { display: patientName } : {}),
    },
    authoredOn: prescription.created_at,
    requester: {
      reference: `Practitioner/${prescription.provider_id}`,
      ...(providerName ? { display: providerName } : {}),
    },
    dosageInstruction: [
      {
        text: `${prescription.dosage} ${prescription.frequency}`,
        timing: prescription.duration_days
          ? { repeat: { duration: prescription.duration_days, durationUnit: "d" } }
          : undefined,
      },
    ],
    dispenseRequest: {
      numberOfRepeatsAllowed: prescription.refills_remaining,
      validityPeriod: {
        end: new Date(baseTime + 90 * 86_400_000).toISOString(),
      },
    },
    ...(prescription.clinical_notes ? { note: [{ text: prescription.clinical_notes }] } : {}),
  };
  return resource;
}

async function etag(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `"${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}"`;
}

async function authorize(
  prescription: PrescriptionRow,
  userId: string,
  admin: SupabaseClient,
): Promise<boolean> {
  const { data: profile, error } = await admin
    .from("profiles")
    .select("role,pharmacy_id,is_active")
    .eq("id", userId)
    .single();
  if (error || !profile) return false;
  if (profile.is_active !== true) return false;
  if (profile.role === "admin") return true;
  if (profile.role === "patient") return prescription.patients?.profile_id === userId;
  if (profile.role === "provider") return prescription.providers?.profile_id === userId;
  if (profile.role === "pharmacist") return profile.pharmacy_id === prescription.pharmacy_id;
  return false;
}

serve(async (request: Request): Promise<Response> => {
  const supabaseUrl = env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "https://afyacommerce.co.ke";
  const origin = requestOrigin(request, allowedOrigin);
  if (request.headers.has("Origin") && !origin) return response({ error: "origin not allowed" }, 403);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key",
      },
    });
  }
  if (request.method !== "POST") return response({ error: "method not allowed" }, 405, origin ?? "");

  const token = bearerToken(request);
  if (!token) return response({ error: "authentication required" }, 401, origin ?? "");
  const serviceRequest = isServiceRequest(request, serviceKey);
  let userId = "";
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (!serviceRequest) {
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? serviceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return response({ error: "authentication required" }, 401, origin ?? "");
    userId = userData.user.id;
  }

  let body: JsonRecord;
  try {
    body = await readJson(request);
  } catch {
    return response({ error: "invalid request" }, 400, origin ?? "");
  }
  const prescriptionId = typeof body.prescriptionId === "string" ? body.prescriptionId : "";
  if (!UUID_PATTERN.test(prescriptionId)) return response({ error: "invalid prescription id" }, 400, origin ?? "");

  const { data, error } = await admin
    .from("prescriptions")
    .select(`
      id, patient_id, provider_id, pharmacy_id, medication_name, generic_name,
      dosage, frequency, duration_days, refills_remaining, status, fhir_resource,
      clinical_notes, created_at, updated_at,
      patients (id, profile_id, sha_member_number, allergies, profiles(full_name, phone)),
      providers (id, profile_id, licence_number, specialisation, profiles(full_name))
    `)
    .eq("id", prescriptionId)
    .maybeSingle();
  if (error || !data) return response({ error: "prescription not found" }, 404, origin ?? "");
  const prescription = data as unknown as PrescriptionRow;

  if (!serviceRequest && !(await authorize(prescription, userId, admin))) {
    return response({ error: "permission denied" }, 403, origin ?? "");
  }

  if (prescription.fhir_resource) {
    const resource = prescription.fhir_resource;
    return new Response(JSON.stringify(resource), {
      status: 200,
      headers: {
        "Content-Type": "application/fhir+json",
        "Cache-Control": "no-store",
        ETag: await etag(resource),
        ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
      },
    });
  }

  const resource = buildFhirResource(prescription);
  const { error: updateError } = await admin
    .from("prescriptions")
    .update({ fhir_resource: resource })
    .eq("id", prescriptionId);
  if (updateError) return response({ error: "prescription transformation failed" }, 500, origin ?? "");

  return new Response(JSON.stringify(resource), {
    status: 200,
    headers: {
      "Content-Type": "application/fhir+json",
      "Cache-Control": "no-store",
      ETag: await etag(resource),
      ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    },
  });
});
