import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveProject } from '@/lib/projects';
import { listCustomFields, loadConnection } from '@/lib/integrations/ghl/client';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const project = await getActiveProject(supabase, user.id);
  const admin = createAdminClient();
  const conn = await loadConnection(admin, project.id);
  if (!conn) return NextResponse.json({ error: 'Not connected' }, { status: 404 });

  try {
    const customFields = await listCustomFields(admin, conn);
    return NextResponse.json({ customFields });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
