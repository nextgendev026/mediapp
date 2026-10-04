-- AfyaCommerce follow-up migration
-- Catalog identifiers, consent-on-registration, server-side order creation, and retention controls.

DO $$
BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS "pg_cron"';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron is not available; schedule the retention job from the platform scheduler instead';
END;
$$;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE public.products SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_slug_format') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_slug_format CHECK (slug IS NULL OR slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON public.products (slug) WHERE slug IS NOT NULL;

-- Consent policy version is recorded with every grant so a policy change can be detected later.
CREATE TABLE IF NOT EXISTS public.consent_policy_versions (
  version TEXT PRIMARY KEY,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

INSERT INTO public.consent_policy_versions (version, notes)
VALUES ('1.0.0', 'Initial ODPC-aligned processing consent for treatment, delivery and pharmacy fulfilment.')
ON CONFLICT (version) DO NOTHING;

CREATE OR REPLACE FUNCTION public.active_consent_policy_version()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT version FROM public.consent_policy_versions ORDER BY effective_from DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_full_name TEXT;
  v_phone TEXT;
  v_role TEXT;
  v_profile_id UUID;
  v_patient_id UUID;
  v_consent BOOLEAN;
BEGIN
  v_phone := NULLIF(regexp_replace(COALESCE(NEW.phone, ''), '\D', '', 'g'), '');
  IF v_phone IS NULL THEN
    v_phone := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g'), '');
  END IF;
  IF v_phone IS NULL OR length(v_phone) < 9 THEN
    RETURN NEW;
  END IF;

  v_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    'Patient ' || right(v_phone, 4)
  );

  v_role := 'patient';

  v_consent := COALESCE(
    (NEW.raw_user_meta_data ->> 'phi_consent')::BOOLEAN,
    (NEW.raw_user_meta_data ->> 'odpc_consent_given')::BOOLEAN,
    FALSE
  );

  INSERT INTO public.profiles (id, role, full_name, phone, email, odpc_consent_given, odpc_consent_timestamp, mfa_enabled, preferred_language, is_active)
  VALUES (
    NEW.id,
    v_role,
    v_full_name,
    v_phone,
    NULLIF(NEW.email, ''),
    v_consent,
    CASE WHEN v_consent THEN NOW() ELSE NULL END,
    NEW.raw_user_meta_data ->> 'mfa_enabled' = 'true',
    CASE WHEN NEW.raw_user_meta_data ->> 'preferred_language' = 'sw' THEN 'sw' ELSE 'en' END,
    TRUE
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_profile_id;

  IF v_profile_id IS NULL THEN
    SELECT id INTO v_profile_id FROM public.profiles WHERE id = NEW.id;
  END IF;
  IF v_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.consent_records (profile_id, consent_type, granted, granted_at, policy_version)
  SELECT v_profile_id, 'phi_processing', TRUE, NOW(), public.active_consent_policy_version()
  WHERE v_consent
    AND NOT EXISTS (
      SELECT 1 FROM public.consent_records
      WHERE profile_id = v_profile_id
        AND consent_type = 'phi_processing'
        AND granted = TRUE
        AND revoked_at IS NULL
    );

  INSERT INTO public.patients (profile_id)
  VALUES (v_profile_id)
  ON CONFLICT (profile_id) DO NOTHING
  RETURNING id INTO v_patient_id;

  RAISE NOTICE 'AfyaCommerce created profile % for new user %', v_profile_id, NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.create_order(
  p_items JSONB,
  p_delivery_address JSONB DEFAULT '{}'::JSONB,
  p_delivery_method TEXT DEFAULT 'boda',
  p_delivery_fee_kes NUMERIC(10,2) DEFAULT 0
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_patient_id UUID;
  v_order public.orders%ROWTYPE;
  v_item JSONB;
  v_product public.products%ROWTYPE;
  v_slug TEXT;
  v_quantity INTEGER;
  v_subtotal NUMERIC(10,2) := 0;
  v_fee NUMERIC(10,2) := 0;
  v_pharmacy_id UUID;
  v_prescription_id UUID;
  v_sequence BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF public.current_role_name() IS DISTINCT FROM 'patient' THEN
    RAISE EXCEPTION 'only patient accounts can place orders' USING ERRCODE = '42501';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'order requires at least one item';
  END IF;
  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'too many line items';
  END IF;
  IF p_delivery_address IS NULL OR jsonb_typeof(p_delivery_address) <> 'object' THEN
    RAISE EXCEPTION 'delivery address must be an object';
  END IF;
  IF p_delivery_method IS NULL OR p_delivery_method NOT IN ('boda','pickup_point','clinic_collection') THEN
    RAISE EXCEPTION 'unsupported delivery method';
  END IF;
  IF p_delivery_method <> 'pickup_point' THEN
    IF COALESCE(p_delivery_address ->> 'phone', '') = '' OR COALESCE(p_delivery_address ->> 'landmark', '') = '' OR COALESCE(p_delivery_address ->> 'county', '') = '' THEN
      RAISE EXCEPTION 'delivery address requires phone, landmark and county';
    END IF;
    IF COALESCE(p_delivery_address ->> 'county', '') !~* 'nairobi|mombasa|kisumu|nakuru|eldoret|thika|malindi|naivasha|kitale|garissa|kakamega|meru|kericho|nakuru' THEN
      RAISE EXCEPTION 'delivery is not available in the selected county';
    END IF;
  END IF;

  v_fee := GREATEST(COALESCE(p_delivery_fee_kes, 0), 0);
  IF v_fee > 5000 THEN
    RAISE EXCEPTION 'delivery fee is out of range';
  END IF;

  SELECT id INTO v_patient_id FROM public.patients WHERE profile_id = auth.uid();
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'patient record is missing' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.consent_records
    WHERE profile_id = auth.uid()
      AND consent_type = 'phi_processing'
      AND granted = TRUE
      AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'processing consent is required before an order can be placed' USING ERRCODE = '42501';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_slug := lower(trim(COALESCE(v_item ->> 'slug', '')));
    v_quantity := COALESCE((v_item ->> 'quantity')::INTEGER, 0);
    IF v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
      RAISE EXCEPTION 'invalid product reference';
    END IF;
    IF v_quantity < 1 OR v_quantity > 99 THEN
      RAISE EXCEPTION 'invalid quantity for %', v_slug;
    END IF;

    SELECT * INTO v_product FROM public.products WHERE slug = v_slug FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'product % is not available', v_slug;
    END IF;
    IF v_product.stock_quantity < v_quantity THEN
      RAISE EXCEPTION 'insufficient stock for %', v_product.name;
    END IF;
    IF v_product.requires_prescription AND p_delivery_method IS DISTINCT FROM 'clinic_collection' THEN
      RAISE EXCEPTION '% requires a valid prescription', v_product.name;
    END IF;
    IF v_product.expiry_date IS NOT NULL AND v_product.expiry_date <= CURRENT_DATE THEN
      RAISE EXCEPTION '% has expired and cannot be dispensed', v_product.name;
    END IF;
    IF v_pharmacy_id IS NULL THEN
      v_pharmacy_id := v_product.pharmacy_id;
    ELSIF v_pharmacy_id IS DISTINCT FROM v_product.pharmacy_id THEN
      RAISE EXCEPTION 'all items in one order must come from the same pharmacy';
    END IF;

    v_subtotal := v_subtotal + (v_product.price_kes * v_quantity);
  END LOOP;

  IF v_pharmacy_id IS NULL THEN
    RAISE EXCEPTION 'order could not be assigned to a pharmacy';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.pharmacies WHERE id = v_pharmacy_id AND is_active = TRUE) THEN
    RAISE EXCEPTION 'pharmacy is not currently accepting orders';
  END IF;

  SELECT COALESCE(MAX(substring(order_number from '^AFY-[0-9]{4}-([0-9]+)$')::BIGINT), 0) + 1
    INTO v_sequence
  FROM public.orders
  WHERE order_number ~ '^AFY-[0-9]{4}-[0-9]+$'
    AND substring(order_number from '^AFY-([0-9]{4})-')::INTEGER = EXTRACT(YEAR FROM NOW())::INTEGER;

  INSERT INTO public.orders (
    order_number, patient_id, pharmacy_id, subtotal_kes, delivery_fee_kes, total_kes,
    payment_status, delivery_status, delivery_method, delivery_address
  ) VALUES (
    format('AFY-%s-%s', to_char(NOW(), 'YYYY'), lpad(v_sequence::TEXT, 6, '0')),
    v_patient_id,
    v_pharmacy_id,
    v_subtotal,
    v_fee,
    v_subtotal + v_fee,
    'pending',
    'pending',
    p_delivery_method,
    p_delivery_address
  )
  RETURNING * INTO v_order;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_slug := lower(trim(COALESCE(v_item ->> 'slug', '')));
    v_quantity := COALESCE((v_item ->> 'quantity')::INTEGER, 0);
    SELECT * INTO v_product FROM public.products WHERE slug = v_slug FOR UPDATE;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price_kes, line_total_kes)
    VALUES (v_order.id, v_product.id, v_quantity, v_product.price_kes, v_product.price_kes * v_quantity);
    UPDATE public.products
    SET stock_quantity = stock_quantity - v_quantity
    WHERE id = v_product.id;
  END LOOP;

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(JSONB, JSONB, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(JSONB, JSONB, TEXT, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_order(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_dispatch_order(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_delivery_proof(UUID, UUID, TEXT, BOOLEAN, DECIMAL, DECIMAL, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_order(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_dispatch_order(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_delivery_proof(UUID, UUID, TEXT, BOOLEAN, DECIMAL, DECIMAL, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_audit_event(TEXT, TEXT, UUID, BOOLEAN, TEXT, TEXT, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.purge_expired_patient_data(p_retention_days INTEGER DEFAULT 2190)
RETURNS TABLE (
  profiles_purged BIGINT,
  patients_purged BIGINT,
  orders_purged BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_days INTEGER;
  v_cutoff TIMESTAMPTZ;
  v_profiles BIGINT := 0;
  v_patients BIGINT := 0;
  v_orders BIGINT := 0;
BEGIN
  IF NOT public.is_service_request() THEN
    RAISE EXCEPTION 'retention job requires service credentials' USING ERRCODE = '42501';
  END IF;

  v_days := GREATEST(COALESCE(p_retention_days, 2190), 365);
  v_cutoff := NOW() - make_interval(days => v_days);

  UPDATE public.profiles p
  SET full_name = 'Archived patient',
      phone = '+2549' || right(replace(p.id::TEXT, '-', ''), 8),
      email = NULL,
      national_id = NULL,
      is_active = FALSE
  WHERE p.created_at < v_cutoff
    AND p.role = 'patient'
    AND EXISTS (
      SELECT 1 FROM public.patients pt WHERE pt.profile_id = p.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.patient_id IN (SELECT id FROM public.patients WHERE profile_id = p.id)
        AND o.created_at >= v_cutoff
    );

  GET DIAGNOSTICS v_profiles = ROW_COUNT;

  UPDATE public.patients pt
  SET sha_member_number = NULL,
      allergies = '{}'::TEXT[],
      chronic_conditions = '{}'::TEXT[],
      date_of_birth = DATE '1900-01-01'
  WHERE pt.created_at < v_cutoff
    AND NOT EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.patient_id = pt.id
        AND o.created_at >= v_cutoff
    );

  GET DIAGNOSTICS v_patients = ROW_COUNT;

  UPDATE public.orders o
  SET delivery_address = jsonb_build_object('archived', TRUE),
      proof_of_delivery = NULL,
      delivery_otp_hash = NULL
  WHERE o.created_at < v_cutoff;

  GET DIAGNOSTICS v_orders = ROW_COUNT;

  DELETE FROM public.audit_log
  WHERE timestamp < v_cutoff - make_interval(days => 30);

  RETURN QUERY SELECT v_profiles, v_patients, v_orders;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_patient_data(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_patient_data(INTEGER) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('afya-retention-purge', '17 3 * * *', $$SELECT public.purge_expired_patient_data(2190)$$);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'retention schedule not registered: %', SQLERRM;
END;
$$;

ALTER FUNCTION public.create_order(JSONB, JSONB, TEXT, NUMERIC) OWNER TO postgres;
ALTER FUNCTION public.handle_new_auth_user() OWNER TO postgres;
ALTER FUNCTION public.purge_expired_patient_data(INTEGER) OWNER TO postgres;
