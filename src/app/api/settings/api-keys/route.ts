import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  deleteUserApiKey,
  isSupportedKeyType,
  listUserApiKeys,
  setUserApiKey,
} from '@/lib/userApiKeys';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const keys = await listUserApiKeys(supabase, user.id);
  return NextResponse.json({ keys });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { key_type, value } = await request.json();
  if (typeof key_type !== 'string' || !isSupportedKeyType(key_type)) {
    return NextResponse.json({ error: 'Unsupported key_type' }, { status: 400 });
  }
  if (typeof value !== 'string' || !value.trim()) {
    return NextResponse.json({ error: 'Value required' }, { status: 400 });
  }

  await setUserApiKey(supabase, user.id, key_type, value.trim());
  return new NextResponse(null, { status: 204 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const keyType = url.searchParams.get('key_type');
  if (!keyType || !isSupportedKeyType(keyType)) {
    return NextResponse.json({ error: 'Unsupported key_type' }, { status: 400 });
  }

  await deleteUserApiKey(supabase, user.id, keyType);
  return new NextResponse(null, { status: 204 });
}
