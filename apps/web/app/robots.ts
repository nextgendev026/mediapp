import type { MetadataRoute } from 'next';

const SITE_URL = 'https://afyacommerce.co.ke';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/admin/', '/provider/', '/rider/', '/invoice/', '/dashboard', '/profile', '/settings', '/checkout'] },
      { userAgent: 'GPTBot', disallow: '/' }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
