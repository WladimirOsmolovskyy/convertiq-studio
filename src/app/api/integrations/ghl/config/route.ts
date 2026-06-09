import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Per-questionnaire GHL integration config (finished_tag, field_map).
// Storage: questionnaire_integrations row with provider='ghl'.

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const questionnaireId = new URL(request.url).searchParams.get('questionnaire_id');
  if (!questionnaireId) {
    return NextResponse.json({ error: 'questionnaire_id required' }, { status: 400 });
  }

  const { data } = await supabase
    .from('questionnaire_integrations')
    .select('*')
    .eq('questionnaire_id', questionnaireId)
    .eq('provider', 'ghl')
    .maybeSingle();

  return NextResponse.json({ integration: data ?? null });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { questionnaire_id, enabled, config } = body as {
    questionnaire_id?: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
  };
  if (!questionnaire_id) {
    return NextResponse.json({ error: 'questionnaire_id required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('questionnaire_integrations')
    .upsert(
      {
        questionnaire_id,
        provider: 'ghl',
        enabled: enabled !== false,
        config: config ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'questionnaire_id,provider' },
    )
    .select()
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Save failed' }, { status: 500 });
  }
  return NextResponse.json({ integration: data });
}
