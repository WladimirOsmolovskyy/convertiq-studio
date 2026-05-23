import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveProject } from '@/lib/projects';
import { buildAuthorizeUrl, callbackUrl, encodeState } from '@/lib/integrations/ghl/oauth';

// Kicks off the GHL OAuth flow for the user's active project. The
// browser is sent here from the Integrations UI; we redirect to
// GHL's chooselocation page with a signed state pinned to this
// project. The callback at /api/oauth/callback completes the
// handshake.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const project = await getActiveProject(supabase, user.id);
  const redirectUri = callbackUrl(request);

  // Allow the caller to specify where to land after the handshake.
  // Defaults to /dashboard if not provided or if the path looks unsafe
  // (must start with `/` and not contain `//` to block open redirects).
  const rawReturn = new URL(request.url).searchParams.get('return_to') ?? '/dashboard';
  const returnTo =
    rawReturn.startsWith('/') && !rawReturn.startsWith('//') ? rawReturn : '/dashboard';

  const state = encodeState({ provider: 'ghl', projectId: project.id, returnTo });
  const url = buildAuthorizeUrl(redirectUri, state);

  return NextResponse.redirect(url);
}
