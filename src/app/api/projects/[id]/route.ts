import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await request.json();
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('projects')
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Update failed' }, { status: 500 });
  }
  return NextResponse.json({ project: data });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const moveTo = url.searchParams.get('moveTo');

  // Guard: refuse to delete the user's only project.
  const { data: allProjects } = await supabase.from('projects').select('id');
  if (!allProjects || allProjects.length <= 1) {
    return NextResponse.json(
      { error: 'You must have at least one project.' },
      { status: 400 }
    );
  }

  // Count questionnaires in this project.
  const { count } = await supabase
    .from('questionnaires')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', id);

  if ((count ?? 0) > 0) {
    if (!moveTo) {
      return NextResponse.json(
        { error: 'Project has questionnaires; provide ?moveTo=<projectId>.' },
        { status: 400 }
      );
    }
    if (moveTo === id) {
      return NextResponse.json({ error: 'moveTo cannot equal the project being deleted.' }, { status: 400 });
    }
    // Verify destination belongs to this user (RLS will block otherwise).
    const { data: dest } = await supabase
      .from('projects')
      .select('id')
      .eq('id', moveTo)
      .maybeSingle();
    if (!dest) {
      return NextResponse.json({ error: 'Destination project not found.' }, { status: 400 });
    }
    const { error: moveErr } = await supabase
      .from('questionnaires')
      .update({ project_id: moveTo })
      .eq('project_id', id);
    if (moveErr) {
      return NextResponse.json({ error: moveErr.message }, { status: 500 });
    }
  }

  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
