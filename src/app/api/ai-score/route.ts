import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserApiKey } from '@/lib/userApiKeys';

export async function POST(request: Request) {
  try {
    const { questionnaire_id, answer, prompt, min_score, max_score } = await request.json();

    if (typeof questionnaire_id !== 'string' || !questionnaire_id) {
      return NextResponse.json({ error: 'questionnaire_id required' }, { status: 400 });
    }

    // Resolve the questionnaire's owner so we can use their OpenAI key.
    // Anonymous public responders hit this endpoint, so we read with service role.
    const admin = createAdminClient();
    const { data: q, error: qErr } = await admin
      .from('questionnaires')
      .select('project_id, projects(user_id)')
      .eq('id', questionnaire_id)
      .maybeSingle();
    if (qErr || !q) {
      return NextResponse.json({ error: 'Questionnaire not found' }, { status: 404 });
    }

    const joined = (q as { projects: { user_id: string } | { user_id: string }[] | null }).projects;
    const ownerId = Array.isArray(joined) ? joined[0]?.user_id : joined?.user_id;
    if (!ownerId) {
      return NextResponse.json({ error: 'Questionnaire owner not found' }, { status: 404 });
    }

    const apiKey = await getUserApiKey(admin, ownerId, 'openai');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Set it in dashboard Settings.' },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a scoring assistant. Evaluate the following answer and provide a score between ${min_score} and ${max_score}.

Scoring criteria:
${prompt}

Respond ONLY with a JSON object in this exact format:
{"score": <number>, "reasoning": "<brief explanation>"}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Answer to evaluate: "${answer}"` },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json({ error: `OpenAI API error: ${error}` }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    try {
      const result = JSON.parse(content);
      return NextResponse.json({
        score: Math.max(min_score, Math.min(max_score, result.score)),
        reasoning: result.reasoning,
      });
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response', raw: content }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
