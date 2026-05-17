import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { answer, prompt, min_score, max_score } = await request.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
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
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
