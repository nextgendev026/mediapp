import type { Database } from './store';
import { hashPassword } from './password';

const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const SEED_IDS = {
  admin: ID(1),
  provider: ID(2),
  pharmacist: ID(3),
  patient: ID(4),
  rider: ID(5),
  patient2: ID(6),
  thread1: ID(20),
  thread2: ID(21),
  appointment1: ID(30),
  appointment2: ID(31),
  encounter1: ID(40),
  encounter2: ID(41),
  prescription1: ID(50),
  prescription2: ID(51),
  referral1: ID(60),
  invoice1: ID(70),
  invoice2: ID(71),
  invoice3: ID(72),
  admission1: ID(80),
  order1: ID(90),
  order2: ID(91)
};

export const DEMO_ACCOUNTS = [
  { email: 'admin@afyacommerce.test', role: 'admin', name: 'Grace Wanjiru' },
  { email: 'doctor@afyacommerce.test', role: 'provider', name: 'Dr. Amina Hassan' },
  { email: 'pharmacy@afyacommerce.test', role: 'pharmacist', name: 'Joseph Njoroge' },
  { email: 'patient@afyacommerce.test', role: 'patient', name: 'James Wanjiku' }
] as const;

const DEMO_PASSWORDS: Record<string, string> = {
  'admin@afyacommerce.test': 'Admin@2026',
  'doctor@afyacommerce.test': 'Doctor@2026',
  'pharmacy@afyacommerce.test': 'Pharmacy@2026',
  'patient@afyacommerce.test': 'Patient@2026',
  'rider@afyacommerce.test': 'Rider@2026'
};

export function demoPasswordFor(email: string): string | undefined {
  return DEMO_PASSWORDS[email];
}

export async function buildSeed(): Promise<Database> {
  const hash = async (email: string): Promise<string> => hashPassword(DEMO_PASSWORDS[email] ?? 'ChangeMe@2026');
  const now = Date.now();
  const iso = (daysAgo: number): string => new Date(now - daysAgo * 86_400_000).toISOString();

  const users: Database['users'] = [
    { id: SEED_IDS.admin, email: 'admin@afyacommerce.test', passwordHash: await hash('admin@afyacommerce.test'), fullName: 'Grace Wanjiru', role: 'admin', phone: '+254700000005', status: 'active', mfa: true, createdAt: iso(400), lastLoginAt: iso(0), county: 'Nairobi' },
    { id: SEED_IDS.provider, email: 'doctor@afyacommerce.test', passwordHash: await hash('doctor@afyacommerce.test'), fullName: 'Dr. Amina Hassan', role: 'provider', phone: '+254700000002', status: 'active', mfa: true, createdAt: iso(360), lastLoginAt: iso(1), county: 'Nairobi', specialty: 'General practice', licenseNo: 'KMPDC/A/12844' },
    { id: SEED_IDS.pharmacist, email: 'pharmacy@afyacommerce.test', passwordHash: await hash('pharmacy@afyacommerce.test'), fullName: 'Joseph Njoroge', role: 'pharmacist', phone: '+254700000003', status: 'active', mfa: false, createdAt: iso(300), lastLoginAt: iso(2), county: 'Nairobi', licenseNo: 'PPB/PH/7721' },
    { id: SEED_IDS.patient, email: 'patient@afyacommerce.test', passwordHash: await hash('patient@afyacommerce.test'), fullName: 'James Wanjiku', role: 'patient', phone: '+254712345678', status: 'active', mfa: false, createdAt: iso(220), lastLoginAt: iso(0), county: 'Nairobi', gender: 'Male', dob: '1991-04-17', allergies: ['Penicillin'] },
    { id: SEED_IDS.rider, email: 'rider@afyacommerce.test', passwordHash: await hash('rider@afyacommerce.test'), fullName: 'Samuel Otieno', role: 'rider', phone: '+254700000004', status: 'active', mfa: false, createdAt: iso(180), lastLoginAt: iso(3), county: 'Nairobi' },
    { id: SEED_IDS.patient2, email: 'mercy@afyacommerce.test', passwordHash: await hash('patient@afyacommerce.test'), fullName: 'Mercy Achieng', role: 'patient', phone: '+254722111000', status: 'active', mfa: false, createdAt: iso(95), lastLoginAt: iso(64), county: 'Kisumu', gender: 'Female', dob: '1986-11-02', allergies: [] },
    { id: ID(7), email: 'david@afyacommerce.test', passwordHash: await hash('patient@afyacommerce.test'), fullName: 'David Kimani', role: 'patient', phone: '+254733222000', status: 'suspended', mfa: false, createdAt: iso(70), lastLoginAt: iso(58), county: 'Kiambu', gender: 'Male', dob: '1978-01-25', allergies: ['Sulpha drugs'] },
    { id: ID(8), email: 'dr.otieno@afyacommerce.test', passwordHash: await hash('doctor@afyacommerce.test'), fullName: 'Dr. Brian Otieno', role: 'provider', phone: '+254700000008', status: 'active', mfa: true, createdAt: iso(140), lastLoginAt: iso(5), county: 'Mombasa', specialty: 'Internal medicine', licenseNo: 'KMPDC/A/15902' }
  ];

  const appointments: Database['appointments'] = [
    { id: SEED_IDS.appointment1, patientId: SEED_IDS.patient, providerId: SEED_IDS.provider, date: new Date(now + 86_400_000).toISOString().slice(0, 10), time: '10:30', mode: 'video', status: 'booked', reason: 'Persistent cough and fever for 5 days', feeKes: 1200, createdAt: iso(2), stage: 'front_desk' },
    { id: SEED_IDS.appointment2, patientId: SEED_IDS.patient2, providerId: SEED_IDS.provider, date: new Date(now - 6 * 86_400_000).toISOString().slice(0, 10), time: '14:30', mode: 'chat', status: 'completed', reason: 'Hypertension review', feeKes: 1500, createdAt: iso(9), invoiceId: SEED_IDS.invoice1, stage: 'complete', assignedProviderId: SEED_IDS.provider, checkinAt: iso(6), checkoutAt: iso(6) },
    { id: ID(32), patientId: SEED_IDS.patient, providerId: ID(8), date: new Date(now - 21 * 86_400_000).toISOString().slice(0, 10), time: '09:00', mode: 'in_person', status: 'completed', reason: 'Malaria testing and treatment', feeKes: 1000, createdAt: iso(23), invoiceId: SEED_IDS.invoice3, stage: 'complete', assignedProviderId: ID(8), nurseId: ID(8), roomId: 'Ward B - B14', triageNotes: 'T 38.6C, BP 120/78, RRR. Malaria RDT positive. Started on AL before 24h.', checkinAt: iso(21), checkoutAt: iso(21) }
  ];

  const encounters: Database['encounters'] = [
    {
      id: SEED_IDS.encounter1, appointmentId: SEED_IDS.appointment2, patientId: SEED_IDS.patient2, providerId: SEED_IDS.provider, date: iso(6), type: 'consultation',
      soap: {
        subjective: '52yo female known hypertensive, reviewed today. Reports good adherence to amlodipine. Denies chest pain, dizziness or ankle swelling.',
        objective: 'BP 138/86 mmHg, HR 78/min, weight 74kg. Heart sounds normal, chest clear.',
        assessment: 'Essential hypertension, controlled on current regimen.',
        plan: 'Continue amlodipine 5mg daily. Home BP log for 2 weeks. Review in 3 months. Low salt diet counselling given.'
      },
      diagnosis: 'Essential hypertension (controlled)', outcome: 'treatment', status: 'closed', invoiceId: SEED_IDS.invoice1
    },
    {
      id: SEED_IDS.encounter2, appointmentId: ID(32), patientId: SEED_IDS.patient, providerId: ID(8), date: iso(21), type: 'consultation',
      soap: {
        subjective: '34yo male with 3 days of fever, chills and body aches after a bus trip to Kisumu. No cough, no vomiting.',
        objective: 'T 38.6C, BP 120/78, RRR, no jaundice. Malaria RDT positive (P. falciparum).',
        assessment: 'Uncomplicated falciparum malaria.',
        plan: 'Artemether-Lumefantrine 20/120 x 4 tabs BD x 3 days with fatty food. Paracetamol for fever. Return in 48h if no improvement. Bed rest and fluids.'
      },
      diagnosis: 'Uncomplicated P. falciparum malaria', outcome: 'prescription', status: 'closed', invoiceId: SEED_IDS.invoice3
    }
  ];

  const prescriptions: Database['prescriptions'] = [
    {
      id: SEED_IDS.prescription1, encounterId: SEED_IDS.encounter1, patientId: SEED_IDS.patient2, providerId: SEED_IDS.provider, date: iso(6),
      items: [{ name: 'Amlodipine 5mg', dosage: '5mg', frequency: 'Once daily', duration: '90 days', quantity: 90, instructions: 'Take one tablet every morning after breakfast' }],
      status: 'dispensed', notes: 'BP review in 3 months', signedBy: 'Dr. Amina Hassan (KMPDC/A/12844)'
    },
    {
      id: SEED_IDS.prescription2, encounterId: SEED_IDS.encounter2, patientId: SEED_IDS.patient, providerId: ID(8), date: iso(21),
      items: [
        { name: 'Artemether-Lumefantrine 20/120mg', dosage: '4 tablets', frequency: 'Twice daily', duration: '3 days', quantity: 24, instructions: 'Take with fatty food or milk morning and evening' },
        { name: 'Paracetamol 500mg', dosage: '500mg', frequency: 'Three times daily', duration: '3 days', quantity: 18, instructions: 'For fever only, max 4g per day' }
      ],
      status: 'approved', notes: 'Patient allergic to penicillin - avoid beta lactams', signedBy: 'Dr. Brian Otieno (KMPDC/A/15902)'
    }
  ];

  const referrals: Database['referrals'] = [
    {
      id: SEED_IDS.referral1, encounterId: SEED_IDS.encounter1, patientId: SEED_IDS.patient2, fromProviderId: SEED_IDS.provider,
      toFacility: 'Kenyatta National Hospital - Cardiology Clinic', toLevel: 'Level 5', urgency: 'routine',
      reason: 'Uncontrolled hypertension despite dual therapy; requires specialist evaluation and echocardiography.',
      clinicalSummary: '52yo F, HTN x 6 years, current BP averages 150/92 at home despite amlodipine 5mg + lisinopril 10mg. No target organ damage signs. ECG normal sinus rhythm. Family history of stroke.',
      status: 'issued', date: iso(5)
    }
  ];

  const threads: Database['threads'] = [
    { id: SEED_IDS.thread1, participantIds: [SEED_IDS.patient, SEED_IDS.provider], topic: 'Consultation CNS-4821 - cough and fever', contextId: SEED_IDS.appointment1, createdAt: iso(2), updatedAt: iso(1) },
    { id: SEED_IDS.thread2, participantIds: [SEED_IDS.patient, ID(8)], topic: 'Malaria treatment follow-up', contextId: ID(32), createdAt: iso(21), updatedAt: iso(20) }
  ];

  const messages: Database['messages'] = [
    { id: ID(100), threadId: SEED_IDS.thread1, senderId: SEED_IDS.patient, sentAt: iso(2), text: 'Doctor, the cough has not improved since Tuesday and I now have a mild fever at night.', readBy: [SEED_IDS.provider] },
    { id: ID(101), threadId: SEED_IDS.thread1, senderId: SEED_IDS.provider, sentAt: iso(1), text: 'Any chest pain or shortness of breath? Please take your temperature and share a photo of the reading.', readBy: [SEED_IDS.patient] },
    { id: ID(102), threadId: SEED_IDS.thread1, senderId: SEED_IDS.patient, sentAt: iso(1), text: 'No chest pain. Temperature was 37.9C this evening.', readBy: [SEED_IDS.provider] },
    { id: ID(103), threadId: SEED_IDS.thread2, senderId: ID(8), sentAt: iso(20), text: 'How are you feeling after the malaria tablets? Any vomiting or dizziness?', readBy: [SEED_IDS.patient] },
    { id: ID(104), threadId: SEED_IDS.thread2, senderId: SEED_IDS.patient, sentAt: iso(20), text: 'Much better, fever is gone. Uploading my prescription photo for the pharmacy refill.', readBy: [ID(8)] }
  ];

  const invoices: Database['invoices'] = [
    { id: SEED_IDS.invoice1, number: 'INV-2026-000001', patientId: SEED_IDS.patient2, issuedAt: iso(6), dueAt: iso(-14), lines: [
      { description: 'Telehealth consultation - Hypertension review (Level 2 clinic)', qty: 1, unitPriceKes: 1500 },
      { description: 'BP monitoring report interpretation', qty: 1, unitPriceKes: 300 }
    ], totalKes: 1800, paidKes: 1800, status: 'paid', sourceType: 'consultation', sourceId: SEED_IDS.encounter1 },
    { id: SEED_IDS.invoice2, number: 'INV-2026-000002', patientId: SEED_IDS.patient, issuedAt: iso(4), dueAt: iso(-10), lines: [
      { description: 'Amoxicillin 500mg (21 caps)', qty: 1, unitPriceKes: 480 },
      { description: 'Delivery - Kasarani (boda)', qty: 1, unitPriceKes: 200 }
    ], totalKes: 680, paidKes: 0, status: 'issued', sourceType: 'pharmacy', sourceId: SEED_IDS.order1 },
    { id: SEED_IDS.invoice3, number: 'INV-2026-000003', patientId: SEED_IDS.patient, issuedAt: iso(21), dueAt: iso(10), lines: [
      { description: 'Outpatient consultation - General practice', qty: 1, unitPriceKes: 1000 },
      { description: 'Malaria RDT (malachite/parasitology)', qty: 1, unitPriceKes: 500 },
      { description: 'Artemether-Lumefantrine 20/120 x 24 tabs', qty: 1, unitPriceKes: 320 },
      { description: 'Inpatient bed - Ward B, day 1 (accrued)', qty: 1, unitPriceKes: 2500 }
    ], totalKes: 4320, paidKes: 2000, status: 'partially_paid', sourceType: 'manual', sourceId: SEED_IDS.admission1 }
  ];

  const payments: Database['payments'] = [
    { id: ID(110), invoiceId: SEED_IDS.invoice1, patientId: SEED_IDS.patient2, amountKes: 1800, method: 'mpesa', reference: 'SFK7H2LM90', receiptNo: 'RCT-2026-000001', paidAt: iso(6), recordedBy: SEED_IDS.provider },
    { id: ID(111), invoiceId: SEED_IDS.invoice3, patientId: SEED_IDS.patient, amountKes: 2000, method: 'mpesa', reference: 'SFK8J1PQ22', receiptNo: 'RCT-2026-000002', paidAt: iso(20), recordedBy: SEED_IDS.admin }
  ];

  const admissions: Database['admissions'] = [
    { id: SEED_IDS.admission1, patientId: SEED_IDS.patient, ward: 'Ward B', bedNo: 'B-14', admittedAt: iso(1), dailyRateKes: 2500, status: 'active' }
  ];

  const labOrders: Database['labOrders'] = [
    {
      id: 'LAB-2026-000001', appointmentId: ID(32), patientId: SEED_IDS.patient, orderedBy: ID(8),
      modality: 'laboratory', test: 'Malaria RDT', clinicalQuestion: 'Confirm P. falciparum after 3 days of fever.',
      priceKes: 500, status: 'resulted', result: 'P. falciparum positive, parasitaemia 1+',
      interpretation: 'Abnormal', createdAt: iso(21), resultedAt: iso(21)
    },
    {
      id: 'LAB-2026-000002', appointmentId: SEED_IDS.appointment1, patientId: SEED_IDS.patient, orderedBy: SEED_IDS.provider,
      modality: 'laboratory', test: 'Full blood count', clinicalQuestion: 'Screen for anaemia given 5 days of fever and cough.',
      priceKes: 1500, status: 'ordered', createdAt: iso(1)
    }
  ];

  const audit: Database['audit'] = [
    { id: ID(120), at: iso(0), actorId: SEED_IDS.admin, actorRole: 'admin', action: 'user_role_change', resourceType: 'user', resourceId: ID(8), purpose: 'Onboarding locum clinician', phiAccessed: false },
    { id: ID(121), at: iso(1), actorId: SEED_IDS.provider, actorRole: 'provider', action: 'phi_access', resourceType: 'encounter', resourceId: SEED_IDS.encounter1, purpose: 'Clinical review', phiAccessed: true },
    { id: ID(122), at: iso(1), actorId: SEED_IDS.patient, actorRole: 'patient', action: 'chat_send', resourceType: 'message', resourceId: ID(102), purpose: 'Care communication', phiAccessed: true },
    { id: ID(123), at: iso(6), actorId: SEED_IDS.provider, actorRole: 'provider', action: 'prescription_sign', resourceType: 'prescription', resourceId: SEED_IDS.prescription1, purpose: 'Treatment', phiAccessed: true },
    { id: ID(124), at: iso(20), actorId: SEED_IDS.admin, actorRole: 'admin', action: 'payment_record', resourceType: 'payment', resourceId: ID(111), purpose: 'Accounts reconciliation', phiAccessed: false },
    { id: ID(125), at: iso(58), actorId: ID(7), actorRole: 'patient', action: 'auth_login_failed', resourceType: 'session', purpose: 'Sign in', phiAccessed: false }
  ];

  const notifications: Database['notifications'] = [
    { id: ID(130), userId: SEED_IDS.patient, title: 'Consultation tomorrow', body: 'Your video consultation with Dr. Amina Hassan is tomorrow at 10:30.', type: 'appointment', href: '/consultations', read: false, createdAt: iso(1) },
    { id: ID(131), userId: SEED_IDS.patient, title: 'Invoice INV-2026-000002 issued', body: 'Ksh 680 is due for your pharmacy order. Pay securely via M-PESA.', type: 'payment', href: '/orders', read: false, createdAt: iso(4) },
    { id: ID(132), userId: SEED_IDS.provider, title: 'New booking', body: 'James Wanjiku booked a video consultation for tomorrow 10:30.', type: 'appointment', href: '/provider/appointments', read: false, createdAt: iso(2) },
    { id: ID(133), userId: SEED_IDS.admin, title: 'Dormant account flagged', body: 'Mercy Achieng has an outstanding balance of Ksh 0 with no activity for 64 days.', type: 'account', href: '/admin/accounting', read: false, createdAt: iso(3) }
  ];

  const orders: Database['orders'] = [
    { id: SEED_IDS.order1, number: 'AFY-2026-000184', patientId: SEED_IDS.patient, createdAt: iso(4), items: [
      { slug: 'amox-500', name: 'Amoxil 500mg (21 caps)', price: 480, quantity: 1, requiresPrescription: true }
    ], subtotalKes: 480, deliveryFeeKes: 200, totalKes: 680, status: 'confirmed', county: 'Nairobi', landmark: 'Near Equity Bank, Kasarani', method: 'boda', invoiceId: SEED_IDS.invoice2 },
    { id: SEED_IDS.order2, number: 'AFY-2026-000176', patientId: SEED_IDS.patient2, createdAt: iso(12), items: [
      { slug: 'panadol-extra', name: 'Panadol Extra (16 tabs)', price: 120, quantity: 2, requiresPrescription: false },
      { slug: 'ors-sachet', name: 'ORS sachets (10)', price: 150, quantity: 1, requiresPrescription: false }
    ], subtotalKes: 390, deliveryFeeKes: 200, totalKes: 590, status: 'delivered', county: 'Kisumu', landmark: 'Kondele stage', method: 'pickup_point' }
  ];

  return {
    version: 1,
    users, appointments, encounters, prescriptions, referrals, threads, messages,
    attachments: [], invoices, payments, admissions, audit, notifications, orders,
    labOrders,
    counters: { invoice: 3, receipt: 2, order: 184, appointment: 3, encounter: 2, prescription: 2, referral: 1, lab: 2 }
  };
}
