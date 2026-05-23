import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deliverToWebhooks } from '@/lib/webhooks/deliver';
import type { LeadPayload } from '@/lib/leadPayload';

// Public endpoint — called by the questionnaire renderer right after a
// lead is saved. Anonymous (the form is public), so we validate that
// the response_id exists and pins to a real questionnaire before
// fanning out to that questionnaire's destinations.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { response_id, payload } = body as {
    response_id?: string;
    payload?: LeadPayload;
  };

  if (!response_id || typeof response_id !== 'string') {
    return NextResponse.json({ error: 'response_id required' }, { status: 400 });
  }
  if (!payload || typeof payload !== 'object' || payload.event !== 'lead.completed') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: response } = await admin
    .from('responses')
    .select('id, questionnaire_id')
    .eq('id', response_id)
    .single();

  if (!response) {
    return NextResponse.json({ error: 'Unknown response' }, { status: 404 });
  }

  // Pin the payload's identity to the saved response so a tampered
  // client can't fire under one questionnaire's destinations with a
  // payload claiming a different lead/questionnaire.
  const stamped: LeadPayload = {
    ...payload,
    lead: { ...payload.lead, id: response.id },
    questionnaire: { ...payload.questionnaire, id: response.questionnaire_id },
  };

  // Fire-and-forget for the caller; we still await so per-destination
  // log rows are written before the response returns (lightweight).
  await deliverToWebhooks(response.questionnaire_id, stamped);

  return NextResponse.json({ ok: true });
}
