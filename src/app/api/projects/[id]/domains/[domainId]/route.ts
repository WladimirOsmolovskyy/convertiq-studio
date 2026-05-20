import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDomainStatus, removeDomain } from '@/lib/vercel';

type Ctx = { params: Promise<{ id: string; domainId: string }> };

/** Re-poll Vercel and update the row's verification_status + vercel_data. */
export async function POST(_req: Request, { params }: Ctx) {
  const { domainId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: row, error } = await supabase
    .from('project_domains')
    .select('*')
    .eq('id', domainId)
    .maybeSingle();
  if (error || !row) {
    return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
  }

  let status;
  try {
    status = await getDomainStatus(row.domain);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Vercel API failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const nextStatus =
    status.verified && !status.misconfigured ? 'verified' : 'pending';

  const { data: updated, error: updErr } = await supabase
    .from('project_domains')
    .update({
      verification_status: nextStatus,
      vercel_data: {
        verification: status.verification,
        misconfigured: status.misconfigured,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', domainId)
    .select()
    .single();
  if (updErr || !updated) {
    return NextResponse.json({ error: updErr?.message ?? 'Update failed' }, { status: 500 });
  }
  return NextResponse.json({ domain: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { domainId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Block if any questionnaire references this domain.
  const { count } = await supabase
    .from('questionnaires')
    .select('id', { count: 'exact', head: true })
    .eq('domain_id', domainId);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Domain has questionnaires attached. Unpublish or move them first.' },
      { status: 400 },
    );
  }

  const { data: row, error } = await supabase
    .from('project_domains')
    .select('domain')
    .eq('id', domainId)
    .maybeSingle();
  if (error || !row) {
    return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
  }

  try {
    await removeDomain(row.domain);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Vercel API failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { error: delErr } = await supabase.from('project_domains').delete().eq('id', domainId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
