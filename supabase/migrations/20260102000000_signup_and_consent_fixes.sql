-- Fixes for the signup and consent-write paths.
--
-- 1. handle_new_auth_user() inserted into public.patients with only profile_id, but
--    patients.date_of_birth is NOT NULL with no default. Every auth.users insert fired
--    the trigger, raised 23502 and aborted the transaction, so signUp() always failed.
-- 2. Phone numbers were stored digit-only ("2547...") while every other layer
--    (register page, workers, seed) uses E.164 ("+2547..."). profiles.phone is UNIQUE,
--    so a real signup could collide with a seeded profile.
-- 3. consent_records.policy_version is NOT NULL with no default, so any client that
--    inserts a consent record without it gets a 400.

ALTER TABLE public.patients
  ALTER COLUMN date_of_birth DROP NOT NULL;

ALTER TABLE public.consent_records
  ALTER COLUMN policy_version SET DEFAULT public.active_consent_policy_version();

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
  v_digits TEXT;
  v_full_name TEXT;
  v_phone TEXT;
  v_dob DATE;
  v_profile_id UUID;
  v_patient_id UUID;
  v_consent BOOLEAN;
BEGIN
  v_digits := regexp_replace(
    COALESCE(NULLIF(NEW.phone, ''), NEW.raw_user_meta_data ->> 'phone', ''),
    '\D', '', 'g'
  );
  IF v_digits ~ '^0' THEN
    v_digits := '254' || substr(v_digits, 2);
  END IF;
  IF v_digits !~ '^254[17][0-9]{8}$' THEN
    RETURN NEW;
  END IF;
  v_phone := '+' || v_digits;

  v_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    'Patient ' || right(v_digits, 4)
  );

  v_dob := NULLIF(NEW.raw_user_meta_data ->> 'date_of_birth', '')::DATE;

  v_consent := COALESCE(
    CASE WHEN lower(NEW.raw_user_meta_data ->> 'phi_consent') IN ('true', '1', 'yes') THEN TRUE
         WHEN lower(NEW.raw_user_meta_data ->> 'phi_consent') IN ('false', '0', 'no') THEN FALSE
    END,
    CASE WHEN lower(NEW.raw_user_meta_data ->> 'odpc_consent_given') IN ('true', '1', 'yes') THEN TRUE
         WHEN lower(NEW.raw_user_meta_data ->> 'odpc_consent_given') IN ('false', '0', 'no') THEN FALSE
    END,
    FALSE
  );

  INSERT INTO public.profiles (id, role, full_name, phone, email, odpc_consent_given, odpc_consent_timestamp, mfa_enabled, preferred_language, is_active)
  VALUES (
    NEW.id,
    'patient',
    v_full_name,
    v_phone,
    NULLIF(NEW.email, ''),
    v_consent,
    CASE WHEN v_consent THEN NOW() ELSE NULL END,
    COALESCE(lower(NEW.raw_user_meta_data ->> 'mfa_enabled') = 'true', FALSE),
    CASE WHEN lower(NEW.raw_user_meta_data ->> 'preferred_language') = 'sw' THEN 'sw' ELSE 'en' END,
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

  INSERT INTO public.patients (profile_id, date_of_birth)
  VALUES (v_profile_id, v_dob)
  ON CONFLICT (profile_id) DO NOTHING
  RETURNING id INTO v_patient_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
ALTER FUNCTION public.handle_new_auth_user() OWNER TO postgres;
