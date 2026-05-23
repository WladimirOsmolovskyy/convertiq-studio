import { createAdminClient } from '@/lib/supabase/admin';
import { refreshAccessToken } from './oauth';

// GHL API v2. The `Version` header is required on every request;
// the value below is the current stable spec.
const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

type AdminClient = ReturnType<typeof createAdminClient>;

export interface GhlConnection {
  id: string;
  project_id: string;
  location_id: string;
  company_id: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string | null;
  token_type: string | null;
  user_type: string | null;
}

export interface GhlTag {
  id: string;
  name: string;
}

export interface GhlCustomField {
  id: string;
  name: string;
  fieldKey: string;
  dataType: string;
  model: string;
}

export async function loadConnection(
  admin: AdminClient,
  projectId: string,
): Promise<GhlConnection | null> {
  const { data } = await admin
    .from('ghl_connections')
    .select('*')
    .eq('project_id', projectId)
    .single();
  return (data as GhlConnection | null) ?? null;
}

/**
 * Issue an authed request to GHL. Refreshes the access token on 401
 * (once) and retries. Persists the rotated token back to the DB so
 * subsequent calls reuse it.
 */
async function authedFetch(
  admin: AdminClient,
  conn: GhlConnection,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const make = (token: string) =>
    fetch(`${GHL_API_BASE}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token}`,
        Version: GHL_API_VERSION,
        Accept: 'application/json',
      },
    });

  let token = conn.access_token;
  // Proactive refresh if we're within 30s of expiry.
  if (new Date(conn.expires_at).getTime() - Date.now() < 30_000) {
    token = await rotateToken(admin, conn);
  }

  let res = await make(token);
  if (res.status !== 401) return res;

  token = await rotateToken(admin, conn);
  res = await make(token);
  return res;
}

async function rotateToken(admin: AdminClient, conn: GhlConnection): Promise<string> {
  const t = await refreshAccessToken(conn.refresh_token);
  const expiresAt = new Date(Date.now() + t.expires_in * 1000).toISOString();
  await admin
    .from('ghl_connections')
    .update({
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: expiresAt,
      scope: t.scope,
      token_type: t.token_type,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conn.id);
  conn.access_token = t.access_token;
  conn.refresh_token = t.refresh_token;
  conn.expires_at = expiresAt;
  return t.access_token;
}

export async function listTags(
  admin: AdminClient,
  conn: GhlConnection,
): Promise<GhlTag[]> {
  const res = await authedFetch(admin, conn, `/locations/${conn.location_id}/tags`);
  if (!res.ok) throw new Error(`GHL listTags ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { tags?: GhlTag[] };
  return body.tags ?? [];
}

export async function listCustomFields(
  admin: AdminClient,
  conn: GhlConnection,
): Promise<GhlCustomField[]> {
  const res = await authedFetch(
    admin,
    conn,
    `/locations/${conn.location_id}/customFields?model=contact`,
  );
  if (!res.ok) throw new Error(`GHL listCustomFields ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { customFields?: GhlCustomField[] };
  return body.customFields ?? [];
}

export interface UpsertContactInput {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  /** GHL custom field values keyed by field id. */
  customFields?: Array<{ id: string; field_value: string }>;
  /** Tag names to add on upsert. */
  tags?: string[];
}

export interface UpsertContactResult {
  contactId: string;
  newContact: boolean;
}

export async function upsertContact(
  admin: AdminClient,
  conn: GhlConnection,
  input: UpsertContactInput,
): Promise<UpsertContactResult> {
  const body: Record<string, unknown> = { locationId: conn.location_id };
  if (input.email) body.email = input.email;
  if (input.phone) body.phone = input.phone;
  if (input.firstName) body.firstName = input.firstName;
  if (input.lastName) body.lastName = input.lastName;
  if (input.name) body.name = input.name;
  if (input.customFields?.length) body.customFields = input.customFields;
  if (input.tags?.length) body.tags = input.tags;

  const res = await authedFetch(admin, conn, '/contacts/upsert', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`GHL upsertContact ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const parsed = (await res.json()) as {
    contact?: { id?: string };
    new?: boolean;
  };
  const contactId = parsed.contact?.id;
  if (!contactId) throw new Error('GHL upsertContact: missing contact.id');
  return { contactId, newContact: !!parsed.new };
}
