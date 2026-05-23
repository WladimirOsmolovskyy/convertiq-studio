import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveProject } from '@/lib/projects';

// Lightweight connection status for the Integrations UI. Doesn't
// hit the GHL API — just reports whether a connection row exists
// for the user's active project.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const project = await getActiveProject(supabase, user.id);
  const { data } = await supabase
    .from('ghl_connections')
    .select('location_id, scope, updated_at, expires_at')
    .eq('project_id', project.id)
    .maybeSingle();

  return NextResponse.json({
    connected: !!data,
    location_id: data?.location_id ?? null,
    scope: data?.scope ?? null,
    updated_at: data?.updated_at ?? null,
    expires_at: data?.expires_at ?? null,
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const project = await getActiveProject(supabase, user.id);
  const { error } = await supabase
    .from('ghl_connections')
    .delete()
    .eq('project_id', project.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
