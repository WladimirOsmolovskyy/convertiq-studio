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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const { url, label, enabled } = body as {
    url?: string;
    label?: string | null;
    enabled?: boolean;
  };
  if (url !== undefined) {
    if (typeof url !== 'string') {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    }
    const trimmedUrl = url.trim();
    if (trimmedUrl && !isValidHttpUrl(trimmedUrl)) {
      return NextResponse.json({ error: 'URL must start with http:// or https://' }, { status: 400 });
    }
    patch.url = trimmedUrl;
  }
  if (label !== undefined) {
    patch.label = typeof label === 'string' ? label.trim() || null : null;
  }
  if (enabled !== undefined) {
    patch.enabled = !!enabled;
  }

  // RLS hides webhooks the caller doesn't own, so an unauthorized PATCH
  // simply returns zero rows rather than a forbidden error.
  const { data, error } = await supabase
    .from('lead_webhooks')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ webhook: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase.from('lead_webhooks').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
