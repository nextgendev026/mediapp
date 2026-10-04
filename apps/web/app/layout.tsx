import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProviders } from '@/components/shared/AppProviders';
import { PwaRegister } from '@/components/shared/PwaRegister';

const SITE_URL = 'https://afyacommerce.co.ke';
const TAGLINE = 'Kenya’s health, one tap away';
const DESCRIPTION =
  'Talk to licensed Kenyan doctors, get PPB-verified medicines delivered, and pay with M-PESA. Book telehealth consultations, upload prescriptions, and track deliveries nationwide — private and secure.';

export const metadata: Metadata = {
  title: {
    default: `AfyaCommerce — ${TAGLINE}`,
    template: '%s | AfyaCommerce'
  },
  description: DESCRIPTION,
  applicationName: 'AfyaCommerce',
  keywords: [
    'Kenya telehealth', 'online pharmacy Kenya', 'doctor consultation Kenya', 'M-PESA pharmacy',
    'medicine delivery Nairobi', 'prescription upload Kenya', 'AfyaCommerce', 'licensed pharmacy Kenya',
    'telemedicine Nairobi', 'healthcare app Kenya'
  ],
  authors: [{ name: 'AfyaCommerce' }],
  category: 'health',
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_KE',
    url: SITE_URL,
    siteName: 'AfyaCommerce',
    title: `AfyaCommerce — ${TAGLINE}`,
    description: DESCRIPTION,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'AfyaCommerce — Kenya’s health, one tap away' }]
  },
  twitter: {
    card: 'summary_large_image',
    title: `AfyaCommerce — ${TAGLINE}`,
    description: DESCRIPTION,
    images: ['/og.png']
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 }
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'AfyaCommerce',
    statusBarStyle: 'default',
    startupImage: [{ url: '/icon-512.png', media: '(orientation: portrait)' }]
  },
  formatDetection: { telephone: true }
};

export const viewport: Viewport = {
  themeColor: '#1da84a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  colorScheme: 'light'
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'AfyaCommerce',
      url: SITE_URL,
      logo: `${SITE_URL}/icon-512.png`,
      slogan: TAGLINE,
      areaServed: 'Kenya',
      sameAs: ['https://twitter.com/afyacommerce']
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'AfyaCommerce',
      publisher: { '@id': `${SITE_URL}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/pharmacy?q={search_term_string}` },
        'query-input': 'required name=search_term_string'
      }
    },
    {
      '@type': 'MedicalClinic',
      '@id': `${SITE_URL}/#clinic`,
      name: 'AfyaCommerce Telehealth & Pharmacy',
      url: SITE_URL,
      slogan: TAGLINE,
      medicalSpecialty: ['GeneralPractice', 'Pharmacy'],
      availableService: [
        { '@type': 'MedicalProcedure', name: 'Video consultation with licensed Kenyan clinicians' },
        { '@type': 'MedicalProcedure', name: 'Prescription review and dispensing' },
        { '@type': 'Service', name: 'Pharmacy delivery across Kenya' }
      ],
      areaServed: { '@type': 'Country', name: 'Kenya' },
      priceRange: 'KES',
      parentOrganization: { '@id': `${SITE_URL}/#organization` }
    }
  ]
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
        <PwaRegister />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </body>
    </html>
  );
}
