import { createAdminClient } from '@/lib/supabase/admin';
import type { LeadPayload } from '@/lib/leadPayload';
import { loadConnection, upsertContact, type UpsertContactInput } from './client';

interface FieldMapEntry {
  source: string;
  target: string;
}

interface GhlConfig {
  finished_tag?: string | null;
  field_map?: FieldMapEntry[];
}

// Standard GHL contact fields we accept as map targets. Anything
// outside this set (and not prefixed `custom:`) is ignored, both
// to keep us within GHL's documented surface and to avoid leaking
// unintended payload fragments into the upsert body.
const STANDARD_TARGETS = new Set<keyof UpsertContactInput>([
  'email',
  'phone',
  'firstName',
  'lastName',
  'name',
]);
const EXTRA_STANDARD_TARGETS = new Set([
  'companyName',
  'address1',
  'city',
  'state',
  'postalCode',
  'country',
  'website',
  'dateOfBirth',
  'timezone',
]);

/**
 * Run the GHL integration for a completed lead. Safe to call
 * unconditionally — no-ops if the questionnaire has no enabled
 * GHL integration or the project has no GHL connection.
 *
 * Errors are swallowed but written to the integration row's
 * last_error column so users can see what broke.
 */
export async function deliverToGhl(
  questionnaireId: string,
  payload: LeadPayload,
): Promise<void> {
  const admin = createAdminClient();

  const { data: integration } = await admin
    .from('questionnaire_integrations')
    .select('id, enabled, config')
    .eq('questionnaire_id', questionnaireId)
    .eq('provider', 'ghl')
    .maybeSingle();

  if (!integration || !integration.enabled) return;

  const { data: q } = await admin
    .from('questionnaires')
    .select('project_id')
    .eq('id', questionnaireId)
    .single();
  if (!q?.project_id) return;

  const conn = await loadConnection(admin, q.project_id);
  const attemptedAt = new Date().toISOString();

  if (!conn) {
    await markStatus(admin, integration.id, attemptedAt, 0, 'Not connected to GoHighLevel');
    return;
  }

  const config = (integration.config ?? {}) as GhlConfig;
  const input = buildUpsertInput(payload, config);

  // Need at least one identifier (GHL rejects otherwise). If the
  // user hasn't mapped anything that can identify a contact, surface
  // that as the error instead of letting GHL respond with a vague 422.
  if (!input.email && !input.phone && !input.name && !(input.firstName && input.lastName)) {
    await markStatus(
      admin,
      integration.id,
      attemptedAt,
      0,
      'No identifying field mapped (email, phone, name, or first+last)',
    );
    return;
  }

  try {
    await upsertContact(admin, conn, input);
    await markStatus(admin, integration.id, attemptedAt, 200, null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await markStatus(admin, integration.id, attemptedAt, 0, msg.slice(0, 500));
  }
}

function buildUpsertInput(payload: LeadPayload, config: GhlConfig): UpsertContactInput {
  const input: UpsertContactInput = {
    customFields: [],
    tags: config.finished_tag ? [config.finished_tag] : [],
  };

  for (const entry of config.field_map ?? []) {
    const value = readSource(payload, entry.source);
    if (value == null || value === '') continue;
    applyTarget(input, entry.target, value);
  }
  if (input.customFields && input.customFields.length === 0) delete input.customFields;
  if (input.tags && input.tags.length === 0) delete input.tags;
  return input;
}

function readSource(payload: LeadPayload, source: string): string | null {
  if (source.startsWith('lead_field:')) {
    const id = source.slice('lead_field:'.length);
    return payload.fields.find((f) => f.id === id)?.value ?? null;
  }
  if (source === 'system:host') return payload.lead.source.host;
  if (source === 'system:user_agent') return payload.lead.source.user_agent;
  return null;
}

function applyTarget(input: UpsertContactInput, target: string, value: string): void {
  if (target.startsWith('custom:')) {
    const id = target.slice('custom:'.length);
    (input.customFields ??= []).push({ id, field_value: value });
    return;
  }
  if (STANDARD_TARGETS.has(target as keyof UpsertContactInput)) {
    (input as Record<string, unknown>)[target] = value;
    return;
  }
  if (EXTRA_STANDARD_TARGETS.has(target)) {
    (input as Record<string, unknown>)[target] = value;
    return;
  }
  // Unknown target — silently ignore to be forward-compatible with
  // older saved configs after we narrow the target list.
}

async function markStatus(
  admin: ReturnType<typeof createAdminClient>,
  integrationId: string,
  attemptedAt: string,
  status: number,
  error: string | null,
): Promise<void> {
  const update: Record<string, unknown> = {
    last_attempt_at: attemptedAt,
    last_status: status,
    last_error: error,
    updated_at: attemptedAt,
  };
  if (status >= 200 && status < 300) update.last_success_at = attemptedAt;
  await admin.from('questionnaire_integrations').update(update).eq('id', integrationId);
}
