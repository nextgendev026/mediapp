-- Audit-log retention, inventory alert ordering and rider credential guards.
--
-- 1. The DO INSTEAD NOTHING rules on public.audit_log rewrote purge_expired_patient_data()'s
--    DELETE into a no-op, so audit rows were never purged and the job still reported success.
--    The rules are redundant with prevent_audit_mutation(); drop them and let the trigger
--    decide, gated on a transaction-local flag only the retention function can set.
-- 2. inventory_alerts tested NEAR_EXPIRY before EXPIRED, so an expired batch could never
--    be reported as EXPIRED.
-- 3. riders_self_update is FOR ALL with no column restriction, so a rider could rewrite
--    their own rating and extend an expired transport licence.

DROP RULE IF EXISTS audit_log_no_update ON public.audit_log;
DROP RULE IF EXISTS audit_log_no_delete ON public.audit_log;

CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('afya.retention_purge', true) = 'on'
     AND pg_has_role(current_user, 'postgres', 'MEMBER') THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit_log is append-only' USING ERRCODE = '42501';
END;
$$;

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
      phone = '+2540000000' || right(replace(p.id::TEXT, '-', ''), 4),
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
      chronic_conditions = '{}'::TEXT[]
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

  PERFORM set_config('afya.retention_purge', 'on', true);
  BEGIN
    DELETE FROM public.audit_log
    WHERE timestamp < v_cutoff - make_interval(days => 30);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('afya.retention_purge', 'off', true);
    RAISE;
  END;
  PERFORM set_config('afya.retention_purge', 'off', true);

  RETURN QUERY SELECT v_profiles, v_patients, v_orders;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_patient_data(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_patient_data(INTEGER) TO service_role;
ALTER FUNCTION public.purge_expired_patient_data(INTEGER) OWNER TO postgres;

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
    WHEN p.expiry_date IS NOT NULL AND p.expiry_date <= CURRENT_DATE THEN 'EXPIRED'
    WHEN p.stock_quantity <= p.reorder_threshold THEN 'LOW_STOCK'
    WHEN p.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'NEAR_EXPIRY'
    ELSE 'OK'
  END AS alert_type
FROM public.products p
WHERE p.stock_quantity <= p.reorder_threshold
   OR p.expiry_date <= CURRENT_DATE + INTERVAL '30 days';

CREATE OR REPLACE FUNCTION public.protect_rider_credentials()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.current_role_name() = 'admin' THEN
    RETURN NEW;
  END IF;
  IF NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.plate_number IS DISTINCT FROM OLD.plate_number
     OR NEW.transport_licence_number IS DISTINCT FROM OLD.transport_licence_number
     OR NEW.transport_licence_expiry IS DISTINCT FROM OLD.transport_licence_expiry
     OR NEW.county IS DISTINCT FROM OLD.county THEN
    RAISE EXCEPTION 'rider credentials can only be changed by an administrator' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_rider_credentials
BEFORE UPDATE ON public.riders
FOR EACH ROW EXECUTE FUNCTION public.protect_rider_credentials();
