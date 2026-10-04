import type { MetadataRoute } from 'next';

const SITE_URL = 'https://afyacommerce.co.ke';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }[] = [
    { path: '/', priority: 1.0, changeFrequency: 'daily' },
    { path: '/register', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/login', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/pharmacy', priority: 0.8, changeFrequency: 'daily' },
    { path: '/consultations/book', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/help', priority: 0.5, changeFrequency: 'monthly' }
  ];
  return pages.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority
  }));
}
