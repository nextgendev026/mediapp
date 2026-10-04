import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AfyaCommerce — Kenya’s health, one tap away',
    short_name: 'AfyaCommerce',
    description:
      'Talk to licensed Kenyan doctors, get PPB-verified medicines delivered, and pay with M-PESA. Telehealth and pharmacy in one app.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#1da84a',
    lang: 'en-KE',
    dir: 'ltr',
    categories: ['health', 'medical', 'shopping'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ],
    shortcuts: [
      { name: 'Book a consultation', short_name: 'Consult', url: '/consultations/book', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Order medicines', short_name: 'Pharmacy', url: '/pharmacy', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'My prescriptions', short_name: 'Rx', url: '/prescriptions', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] }
    ]
  };
}
