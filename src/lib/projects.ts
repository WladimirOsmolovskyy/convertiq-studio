import 'server-only';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Project } from './types';

export const ACTIVE_PROJECT_COOKIE = 'active_project_id';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 365, // 1 year
};

export async function listProjects(supabase: SupabaseClient): Promise<Project[]> {
  const { data } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: true });
  return (data as Project[] | null) ?? [];
}

export async function ensureDefaultProject(
  supabase: SupabaseClient,
  userId: string
): Promise<Project> {
  const existing = await listProjects(supabase);
  if (existing.length > 0) return existing[0];

  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: userId, name: 'Default' })
    .select()
    .single();
  if (error || !data) {
    throw new Error(`Failed to create default project: ${error?.message ?? 'unknown'}`);
  }
  return data as Project;
}

/**
 * Returns the user's active project, resolving in this order:
 *   1. Cookie value (if it points at a project the user still owns)
 *   2. First project owned by the user
 *   3. A newly-created "Default" project
 *
 * Cookie writes happen in route handlers (POST /api/projects/active),
 * never here — server components can't reliably set cookies.
 */
export async function getActiveProject(
  supabase: SupabaseClient,
  userId: string
): Promise<Project> {
  const cookieStore = await cookies();
  const cookieId = cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value;

  if (cookieId) {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('id', cookieId)
      .maybeSingle();
    if (data) return data as Project;
  }

  return ensureDefaultProject(supabase, userId);
}

export { COOKIE_OPTIONS as ACTIVE_PROJECT_COOKIE_OPTIONS };
