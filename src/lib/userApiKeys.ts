import type { SupabaseClient } from '@supabase/supabase-js';

export type UserApiKeyType = 'openai';

export const SUPPORTED_KEY_TYPES: readonly UserApiKeyType[] = ['openai'] as const;

export function isSupportedKeyType(t: string): t is UserApiKeyType {
  return (SUPPORTED_KEY_TYPES as readonly string[]).includes(t);
}

// Renders e.g. "sk-...wxyz" — recognizable but non-recoverable.
export function maskApiKey(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return '••••';
  const prefix = trimmed.startsWith('sk-') ? 'sk-' : trimmed.slice(0, 3);
  return `${prefix}...${trimmed.slice(-4)}`;
}

export type StoredApiKey = {
  key_type: UserApiKeyType;
  masked: string;
  updated_at: string;
};

export async function listUserApiKeys(
  supabase: SupabaseClient,
  userId: string
): Promise<StoredApiKey[]> {
  const { data, error } = await supabase
    .from('user_api_keys')
    .select('key_type, value, updated_at')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    key_type: row.key_type as UserApiKeyType,
    masked: maskApiKey(row.value),
    updated_at: row.updated_at,
  }));
}

export async function getUserApiKey(
  supabase: SupabaseClient,
  userId: string,
  keyType: UserApiKeyType
): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_api_keys')
    .select('value')
    .eq('user_id', userId)
    .eq('key_type', keyType)
    .maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

export async function setUserApiKey(
  supabase: SupabaseClient,
  userId: string,
  keyType: UserApiKeyType,
  value: string
): Promise<void> {
  const { error } = await supabase
    .from('user_api_keys')
    .upsert(
      { user_id: userId, key_type: keyType, value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key_type' }
    );
  if (error) throw error;
}

export async function deleteUserApiKey(
  supabase: SupabaseClient,
  userId: string,
  keyType: UserApiKeyType
): Promise<void> {
  const { error } = await supabase
    .from('user_api_keys')
    .delete()
    .eq('user_id', userId)
    .eq('key_type', keyType);
  if (error) throw error;
}
