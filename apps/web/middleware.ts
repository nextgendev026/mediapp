import { NextResponse, type NextRequest } from 'next/server';
import { redirectWithCookies, updateSession } from '@/lib/supabase/middleware';
import { verifySession } from '@/lib/auth/session';
import { guardRequest } from '@/lib/security/sentinel';
import type { UserRole } from '@/lib/data';

const roleRoutes: Record<UserRole, string> = {
  patient: '/dashboard',
  provider: '/provider/dashboard',
  pharmacist: '/pharmacist/dashboard',
  admin: '/admin/dashboard',
  rider: '/rider'
};

const rolePrefixes: Record<UserRole, string[]> = {
  patient: ['/dashboard', '/consultations', '/prescriptions', '/records', '/pharmacy', '/cart', '/checkout', '/orders'],
  provider: ['/provider'],
  pharmacist: ['/pharmacist'],
  admin: ['/admin'],
  rider: ['/rider']
};

const publicPrefixes = ['/', '/login', '/register', '/verify-otp'];

function isPublicPath(path: string) {
  return publicPrefixes.some((prefix) => (prefix === '/' ? path === '/' : path.startsWith(prefix)));
}

function isAllowedForRole(path: string, role: UserRole) {
  if (path.startsWith('/profile') || path.startsWith('/settings') || path.startsWith('/help') || path.startsWith('/notifications') || path.startsWith('/invoice')) return true;
  if (path.startsWith('/api/auth')) return true;
  return rolePrefixes[role].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

const PUBLIC_SEO_PATHS = ['/', '/login', '/register', '/verify-otp'];

function seoRobotsHeader(path: string, headers: Headers): void {
  const isPublic = PUBLIC_SEO_PATHS.some((p) => path === p);
  if (!isPublic) {
    headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
}

function withSeo(path: string, response: NextResponse): NextResponse {
  seoRobotsHeader(path, response.headers);
  return response;
}

function demoAuthEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return process.env.DEMO_AUTH_ENABLED === 'true';
  return process.env.DEMO_AUTH_ENABLED !== 'false';
}

function supabaseUsable(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) return false;
  if (/example\.|example\.ke|replace-with|your-project/i.test(`${url} ${key}`)) return false;
  return true;
}

export async function middleware(request: NextRequest) {
  const guard = await guardRequest(request, request.nextUrl.pathname);
  if (!guard.allowed) return guard.response;

  if (!supabaseUsable()) {
    if (process.env.NODE_ENV === 'production' && !demoAuthEnabled()) {
      return new NextResponse('Authentication is not configured for this environment.', { status: 503, headers: { 'Retry-After': '60' } });
    }
    const base = NextResponse.next({ request });
    if (!demoAuthEnabled()) return withSeo(request.nextUrl.pathname, base);

    const path = request.nextUrl.pathname;
    const session = await verifySession(request.cookies.get('afya_session')?.value);
    if (path.startsWith('/api/')) return base;
    if (session) {
      if (isPublicPath(path) && path !== '/' && path !== '/login') {
        return redirectWithCookies(base, new URL(roleRoutes[session.role], request.url));
      }
      if (!isPublicPath(path) && !isAllowedForRole(path, session.role)) {
        return redirectWithCookies(base, new URL(roleRoutes[session.role], request.url));
      }
      return withSeo(path, base);
    }
    if (!isPublicPath(path)) {
      return redirectWithCookies(base, new URL('/login', request.url));
    }
    return withSeo(path, base);
  }

  const { response, user, profile } = await updateSession(request);
  const path = request.nextUrl.pathname;
  if (path.startsWith('/api/')) return response;
  const isPublic = isPublicPath(path);
  if (!user && !isPublic) return redirectWithCookies(response, new URL('/login', request.url));
  if (user && profile && isPublic && path !== '/') return redirectWithCookies(response, new URL(roleRoutes[profile.role], request.url));
  if (user && profile && !isPublic && !isAllowedForRole(path, profile.role)) return redirectWithCookies(response, new URL(roleRoutes[profile.role], request.url));
  if (user && !profile && !isPublic) return redirectWithCookies(response, new URL('/login', request.url));
  return withSeo(path, response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)']
};
