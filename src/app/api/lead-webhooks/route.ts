import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function isValidHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const questionnaireId = searchParams.get('questionnaire_id');
  if (!questionnaireId) {
    return NextResponse.json({ error: 'questionnaire_id required' }, { status: 400 });
  }

  // RLS filters to webhooks the user owns; explicit eq scopes the query.
  const { data, error } = await supabase
    .from('lead_webhooks')
    .select('*')
    .eq('questionnaire_id', questionnaireId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ webhooks: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { questionnaire_id, url, label, enabled } = body as {
    questionnaire_id?: string;
    url?: string;
    label?: string;
    enabled?: boolean;
  };

  if (!questionnaire_id || typeof questionnaire_id !== 'string') {
    return NextResponse.json({ error: 'questionnaire_id required' }, { status: 400 });
  }
  // Empty URL is allowed at creation so the row can be edited inline.
  // The renderer's fire-and-forget call uses `enabled`, not URL presence.
  const trimmedUrl = typeof url === 'string' ? url.trim() : '';
  if (trimmedUrl && !isValidHttpUrl(trimmedUrl)) {
    return NextResponse.json({ error: 'URL must start with http:// or https://' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('lead_webhooks')
    .insert({
      questionnaire_id,
      url: trimmedUrl,
      label: typeof label === 'string' ? label.trim() || null : null,
      enabled: enabled === true,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
  }
  return NextResponse.json({ webhook: data });
}
