import { createAdminClient } from '@/lib/supabase/admin';
import type { LeadPayload } from '@/lib/leadPayload';

const DELIVERY_TIMEOUT_MS = 10_000;

type AdminClient = ReturnType<typeof createAdminClient>;

interface WebhookRow {
  id: string;
  url: string;
  /** Audience allow-list. NULL = no filter, deliver all. Empty array =
   *  deliver none. Populated = deliver only when the lead's audience
   *  is in the list. */
  audience_ids: string[] | null;
}

export async function deliverToWebhooks(
  questionnaireId: string,
  payload: LeadPayload,
): Promise<void> {
  const admin = createAdminClient();
  const { data: hooks } = await admin
    .from('lead_webhooks')
    .select('id, url, audience_ids')
    .eq('questionnaire_id', questionnaireId)
    .eq('enabled', true);

  const rows = (hooks ?? []) as WebhookRow[];
  if (rows.length === 0) return;

  const leadAudienceId = payload.lead.audience?.id ?? null;
  const eligible = rows.filter((h) => {
    if (h.audience_ids == null) return true;
    if (!leadAudienceId) return false;
    return h.audience_ids.includes(leadAudienceId);
  });
  if (eligible.length === 0) return;

  await Promise.allSettled(eligible.map((h) => deliverOne(admin, h, payload)));
}

async function deliverOne(
  admin: AdminClient,
  hook: WebhookRow,
  payload: LeadPayload,
): Promise<void> {
  const attemptedAt = new Date().toISOString();
  let status = 0;
  let error: string | null = null;

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), DELIVERY_TIMEOUT_MS);
  try {
    const res = await fetch(hook.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    status = res.status;
    if (!res.ok) {
      const body = await safeReadBody(res);
      error = body ? `HTTP ${res.status}: ${body}` : `HTTP ${res.status}`;
    }
  } catch (e) {
    status = 0;
    const msg = e instanceof Error ? e.message : String(e);
    error = msg.slice(0, 500);
  } finally {
    clearTimeout(timeout);
  }

  const update: Record<string, unknown> = {
    last_attempt_at: attemptedAt,
    last_status: status,
    last_error: error,
    updated_at: attemptedAt,
  };
  if (status >= 200 && status < 300) {
    update.last_success_at = attemptedAt;
  }

  await admin.from('lead_webhooks').update(update).eq('id', hook.id);
}

async function safeReadBody(res: Response): Promise<string | null> {
  try {
    const text = await res.text();
    return text ? text.slice(0, 300) : null;
  } catch {
    return null;
  }
}
