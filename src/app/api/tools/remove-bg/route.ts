import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const PHOTOROOM_URL = 'https://sdk.photoroom.com/v1/segment';

/**
 * Proxy to Photoroom's background-removal API. Holds the API key server-side
 * and gates the route behind a Supabase session so the key can't be abused.
 */
export async function POST(request: Request) {
  const apiKey = process.env.PHOTOROOM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'PHOTOROOM_API_KEY is not configured on the server.' },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const incoming = await request.formData();
  const file = incoming.get('image');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No image uploaded' }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append('image_file', file);

  const upstreamRes = await fetch(PHOTOROOM_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: upstream,
  });

  if (!upstreamRes.ok) {
    const text = await upstreamRes.text().catch(() => '');
    return NextResponse.json(
      { error: text || `Photoroom returned ${upstreamRes.status}` },
      { status: upstreamRes.status },
    );
  }

  const buffer = await upstreamRes.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
    },
  });
}
