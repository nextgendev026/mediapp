CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

DO $$
BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS "pg_audit"';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_audit is not available on this PostgreSQL instance';
END;
$$;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('patient','provider','pharmacist','admin','rider')),
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  national_id TEXT UNIQUE,
  odpc_consent_given BOOLEAN NOT NULL DEFAULT FALSE,
  odpc_consent_timestamp TIMESTAMPTZ,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en','sw')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  pharmacy_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ppb_licence_number TEXT UNIQUE NOT NULL,
  ppb_licence_expiry DATE NOT NULL,
  kmhfr_facility_id TEXT UNIQUE NOT NULL,
  pharmacist_registration_number TEXT NOT NULL,
  physical_address TEXT NOT NULL,
  county TEXT NOT NULL,
  gps_lat DECIMAL(10,7) CHECK (gps_lat IS NULL OR gps_lat BETWEEN -90 AND 90),
  gps_lng DECIMAL(10,7) CHECK (gps_lng IS NULL OR gps_lng BETWEEN -180 AND 180),
  delivery_radius_km INTEGER NOT NULL DEFAULT 15 CHECK (delivery_radius_km > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_sha_empanelled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pharmacy_fk
  FOREIGN KEY (pharmacy_id) REFERENCES public.pharmacies(id) ON DELETE SET NULL;

CREATE TABLE public.providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  licence_number TEXT UNIQUE NOT NULL,
  specialisation TEXT NOT NULL,
  telemedicine_registry_id TEXT UNIQUE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  consultation_fee_kes DECIMAL(10,2) CHECK (consultation_fee_kes IS NULL OR consultation_fee_kes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  date_of_birth DATE NOT NULL,
  gender TEXT CHECK (gender IS NULL OR gender IN ('male','female','other','prefer_not_to_say')),
  sha_member_number TEXT UNIQUE,
  blood_type TEXT,
  allergies TEXT[] NOT NULL DEFAULT '{}',
  chronic_conditions TEXT[] NOT NULL DEFAULT '{}',
  primary_county TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  generic_name TEXT,
  swahili_name TEXT,
  category TEXT NOT NULL CHECK (category IN ('prescription','otc','device','supplement')),
  price_kes DECIMAL(10,2) NOT NULL CHECK (price_kes >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reorder_threshold INTEGER NOT NULL DEFAULT 10 CHECK (reorder_threshold >= 0),
  batch_number TEXT,
  expiry_date DATE,
  requires_prescription BOOLEAN NOT NULL DEFAULT FALSE,
  ppb_registration_number TEXT,
  image_url TEXT,
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_search ON public.products USING GIN(search_vector);
CREATE INDEX idx_products_name_trgm ON public.products USING GIN(name gin_trgm_ops);
CREATE INDEX idx_products_expiry ON public.products(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_products_pharmacy ON public.products(pharmacy_id);

CREATE OR REPLACE FUNCTION public.update_product_search()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.generic_name, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.swahili_name, '')), 'A');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_search
BEFORE INSERT OR UPDATE OF name, generic_name, swahili_name ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_product_search();

CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.providers(id),
  pharmacy_id UUID REFERENCES public.pharmacies(id),
  medication_name TEXT NOT NULL,
  generic_name TEXT,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration_days INTEGER CHECK (duration_days IS NULL OR duration_days > 0),
  refills_remaining INTEGER NOT NULL DEFAULT 0 CHECK (refills_remaining >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','dispensed','cancelled','expired')),
  fhir_resource JSONB,
  clinical_notes TEXT,
  sha_claim_status TEXT NOT NULL DEFAULT 'not_submitted' CHECK (sha_claim_status IN ('not_submitted','submitted','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prescriptions_patient ON public.prescriptions(patient_id);
CREATE INDEX idx_prescriptions_status ON public.prescriptions(status);
CREATE INDEX idx_prescriptions_pharmacy ON public.prescriptions(pharmacy_id);

CREATE TABLE public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES public.providers(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled','no_show')),
  consultation_type TEXT CHECK (consultation_type IS NULL OR consultation_type IN ('video','audio','chat')),
  fee_kes DECIMAL(10,2) CHECK (fee_kes IS NULL OR fee_kes >= 0),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','waived','failed')),
  soap_notes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consultations_patient ON public.consultations(patient_id);
CREATE INDEX idx_consultations_provider ON public.consultations(provider_id);
CREATE INDEX idx_consultations_schedule ON public.consultations(scheduled_at);

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  patient_id UUID REFERENCES public.patients(id),
  pharmacy_id UUID REFERENCES public.pharmacies(id),
  prescription_id UUID REFERENCES public.prescriptions(id),
  subtotal_kes DECIMAL(10,2) NOT NULL CHECK (subtotal_kes >= 0),
  delivery_fee_kes DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (delivery_fee_kes >= 0),
  total_kes DECIMAL(10,2) NOT NULL CHECK (total_kes >= 0),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded','partially_refunded')),
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('mpesa','airtel_money','pesalink','card','sha','cash')),
  payment_reference TEXT,
  mpesa_checkout_request_id TEXT,
  mpesa_receipt_number TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending','confirmed','dispatched','in_transit','delivered','failed','cancelled')),
  delivery_method TEXT CHECK (delivery_method IS NULL OR delivery_method IN ('boda','pickup_point','clinic_collection')),
  delivery_address JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(delivery_address) = 'object'),
  rider_id UUID REFERENCES public.profiles(id),
  proof_of_delivery JSONB,
  delivery_otp_hash TEXT,
  dispatch_idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT orders_total_matches CHECK (total_kes = subtotal_kes + delivery_fee_kes)
);

CREATE UNIQUE INDEX idx_orders_dispatch_idempotency
  ON public.orders(dispatch_idempotency_key)
  WHERE dispatch_idempotency_key IS NOT NULL;
CREATE INDEX idx_orders_patient ON public.orders(patient_id);
CREATE INDEX idx_orders_status ON public.orders(delivery_status);
CREATE INDEX idx_orders_number ON public.orders(order_number);
CREATE INDEX idx_orders_rider ON public.orders(rider_id);
CREATE INDEX idx_orders_mpesa_checkout ON public.orders(mpesa_checkout_request_id);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_kes DECIMAL(10,2) NOT NULL CHECK (unit_price_kes >= 0),
  line_total_kes DECIMAL(10,2) NOT NULL CHECK (line_total_kes >= 0)
);

CREATE INDEX idx_order_items_order ON public.order_items(order_id);

CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('mpesa','airtel_money','pesalink','card','sha')),
  provider_reference TEXT,
  amount_kes DECIMAL(10,2) NOT NULL CHECK (amount_kes > 0),
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','pending','succeeded','failed','reversed')),
  request_payload JSONB,
  callback_payload JSONB,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_transactions_order ON public.payment_transactions(order_id);
CREATE INDEX idx_payment_transactions_reference ON public.payment_transactions(provider, provider_reference);

CREATE TABLE public.riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  plate_number TEXT NOT NULL,
  transport_licence_number TEXT NOT NULL,
  transport_licence_expiry DATE NOT NULL,
  county TEXT NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT FALSE,
  current_lat DECIMAL(10,7) CHECK (current_lat IS NULL OR current_lat BETWEEN -90 AND 90),
  current_lng DECIMAL(10,7) CHECK (current_lng IS NULL OR current_lng BETWEEN -180 AND 180),
  last_ping_at TIMESTAMPTZ,
  rating DECIMAL(3,2) NOT NULL DEFAULT 5.00 CHECK (rating BETWEEN 0 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_riders_available ON public.riders(county, is_available);
CREATE INDEX idx_riders_last_ping ON public.riders(last_ping_at DESC);

CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES public.profiles(id),
  actor_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  phi_accessed BOOLEAN NOT NULL DEFAULT FALSE,
  purpose TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor ON public.audit_log(actor_id);
CREATE INDEX idx_audit_resource ON public.audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_timestamp ON public.audit_log(timestamp DESC);
CREATE INDEX idx_audit_phi ON public.audit_log(phi_accessed, timestamp DESC);

CREATE TABLE public.consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('phi_processing','telehealth','prescription_sharing','marketing','research','data_sharing_third_party')),
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  ip_address INET,
  policy_version TEXT NOT NULL,
  CONSTRAINT consent_revocation_order CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE INDEX idx_consent_profile ON public.consent_records(profile_id, consent_type, granted_at DESC);

CREATE TABLE public.sha_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  member_number TEXT NOT NULL,
  service_code TEXT NOT NULL,
  amount_kes DECIMAL(10,2) NOT NULL CHECK (amount_kes > 0),
  external_claim_id TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','approved','rejected','failed')),
  request_payload JSONB,
  response_payload JSONB,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sha_claims_prescription ON public.sha_claims(prescription_id);
CREATE INDEX idx_sha_claims_patient ON public.sha_claims(patient_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pharmacies_updated_at BEFORE UPDATE ON public.pharmacies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_providers_updated_at BEFORE UPDATE ON public.providers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_patients_updated_at BEFORE UPDATE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_prescriptions_updated_at BEFORE UPDATE ON public.prescriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_consultations_updated_at BEFORE UPDATE ON public.consultations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payment_transactions_updated_at BEFORE UPDATE ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_riders_updated_at BEFORE UPDATE ON public.riders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sha_claims_updated_at BEFORE UPDATE ON public.sha_claims
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_actor UUID;
  v_role TEXT;
  v_headers JSONB;
  v_ip INET;
  v_old JSONB;
  v_new JSONB;
  v_resource_id UUID;
  v_phi BOOLEAN;
BEGIN
  v_actor := auth.uid();
  SELECT role INTO v_role FROM public.profiles WHERE id = v_actor;

  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_resource_id := NULLIF(v_new ->> 'id', '')::UUID;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_resource_id := NULLIF(v_new ->> 'id', '')::UUID;
  ELSE
    v_old := to_jsonb(OLD);
    v_resource_id := NULLIF(v_old ->> 'id', '')::UUID;
  END IF;

  BEGIN
    v_headers := current_setting('request.headers', true)::JSONB;
    IF v_headers IS NOT NULL AND v_headers ? 'x-forwarded-for' THEN
      v_ip := split_part(v_headers ->> 'x-forwarded-for', ',', 1)::INET;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  v_phi := TG_TABLE_NAME IN ('patients','prescriptions','consultations','orders','order_items','payment_transactions','consent_records');

  INSERT INTO public.audit_log (
    actor_id, actor_role, action, resource_type, resource_id,
    phi_accessed, purpose, ip_address, metadata
  ) VALUES (
    v_actor,
    v_role,
    CASE WHEN TG_OP = 'INSERT' THEN 'CREATE' ELSE TG_OP END,
    TG_TABLE_NAME,
    v_resource_id,
    v_phi,
    'treatment',
    v_ip,
    jsonb_build_object('old', v_old, 'new', v_new)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_patients AFTER INSERT OR UPDATE OR DELETE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_prescriptions AFTER INSERT OR UPDATE OR DELETE ON public.prescriptions
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_consultations AFTER INSERT OR UPDATE OR DELETE ON public.consultations
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_orders AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_order_items AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_payment_transactions AFTER INSERT OR UPDATE OR DELETE ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_consent_records AFTER INSERT OR UPDATE OR DELETE ON public.consent_records
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$;

CREATE TRIGGER audit_log_immutable
BEFORE UPDATE OR DELETE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

DROP RULE IF EXISTS audit_log_no_update ON public.audit_log;
DROP RULE IF EXISTS audit_log_no_delete ON public.audit_log;
CREATE RULE audit_log_no_update AS ON UPDATE TO public.audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO public.audit_log DO INSTEAD NOTHING;

CREATE OR REPLACE FUNCTION public.record_audit_event(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_phi_accessed BOOLEAN DEFAULT FALSE,
  p_purpose TEXT DEFAULT 'treatment',
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_actor UUID;
  v_role TEXT;
  v_ip INET;
  v_id UUID;
  v_phi BOOLEAN;
  v_metadata JSONB;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_action IS NULL OR p_action !~ '^[A-Z][A-Z0-9_]{1,63}$' THEN
    RAISE EXCEPTION 'invalid audit action';
  END IF;
  IF p_resource_type IS NULL OR p_resource_type !~ '^[a-z][a-z0-9_]{1,63}$' THEN
    RAISE EXCEPTION 'invalid resource type';
  END IF;
  IF p_purpose IS NULL OR p_purpose !~ '^[a-z][a-z0-9_]{1,31}$' THEN
    RAISE EXCEPTION 'invalid audit purpose';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_actor;
  v_phi := COALESCE(p_phi_accessed, FALSE) OR p_resource_type IN ('patient','prescription','consultation','order','soap_note','medical_record');
  v_metadata := COALESCE(p_metadata, '{}'::JSONB);
  IF jsonb_typeof(v_metadata) <> 'object' OR octet_length(v_metadata::TEXT) > 8192 THEN
    RAISE EXCEPTION 'invalid audit metadata';
  END IF;

  BEGIN
    v_ip := NULLIF(p_ip_address, '')::INET;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  INSERT INTO public.audit_log (
    actor_id, actor_role, action, resource_type, resource_id,
    phi_accessed, purpose, ip_address, user_agent, metadata
  ) VALUES (
    v_actor, v_role, p_action, p_resource_type, p_resource_id,
    v_phi, p_purpose, v_ip, left(p_user_agent, 512), v_metadata
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE
$$;

CREATE OR REPLACE FUNCTION public.current_pharmacy_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT pharmacy_id FROM public.profiles WHERE id = auth.uid() AND role = 'pharmacist' AND is_active = TRUE
$$;

CREATE OR REPLACE FUNCTION public.current_provider_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT id FROM public.providers WHERE profile_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_patient_treatment_access(p_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.consultations c
      JOIN public.providers p ON p.id = c.provider_id
      WHERE c.patient_id = p_patient_id AND p.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.prescriptions rx
      WHERE rx.patient_id = p_patient_id
        AND rx.pharmacy_id = public.current_pharmacy_id()
    )
$$;

CREATE OR REPLACE FUNCTION public.is_order_owner(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.patients pt ON pt.id = o.patient_id
    WHERE o.id = p_order_id AND pt.profile_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_order(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
  SELECT
    public.is_order_owner(p_order_id)
    OR public.current_role_name() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = p_order_id
        AND o.pharmacy_id = public.current_pharmacy_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = p_order_id
        AND o.rider_id = auth.uid()
    )
$$;

CREATE OR REPLACE FUNCTION public.is_service_request()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(auth.role(), current_setting('request.jwt.claim.role', true)) = 'service_role'
$$;

CREATE OR REPLACE FUNCTION public.dispatch_order(
  p_order_id UUID,
  p_idempotency_key TEXT
)
RETURNS TABLE (
  rider_id UUID,
  rider_phone TEXT,
  pickup JSONB,
  dropoff JSONB,
  already_assigned BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_pharmacy public.pharmacies%ROWTYPE;
  v_rider_id UUID;
  v_rider_profile_id UUID;
  v_rider_phone TEXT;
  v_existing BOOLEAN;
BEGIN
  IF p_order_id IS NULL OR p_idempotency_key IS NULL OR length(p_idempotency_key) < 8 OR length(p_idempotency_key) > 128 THEN
    RAISE EXCEPTION 'invalid dispatch request';
  END IF;
  IF NOT public.is_service_request() AND public.current_role_name() NOT IN ('admin','pharmacist') THEN
    RAISE EXCEPTION 'dispatch permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;
  SELECT * INTO v_pharmacy FROM public.pharmacies WHERE id = v_order.pharmacy_id;
  IF v_pharmacy.id IS NULL OR v_order.delivery_method IS DISTINCT FROM 'boda' THEN
    RAISE EXCEPTION 'order is not eligible for boda dispatch';
  END IF;

  IF v_order.dispatch_idempotency_key IS NOT NULL AND v_order.dispatch_idempotency_key <> p_idempotency_key THEN
    RAISE EXCEPTION 'order is already assigned to another dispatch request';
  END IF;

  IF v_order.rider_id IS NOT NULL THEN
    SELECT p.id, p.phone INTO v_rider_profile_id, v_rider_phone
    FROM public.profiles p WHERE p.id = v_order.rider_id;
    RETURN QUERY SELECT v_order.rider_id, v_rider_phone,
      jsonb_build_object('lat', v_pharmacy.gps_lat, 'lng', v_pharmacy.gps_lng, 'pharmacy_id', v_pharmacy.id),
      v_order.delivery_address, TRUE;
    RETURN;
  END IF;

  IF v_order.delivery_status NOT IN ('pending','confirmed') THEN
    RAISE EXCEPTION 'order is not dispatchable';
  END IF;

  SELECT
    r.id,
    p.id,
    p.phone
  INTO v_rider_id, v_rider_profile_id, v_rider_phone
  FROM public.riders r
  JOIN public.profiles p ON p.id = r.profile_id
  WHERE r.county = v_pharmacy.county
    AND r.is_available = TRUE
    AND p.is_active = TRUE
    AND r.transport_licence_expiry >= CURRENT_DATE
  ORDER BY r.last_ping_at DESC NULLS LAST, r.rating DESC, r.id
  FOR UPDATE OF r SKIP LOCKED
  LIMIT 1;

  IF v_rider_id IS NULL THEN
    RAISE EXCEPTION 'NO_RIDERS_AVAILABLE';
  END IF;

  UPDATE public.riders SET is_available = FALSE WHERE id = v_rider_id;
  UPDATE public.orders
  SET rider_id = v_rider_profile_id,
      delivery_status = 'dispatched',
      dispatch_idempotency_key = p_idempotency_key
  WHERE id = p_order_id;

  RETURN QUERY SELECT v_rider_profile_id, v_rider_phone,
    jsonb_build_object('lat', v_pharmacy.gps_lat, 'lng', v_pharmacy.gps_lng, 'pharmacy_id', v_pharmacy.id),
    v_order.delivery_address, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_dispatch_order(
  p_order_id UUID,
  p_rider_profile_id UUID
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF p_order_id IS NULL OR p_rider_profile_id IS NULL THEN
    RAISE EXCEPTION 'invalid dispatch acceptance';
  END IF;
  IF NOT public.is_service_request() AND NOT (public.current_role_name() = 'rider' AND auth.uid() = p_rider_profile_id) THEN
    RAISE EXCEPTION 'dispatch acceptance permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.rider_id IS DISTINCT FROM p_rider_profile_id THEN
    RAISE EXCEPTION 'order is not assigned to rider';
  END IF;
  IF v_order.delivery_status NOT IN ('dispatched','in_transit') THEN
    RAISE EXCEPTION 'order cannot be accepted';
  END IF;
  IF v_order.delivery_status = 'dispatched' THEN
    UPDATE public.orders SET delivery_status = 'in_transit' WHERE id = p_order_id RETURNING * INTO v_order;
  END IF;
  RETURN v_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_delivery_proof(
  p_order_id UUID,
  p_rider_profile_id UUID,
  p_photo_url TEXT,
  p_otp_verified BOOLEAN,
  p_gps_lat DECIMAL(10,7),
  p_gps_lng DECIMAL(10,7),
  p_delivered_at TIMESTAMPTZ
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_timestamp TIMESTAMPTZ;
BEGIN
  IF NOT public.is_service_request() THEN
    RAISE EXCEPTION 'proof submission permission denied' USING ERRCODE = '42501';
  END IF;
  IF p_order_id IS NULL OR p_rider_profile_id IS NULL OR p_photo_url IS NULL OR p_otp_verified IS NOT TRUE THEN
    RAISE EXCEPTION 'photo and verified OTP are required';
  END IF;
  IF p_photo_url !~ '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'invalid proof URL';
  END IF;
  IF p_gps_lat IS NULL OR p_gps_lng IS NULL OR p_gps_lat NOT BETWEEN -90 AND 90 OR p_gps_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'valid delivery coordinates are required';
  END IF;

  v_timestamp := COALESCE(p_delivered_at, NOW());
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.rider_id IS DISTINCT FROM p_rider_profile_id THEN
    RAISE EXCEPTION 'order is not assigned to rider';
  END IF;
  IF v_order.delivery_status NOT IN ('in_transit','dispatched','delivered') THEN
    RAISE EXCEPTION 'order is not deliverable';
  END IF;

  UPDATE public.orders
  SET delivery_status = 'delivered',
      delivery_otp_hash = NULL,
      proof_of_delivery = jsonb_build_object(
        'photo_url', p_photo_url,
        'otp_verified', TRUE,
        'gps_at_delivery', jsonb_build_object('lat', p_gps_lat, 'lng', p_gps_lng),
        'timestamp', v_timestamp
      )
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  UPDATE public.riders
  SET is_available = TRUE, current_lat = p_gps_lat, current_lng = p_gps_lng, last_ping_at = v_timestamp
  WHERE profile_id = p_rider_profile_id;

  RETURN v_order;
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sha_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_self_insert ON public.profiles
FOR INSERT WITH CHECK (id = auth.uid() AND role = 'patient' AND is_active = TRUE);

CREATE POLICY profiles_self_read ON public.profiles
FOR SELECT USING (id = auth.uid());

CREATE POLICY profiles_self_update ON public.profiles
FOR UPDATE USING (id = auth.uid() AND is_active = TRUE)
WITH CHECK (id = auth.uid() AND role = public.current_role_name() AND is_active = TRUE);

CREATE POLICY profiles_admin_all ON public.profiles
FOR ALL USING (public.current_role_name() = 'admin')
WITH CHECK (public.current_role_name() = 'admin');

CREATE POLICY patients_own_record ON public.patients
FOR ALL USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

CREATE POLICY patients_treating_provider ON public.patients
FOR SELECT USING (
  public.current_role_name() = 'provider'
  AND public.has_patient_treatment_access(id)
);

CREATE POLICY patients_dispensing_pharmacist ON public.patients
FOR SELECT USING (
  public.current_role_name() = 'pharmacist'
  AND public.has_patient_treatment_access(id)
);

CREATE POLICY patients_admin_read ON public.patients
FOR SELECT USING (public.current_role_name() = 'admin');

CREATE POLICY prescriptions_patient_read ON public.prescriptions
FOR SELECT USING (
  patient_id IN (SELECT id FROM public.patients WHERE profile_id = auth.uid())
);

CREATE POLICY prescriptions_provider_read ON public.prescriptions
FOR SELECT USING (provider_id = public.current_provider_id());

CREATE POLICY prescriptions_provider_insert ON public.prescriptions
FOR INSERT WITH CHECK (provider_id = public.current_provider_id());

CREATE POLICY prescriptions_provider_update ON public.prescriptions
FOR UPDATE USING (provider_id = public.current_provider_id())
WITH CHECK (provider_id = public.current_provider_id());

CREATE POLICY prescriptions_pharmacist_read ON public.prescriptions
FOR SELECT USING (
  public.current_role_name() = 'pharmacist'
  AND pharmacy_id = public.current_pharmacy_id()
);

CREATE POLICY prescriptions_pharmacist_dispense ON public.prescriptions
FOR UPDATE USING (
  public.current_role_name() = 'pharmacist'
  AND pharmacy_id = public.current_pharmacy_id()
)
WITH CHECK (
  pharmacy_id = public.current_pharmacy_id()
  AND status IN ('approved','dispensed')
);

CREATE POLICY prescriptions_admin_read ON public.prescriptions
FOR SELECT USING (public.current_role_name() = 'admin');

CREATE POLICY consultations_patient_read ON public.consultations
FOR SELECT USING (
  patient_id IN (SELECT id FROM public.patients WHERE profile_id = auth.uid())
);

CREATE POLICY consultations_provider_manage ON public.consultations
FOR ALL USING (provider_id = public.current_provider_id())
WITH CHECK (provider_id = public.current_provider_id());

CREATE POLICY consultations_admin_read ON public.consultations
FOR SELECT USING (public.current_role_name() = 'admin');

CREATE POLICY orders_patient_read ON public.orders
FOR SELECT USING (public.is_order_owner(id));

CREATE POLICY orders_patient_create ON public.orders
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = patient_id
      AND p.profile_id = auth.uid()
  )
  AND pharmacy_id IS NOT NULL
  AND payment_status = 'pending'
  AND delivery_status = 'pending'
);

CREATE POLICY orders_pharmacist_read ON public.orders
FOR SELECT USING (
  public.current_role_name() = 'pharmacist'
  AND pharmacy_id = public.current_pharmacy_id()
);

CREATE POLICY orders_pharmacist_update ON public.orders
FOR UPDATE USING (
  public.current_role_name() = 'pharmacist'
  AND pharmacy_id = public.current_pharmacy_id()
)
WITH CHECK (
  pharmacy_id = public.current_pharmacy_id()
  AND delivery_status IN ('confirmed','dispatched','cancelled')
);

CREATE POLICY orders_rider_read ON public.orders
FOR SELECT USING (rider_id = auth.uid() AND public.current_role_name() = 'rider');

CREATE POLICY orders_rider_update ON public.orders
FOR UPDATE USING (rider_id = auth.uid() AND public.current_role_name() = 'rider')
WITH CHECK (delivery_status IN ('in_transit','delivered','failed'));

CREATE POLICY orders_admin_read ON public.orders
FOR SELECT USING (public.current_role_name() = 'admin');

CREATE POLICY order_items_patient_read ON public.order_items
FOR SELECT USING (public.is_order_owner(order_id));

CREATE POLICY order_items_patient_insert ON public.order_items
FOR INSERT WITH CHECK (public.is_order_owner(order_id));

CREATE POLICY order_items_pharmacist_read ON public.order_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
      AND o.pharmacy_id = public.current_pharmacy_id()
  )
);

CREATE POLICY order_items_pharmacist_insert ON public.order_items
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
      AND o.pharmacy_id = public.current_pharmacy_id()
  )
);

CREATE POLICY order_items_admin_read ON public.order_items
FOR SELECT USING (public.current_role_name() = 'admin');

CREATE POLICY products_public_read ON public.products
FOR SELECT USING (TRUE);

CREATE POLICY products_pharmacist_manage ON public.products
FOR ALL USING (
  public.current_role_name() = 'pharmacist'
  AND pharmacy_id = public.current_pharmacy_id()
)
WITH CHECK (
  public.current_role_name() = 'pharmacist'
  AND pharmacy_id = public.current_pharmacy_id()
);

CREATE POLICY pharmacies_public_read ON public.pharmacies
FOR SELECT USING (is_active = TRUE);

CREATE POLICY pharmacies_pharmacist_manage ON public.pharmacies
FOR ALL USING (
  public.current_role_name() = 'pharmacist'
  AND id = public.current_pharmacy_id()
)
WITH CHECK (id = public.current_pharmacy_id());

CREATE POLICY pharmacies_admin_manage ON public.pharmacies
FOR ALL USING (public.current_role_name() = 'admin')
WITH CHECK (public.current_role_name() = 'admin');

CREATE POLICY providers_public_read ON public.providers
FOR SELECT USING (TRUE);

CREATE POLICY providers_self_update ON public.providers
FOR UPDATE USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

CREATE POLICY providers_admin_manage ON public.providers
FOR ALL USING (public.current_role_name() = 'admin')
WITH CHECK (public.current_role_name() = 'admin');

CREATE POLICY riders_self_read ON public.riders
FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY riders_self_update ON public.riders
FOR UPDATE USING (profile_id = auth.uid() AND public.current_role_name() = 'rider')
WITH CHECK (profile_id = auth.uid());

CREATE POLICY riders_staff_read ON public.riders
FOR SELECT USING (public.current_role_name() IN ('pharmacist','admin'));

CREATE POLICY audit_admin_read ON public.audit_log
FOR SELECT USING (public.current_role_name() = 'admin');

CREATE POLICY audit_no_direct_insert ON public.audit_log
FOR INSERT WITH CHECK (FALSE);

CREATE POLICY consent_patient_manage ON public.consent_records
FOR ALL USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

CREATE POLICY consent_admin_read ON public.consent_records
FOR SELECT USING (public.current_role_name() = 'admin');

CREATE POLICY payment_patient_read ON public.payment_transactions
FOR SELECT USING (public.is_order_owner(order_id));

CREATE POLICY payment_pharmacist_read ON public.payment_transactions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
      AND o.pharmacy_id = public.current_pharmacy_id()
  )
);

CREATE POLICY payment_admin_read ON public.payment_transactions
FOR SELECT USING (public.current_role_name() = 'admin');

CREATE POLICY sha_claims_patient_read ON public.sha_claims
FOR SELECT USING (
  patient_id IN (SELECT id FROM public.patients WHERE profile_id = auth.uid())
);

CREATE POLICY sha_claims_staff_read ON public.sha_claims
FOR SELECT USING (public.current_role_name() IN ('pharmacist','admin'));

CREATE OR REPLACE VIEW public.inventory_alerts
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.name,
  p.pharmacy_id,
  p.stock_quantity,
  p.reorder_threshold,
  p.expiry_date,
  CASE
    WHEN p.stock_quantity <= p.reorder_threshold THEN 'LOW_STOCK'
    WHEN p.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'NEAR_EXPIRY'
    WHEN p.expiry_date <= CURRENT_DATE THEN 'EXPIRED'
    ELSE 'OK'
  END AS alert_type
FROM public.products p
WHERE p.stock_quantity <= p.reorder_threshold
   OR p.expiry_date <= CURRENT_DATE + INTERVAL '30 days';

ALTER FUNCTION public.record_audit_event(TEXT,TEXT,UUID,BOOLEAN,TEXT,TEXT,TEXT,JSONB) OWNER TO postgres;
ALTER FUNCTION public.dispatch_order(UUID,TEXT) OWNER TO postgres;
ALTER FUNCTION public.accept_dispatch_order(UUID,UUID) OWNER TO postgres;
ALTER FUNCTION public.record_delivery_proof(UUID,UUID,TEXT,BOOLEAN,DECIMAL,DECIMAL,TIMESTAMPTZ) OWNER TO postgres;
