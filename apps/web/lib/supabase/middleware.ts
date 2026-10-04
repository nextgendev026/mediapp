import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import type { UserRole } from '@/lib/data';

export interface SessionResult {
  response: NextResponse;
  user: User | null;
  profile: { role: UserRole } | null;
}

export async function updateSession(request: NextRequest): Promise<SessionResult> {
  const response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { response, user: null, profile: null };

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { response, user: null, profile: null };

  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = data?.role as UserRole | undefined;
  return {
    response,
    user,
    profile: role ? { role } : null
  };
}

export function redirectWithCookies(target: NextResponse, destination: URL) {
  const redirect = NextResponse.redirect(destination);
  target.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
