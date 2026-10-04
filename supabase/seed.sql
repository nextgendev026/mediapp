INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  phone,
  phone_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'patient@afyacommerce.test', crypt(gen_random_uuid()::TEXT, gen_salt('bf')), NOW(), '+254700000001', NOW(), '{"provider":"email","providers":["email"]}'::JSONB, '{"role":"patient"}'::JSONB, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'provider@afyacommerce.test', crypt(gen_random_uuid()::TEXT, gen_salt('bf')), NOW(), '+254700000002', NOW(), '{"provider":"email","providers":["email"]}'::JSONB, '{"role":"provider"}'::JSONB, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'pharmacist@afyacommerce.test', crypt(gen_random_uuid()::TEXT, gen_salt('bf')), NOW(), '+254700000003', NOW(), '{"provider":"email","providers":["email"]}'::JSONB, '{"role":"pharmacist"}'::JSONB, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'rider@afyacommerce.test', crypt(gen_random_uuid()::TEXT, gen_salt('bf')), NOW(), '+254700000004', NOW(), '{"provider":"email","providers":["email"]}'::JSONB, '{"role":"rider"}'::JSONB, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pharmacies (
  id, name, ppb_licence_number, ppb_licence_expiry, kmhfr_facility_id,
  pharmacist_registration_number, physical_address, county, gps_lat, gps_lng,
  delivery_radius_km, is_active, is_sha_empanelled
) VALUES
  ('20000000-0000-4000-8000-000000000001', 'AfyaCommerce Nairobi Central Pharmacy', 'PPB-DEMO-001', CURRENT_DATE + 365, 'KMHFR-DEMO-001', 'PHARM-DEMO-001', ' Moi Avenue, Nairobi', 'Nairobi', -1.2863890, 36.8172230, 20, TRUE, TRUE),
  ('20000000-0000-4000-8000-000000000002', 'AfyaCommerce Mombasa Pharmacy', 'PPB-DEMO-002', CURRENT_DATE + 300, 'KMHFR-DEMO-002', 'PHARM-DEMO-002', 'Nkrumah Road, Mombasa', 'Mombasa', -4.0435000, 39.6682000, 15, TRUE, FALSE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active,
  is_sha_empanelled = EXCLUDED.is_sha_empanelled;

INSERT INTO public.profiles (
  id, role, full_name, phone, email, odpc_consent_given,
  odpc_consent_timestamp, mfa_enabled, preferred_language, pharmacy_id
) VALUES
  ('10000000-0000-4000-8000-000000000001', 'patient', 'Demo Patient', '+254700000001', 'patient@afyacommerce.test', TRUE, NOW(), TRUE, 'en', NULL),
  ('10000000-0000-4000-8000-000000000002', 'provider', 'Dr Demo Provider', '+254700000002', 'provider@afyacommerce.test', TRUE, NOW(), TRUE, 'en', NULL),
  ('10000000-0000-4000-8000-000000000003', 'pharmacist', 'Demo Pharmacist', '+254700000003', 'pharmacist@afyacommerce.test', TRUE, NOW(), TRUE, 'en', '20000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000004', 'rider', 'Demo Rider', '+254700000004', 'rider@afyacommerce.test', TRUE, NOW(), TRUE, 'sw', NULL)
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  pharmacy_id = EXCLUDED.pharmacy_id,
  is_active = TRUE;

INSERT INTO public.providers (
  id, profile_id, licence_number, specialisation, telemedicine_registry_id,
  is_available, consultation_fee_kes
) VALUES
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'KMP-DEMO-001', 'General Practice', 'DHA-DEMO-001', TRUE, 1500)
ON CONFLICT (id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  licence_number = EXCLUDED.licence_number,
  specialisation = EXCLUDED.specialisation,
  is_available = EXCLUDED.is_available,
  consultation_fee_kes = EXCLUDED.consultation_fee_kes;

INSERT INTO public.patients (
  id, profile_id, date_of_birth, gender, sha_member_number, blood_type,
  allergies, chronic_conditions, primary_county
) VALUES
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '1990-01-15', 'prefer_not_to_say', 'SHA-DEMO-001', 'O+', ARRAY['Penicillin'], ARRAY['Asthma'], 'Nairobi')
ON CONFLICT (id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  date_of_birth = EXCLUDED.date_of_birth,
  allergies = EXCLUDED.allergies,
  chronic_conditions = EXCLUDED.chronic_conditions;

INSERT INTO public.products (
  id, pharmacy_id, name, slug, generic_name, swahili_name, category, price_kes,
  stock_quantity, reorder_threshold, batch_number, expiry_date,
  requires_prescription, ppb_registration_number
) VALUES
  ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Amoxicillin 500mg Capsules', 'amox-500', 'Amoxicillin', 'Amoksisilin', 'prescription', 450, 120, 20, 'AMX-2026-001', CURRENT_DATE + 180, TRUE, 'PPB-P-DEMO-001'),
  ('50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Paracetamol 500mg Tablets', 'panadol-extra', 'Paracetamol', 'Parasetamol', 'otc', 80, 8, 20, 'PAR-2026-001', CURRENT_DATE + 365, FALSE, 'PPB-P-DEMO-002'),
  ('50000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'Digital Thermometer', 'digital-thermometer', NULL, 'Kipimio cha joto', 'device', 1200, 35, 10, 'THM-2026-001', CURRENT_DATE + 730, FALSE, NULL),
  ('50000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'ORS Sachet', 'ors-sachet', 'Oral Rehydration Salts', 'Chumvi za maji', 'otc', 35, 120, 40, 'ORS-2026-001', CURRENT_DATE + 540, FALSE, 'PPB-P-DEMO-004'),
  ('50000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'Metformin 500mg Tablets', 'metformin', 'Metformin hydrochloride', 'Metformini', 'prescription', 290, 55, 15, 'MET-2026-001', CURRENT_DATE + 300, TRUE, 'PPB-P-DEMO-005'),
  ('50000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', 'Vitamin D3 1000IU Capsules', 'vitamin-d', 'Cholecalciferol', 'Vitamini D3', 'supplement', 790, 42, 20, 'VIT-2026-001', CURRENT_DATE + 480, FALSE, 'PPB-P-DEMO-006'),
  ('50000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000001', 'Upper-arm Blood Pressure Monitor', 'bp-monitor', 'Digital blood pressure monitor', 'Kipimaji shinikizo', 'device', 4250, 7, 10, 'BPM-2026-001', CURRENT_DATE + 1460, FALSE, 'PPB-P-DEMO-007')
ON CONFLICT (id) DO UPDATE SET
  pharmacy_id = EXCLUDED.pharmacy_id,
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  generic_name = EXCLUDED.generic_name,
  swahili_name = EXCLUDED.swahili_name,
  price_kes = EXCLUDED.price_kes,
  stock_quantity = EXCLUDED.stock_quantity,
  batch_number = EXCLUDED.batch_number,
  expiry_date = EXCLUDED.expiry_date,
  requires_prescription = EXCLUDED.requires_prescription;

INSERT INTO public.prescriptions (
  id, patient_id, provider_id, pharmacy_id, medication_name, generic_name,
  dosage, frequency, duration_days, refills_remaining, status, clinical_notes,
  sha_claim_status
) VALUES
  ('60000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Amoxicillin 500mg Capsules', 'Amoxicillin', '1 capsule', 'Three times daily', 7, 1, 'approved', 'Take with food.', 'not_submitted')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  clinical_notes = EXCLUDED.clinical_notes,
  sha_claim_status = EXCLUDED.sha_claim_status;

INSERT INTO public.consultations (
  id, patient_id, provider_id, scheduled_at, status, consultation_type,
  fee_kes, payment_status, soap_notes
) VALUES
  ('70000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', NOW() + INTERVAL '1 day', 'scheduled', 'video', 1500, 'paid', '{"subjective":"Sample consultation","objective":"Normal","assessment":"Stable","plan":"Prescription issued"}'::JSONB)
ON CONFLICT (id) DO UPDATE SET
  scheduled_at = EXCLUDED.scheduled_at,
  status = EXCLUDED.status,
  payment_status = EXCLUDED.payment_status;

INSERT INTO public.riders (
  id, profile_id, plate_number, transport_licence_number,
  transport_licence_expiry, county, is_available, current_lat, current_lng,
  last_ping_at, rating
) VALUES
  ('80000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'KDA 123A', 'TRANS-DEMO-001', CURRENT_DATE + 365, 'Nairobi', TRUE, -1.2863890, 36.8172230, NOW(), 5.00)
ON CONFLICT (id) DO UPDATE SET
  transport_licence_expiry = EXCLUDED.transport_licence_expiry,
  is_available = EXCLUDED.is_available,
  current_lat = EXCLUDED.current_lat,
  current_lng = EXCLUDED.current_lng,
  last_ping_at = EXCLUDED.last_ping_at;

INSERT INTO public.orders (
  id, order_number, patient_id, pharmacy_id, prescription_id, subtotal_kes,
  delivery_fee_kes, total_kes, payment_status, payment_method, payment_reference,
  delivery_status, delivery_method, delivery_address
) VALUES
  ('90000000-0000-4000-8000-000000000001', 'AFY-2026-000123', '40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 450, 200, 650, 'paid', 'mpesa', 'PAY-DEMO-001', 'confirmed', 'boda', '{"phone":"+254700000001","landmark":"Near Equity Bank Kasarani","county":"Nairobi","gps_lat":-1.286389,"gps_lng":36.817223,"notes":""}'::JSONB)
ON CONFLICT (id) DO UPDATE SET
  subtotal_kes = EXCLUDED.subtotal_kes,
  delivery_fee_kes = EXCLUDED.delivery_fee_kes,
  total_kes = EXCLUDED.total_kes,
  payment_status = EXCLUDED.payment_status,
  delivery_status = EXCLUDED.delivery_status,
  delivery_address = EXCLUDED.delivery_address;

INSERT INTO public.order_items (
  id, order_id, product_id, quantity, unit_price_kes, line_total_kes
) VALUES
  ('A0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 1, 450, 450)
ON CONFLICT (id) DO UPDATE SET
  quantity = EXCLUDED.quantity,
  unit_price_kes = EXCLUDED.unit_price_kes,
  line_total_kes = EXCLUDED.line_total_kes;

INSERT INTO public.payment_transactions (
  id, order_id, provider, provider_reference, amount_kes, status,
  request_payload, callback_payload, idempotency_key
) VALUES
  ('B0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'mpesa', 'DEMO-CHECKOUT-001', 650, 'succeeded', '{"phone":"+254700000001"}'::JSONB, '{"ResultCode":0,"MpesaReceiptNumber":"DEMO-RECEIPT-001"}'::JSONB, 'seed-payment-0001')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  callback_payload = EXCLUDED.callback_payload;

INSERT INTO public.consent_records (
  id, profile_id, consent_type, granted, granted_at, policy_version
) VALUES
  ('C0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'phi_processing', TRUE, NOW(), '1.0.0'),
  ('C0000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'telehealth', TRUE, NOW(), '1.0.0')
ON CONFLICT (id) DO UPDATE SET
  granted = EXCLUDED.granted,
  revoked_at = NULL,
  policy_version = EXCLUDED.policy_version;
