import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { callbackUrl, decodeState, exchangeCodeForTokens } from '@/lib/integrations/ghl/oauth';

// Generic OAuth callback. The signed `state` carries provider +
// project + a returnTo path. New CRMs slot in by extending the
// provider switch and adding their own token exchange.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  const decoded = stateRaw ? decodeState(stateRaw) : null;
  const returnTo = decoded?.returnTo ?? '/dashboard';

  if (oauthError) return back(request, returnTo, `error=${encodeURIComponent(oauthError)}`);
  if (!code || !stateRaw) return back(request, returnTo, 'error=missing_code_or_state');
  if (!decoded) return back(request, returnTo, 'error=invalid_state');

  // Authenticated user must own the project encoded in the state.
  // Guards against a logged-in user completing a flow that was
  // initiated for a different account.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return back(request, returnTo, 'error=unauthenticated');

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', decoded.projectId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!project) return back(request, returnTo, 'error=project_not_found');

  if (decoded.provider !== 'ghl') {
    return back(request, returnTo, 'error=unknown_provider');
  }

  try {
    const tokens = await exchangeCodeForTokens(code, callbackUrl(request));
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const admin = createAdminClient();
    const { error: upsertErr } = await admin
      .from('ghl_connections')
      .upsert(
        {
          project_id: decoded.projectId,
          location_id: tokens.locationId,
          company_id: tokens.companyId ?? null,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
          scope: tokens.scope,
          token_type: tokens.token_type,
          user_type: tokens.userType,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'project_id' },
      );
    if (upsertErr) {
      return back(request, returnTo, `error=${encodeURIComponent(upsertErr.message)}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return back(request, returnTo, `error=${encodeURIComponent(msg.slice(0, 200))}`);
  }

  return back(request, returnTo, 'connected=ghl');
}

function back(request: Request, returnTo: string, qs: string): NextResponse {
  const origin = new URL(request.url).origin;
  const sep = returnTo.includes('?') ? '&' : '?';
  return NextResponse.redirect(`${origin}${returnTo}${sep}${qs}`);
}
