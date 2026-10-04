export type UserRole = 'patient' | 'provider' | 'pharmacist' | 'admin' | 'rider';

export type ProductCategory = 'prescription' | 'otc' | 'device' | 'supplement';

export interface Product {
  id: string;
  name: string;
  genericName: string;
  swahiliName: string;
  category: ProductCategory;
  price: number;
  stock: number;
  requiresPrescription: boolean;
  pharmacy: string;
  county: string;
  description: string;
  activeIngredient: string;
  expiry: string;
  ppbNumber: string;
  accent: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'dispatched' | 'in_transit' | 'delivered' | 'failed';

export interface Order {
  id: string;
  number: string;
  date: string;
  total: number;
  status: OrderStatus;
  deliveryMethod: string;
  items: number;
  pharmacy: string;
  eta: string;
  rider: string;
  riderPhone: string;
  plate: string;
  progress: number;
}

export const products: Product[] = [
  {
    id: 'panadol-extra',
    name: 'Panadol Extra',
    genericName: 'Paracetamol 500mg',
    swahiliName: 'Paracetamol',
    category: 'otc',
    price: 80,
    stock: 84,
    requiresPrescription: false,
    pharmacy: 'Nairobi Central Pharmacy',
    county: 'Nairobi',
    description: 'Fast relief for everyday pain and fever. Pack of 16 tablets.',
    activeIngredient: 'Paracetamol 500mg',
    expiry: '2027-08-31',
    ppbNumber: 'PPB-18422',
    accent: 'from-amber-100 to-orange-50'
  },
  {
    id: 'amox-500',
    name: 'Amoxil 500mg',
    genericName: 'Amoxicillin',
    swahiliName: 'Amoxicillini',
    category: 'prescription',
    price: 450,
    stock: 19,
    requiresPrescription: true,
    pharmacy: 'Nairobi Central Pharmacy',
    county: 'Nairobi',
    description: 'Antibiotic capsules. A valid prescription is required before dispensing.',
    activeIngredient: 'Amoxicillin 500mg',
    expiry: '2026-11-30',
    ppbNumber: 'PPB-20114',
    accent: 'from-blue-100 to-cyan-50'
  },
  {
    id: 'ors-sachet',
    name: 'ORS Sachet',
    genericName: 'Oral Rehydration Salts',
    swahiliName: 'Chumvi ya Kufidia Maji',
    category: 'otc',
    price: 35,
    stock: 120,
    requiresPrescription: false,
    pharmacy: 'Mombasa Wellness Pharmacy',
    county: 'Mombasa',
    description: 'Starter pack for safe oral rehydration during diarrhoea or heat stress.',
    activeIngredient: 'Sodium chloride, potassium chloride, glucose',
    expiry: '2028-02-28',
    ppbNumber: 'PPB-17204',
    accent: 'from-sky-100 to-blue-50'
  },
  {
    id: 'bp-monitor',
    name: 'BP Monitor Pro',
    genericName: 'Digital Blood Pressure Monitor',
    swahiliName: 'Kipimaji Shinikizo',
    category: 'device',
    price: 4250,
    stock: 7,
    requiresPrescription: false,
    pharmacy: 'Kisumu Health Hub',
    county: 'Kisumu',
    description: 'Clinically validated upper-arm monitor with an easy-to-read display.',
    activeIngredient: 'Electronic monitor',
    expiry: '2030-12-31',
    ppbNumber: 'PPB-22980',
    accent: 'from-violet-100 to-fuchsia-50'
  },
  {
    id: 'vitamin-d',
    name: 'Vitamin D3 1000IU',
    genericName: 'Cholecalciferol',
    swahiliName: 'Vitamini D3',
    category: 'supplement',
    price: 790,
    stock: 42,
    requiresPrescription: false,
    pharmacy: 'Nakuru Wellness Pharmacy',
    county: 'Nakuru',
    description: 'Once-daily vitamin D3 support for bone and immune health.',
    activeIngredient: 'Cholecalciferol 1000IU',
    expiry: '2027-12-31',
    ppbNumber: 'PPB-18832',
    accent: 'from-yellow-100 to-amber-50'
  },
  {
    id: 'metformin',
    name: 'Metformin 500mg',
    genericName: 'Metformin hydrochloride',
    swahiliName: 'Metformini',
    category: 'prescription',
    price: 290,
    stock: 55,
    requiresPrescription: true,
    pharmacy: 'Nairobi Central Pharmacy',
    county: 'Nairobi',
    description: 'Commonly prescribed medicine for type 2 diabetes management.',
    activeIngredient: 'Metformin hydrochloride 500mg',
    expiry: '2027-04-30',
    ppbNumber: 'PPB-21008',
    accent: 'from-emerald-100 to-green-50'
  }
];

export const orders: Order[] = [
  {
    id: 'AFY-2026-000184',
    number: 'AFY-2026-000184',
    date: 'Today, 09:42',
    total: 2480,
    status: 'in_transit',
    deliveryMethod: 'Boda-boda delivery',
    items: 3,
    pharmacy: 'Nairobi Central Pharmacy',
    eta: 'Arriving in 28 min',
    rider: 'Daniel K.',
    riderPhone: '+254 712 555 019',
    plate: 'KDM 42R',
    progress: 68
  },
  {
    id: 'AFY-2026-000176',
    number: 'AFY-2026-000176',
    date: '18 Sep 2026',
    total: 1180,
    status: 'delivered',
    deliveryMethod: 'Boda-boda delivery',
    items: 2,
    pharmacy: 'Mombasa Wellness Pharmacy',
    eta: 'Delivered 18 Sep',
    rider: 'Grace N.',
    riderPhone: '+254 733 555 204',
    plate: 'KCT 18B',
    progress: 100
  },
  {
    id: 'AFY-2026-000152',
    number: 'AFY-2026-000152',
    date: '12 Sep 2026',
    total: 790,
    status: 'delivered',
    deliveryMethod: 'Pickup point',
    items: 1,
    pharmacy: 'Nakuru Wellness Pharmacy',
    eta: 'Collected 13 Sep',
    rider: 'Pickup point',
    riderPhone: '',
    plate: '',
    progress: 100
  }
];

export const upcomingConsultation = {
  id: 'CNS-4821',
  date: 'Today',
  time: '14:30',
  provider: 'Dr. Amina Hassan',
  specialty: 'General practice',
  mode: 'Video consultation',
  avatar: 'AH'
};

export const recentPatients = [
  { id: '1', name: 'Grace Wanjiku', age: 34, concern: 'Medication review', time: '09:00', status: 'Waiting' },
  { id: '2', name: 'Peter Mwangi', age: 51, concern: 'Diabetes follow-up', time: '10:30', status: 'Confirmed' },
  { id: '3', name: 'Lydia Atieno', age: 28, concern: 'Skin irritation', time: '12:00', status: 'Confirmed' }
];

export const prescriptionQueue = [
  { id: 'RX-9038', patient: 'M••• 0712', medication: 'Amoxicillin 500mg', provider: 'Dr. Hassan', priority: 'High', status: 'Awaiting approval' },
  { id: 'RX-9037', patient: 'J••• 0724', medication: 'Metformin 500mg', provider: 'Dr. Ochieng', priority: 'Routine', status: 'Approved' },
  { id: 'RX-9036', patient: 'N••• 0718', medication: 'Loratadine 10mg', provider: 'Dr. Hassan', priority: 'Routine', status: 'Ready to dispense' }
];

export const inventory = [
  { name: 'Amoxil 500mg', batch: 'AMX-2401', stock: 19, threshold: 25, expiry: '30 Nov 2026', alert: 'Low stock' },
  { name: 'ORS Sachet', batch: 'ORS-8832', stock: 120, threshold: 40, expiry: '28 Feb 2028', alert: 'OK' },
  { name: 'BP Monitor Pro', batch: 'BPM-1102', stock: 7, threshold: 10, expiry: '31 Dec 2030', alert: 'Low stock' },
  { name: 'Vitamin D3 1000IU', batch: 'VIT-5501', stock: 42, threshold: 20, expiry: '31 Dec 2027', alert: 'OK' }
];

export const auditEntries = [
  { time: '25 Sep 2026, 10:14', actor: 'Dr. Amina Hassan', role: 'provider', action: 'READ', resource: 'Prescription RX-9038', phi: true, purpose: 'Treatment' },
  { time: '25 Sep 2026, 10:08', actor: 'Joseph Njoroge', role: 'pharmacist', action: 'DISPENSE', resource: 'Order AFY-2026-000176', phi: true, purpose: 'Dispensing' },
  { time: '25 Sep 2026, 09:52', actor: 'Platform admin', role: 'admin', action: 'EXPORT', resource: 'Compliance report', phi: false, purpose: 'Audit' },
  { time: '25 Sep 2026, 09:40', actor: 'Grace Wanjiku', role: 'patient', action: 'READ', resource: 'Own prescriptions', phi: true, purpose: 'Treatment' }
];

export const deliverySteps = [
  { key: 'confirmed', label: 'Order confirmed', description: 'Payment received and pharmacy notified' },
  { key: 'dispatched', label: 'Picked up', description: 'Your rider collected the medicines' },
  { key: 'in_transit', label: 'On the way', description: 'Your rider is heading to your landmark' },
  { key: 'delivered', label: 'Delivered', description: 'Proof of delivery confirmed' }
] as const;

export const countyOptions = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay',
  'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu',
  'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru',
  'Migori', 'Mombasa', 'Murang’a', 'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira',
  'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi',
  'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot'
] as const;
