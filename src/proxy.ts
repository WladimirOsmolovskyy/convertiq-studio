import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Hosts where the studio app (dashboard, auth, etc.) is served.
 * Any host NOT in this set is treated as a customer-owned custom domain,
 * and root-level paths get rewritten to /q/{slug} so the public route resolves.
 */
function isStudioHost(host: string | null): boolean {
  if (!host) return true; // fail-safe: treat unknown as studio (no rewrite)
  const lower = host.toLowerCase().split(':')[0];
  if (lower === 'studio.convertiq.de') return true;
  if (lower === 'staging.studio.convertiq.de') return true;
  if (lower === 'localhost' || lower === '127.0.0.1') return true;
  if (lower.endsWith('.vercel.app')) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get('host');
  const pathname = request.nextUrl.pathname;

  // Custom-domain rewrite: only on non-studio hosts, only for root-level paths.
  // /api/*, /_next/*, and the studio routes pass through unchanged on studio hosts.
  if (!isStudioHost(host)) {
    const skipRewrite =
      pathname.startsWith('/api/') ||
      pathname.startsWith('/_next/') ||
      pathname.startsWith('/q/') ||
      pathname === '/favicon.ico';
    if (!skipRewrite) {
      const slug = pathname.replace(/^\//, '');
      if (slug) {
        const url = request.nextUrl.clone();
        url.pathname = `/q/${slug}`;
        return NextResponse.rewrite(url);
      }
    }
  }

  // Auth handling (studio hosts only — supabase cookies live on studio.*)
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
