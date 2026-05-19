import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addDomain, isMocked } from '@/lib/vercel';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('project_domains')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ domains: data ?? [] });
}

export async function POST(request: Request, { params }: Ctx) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { domain } = await request.json();
  if (typeof domain !== 'string' || !domain.trim()) {
    return NextResponse.json({ error: 'Domain required' }, { status: 400 });
  }
  const normalized = domain.trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(normalized)) {
    return NextResponse.json({ error: 'Invalid domain' }, { status: 400 });
  }

  // Ownership check via RLS: lookup the project first.
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle();
  if (projErr || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Attach to Vercel first; if that fails we don't write a phantom DB row.
  let vercelResult;
  try {
    vercelResult = await addDomain(normalized);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Vercel API failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const status = vercelResult.verified ? 'verified' : 'pending';
  const vercelData = {
    verification: vercelResult.verification,
    misconfigured: vercelResult.misconfigured,
  };

  const { data, error } = await supabase
    .from('project_domains')
    .insert({
      project_id: projectId,
      domain: normalized,
      verification_status: status,
      vercel_data: vercelData,
    })
    .select()
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
  }
  return NextResponse.json({ domain: data, mocked: isMocked });
}
