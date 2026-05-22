import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

type Prefs = Database['public']['Tables']['notification_preferences']['Row'];
export type PrefKey = keyof Omit<Prefs, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export async function upsertPushToken(
  client: SupabaseClient<Database>,
  userId: string,
  token: string,
  platform: string | null
): Promise<void> {
  await client.from('push_tokens').delete().eq('user_id', userId);
  const { error } = await client.from('push_tokens').insert({ user_id: userId, token, platform });
  if (error) throw error;
}

export async function getNotificationPreferences(
  client: SupabaseClient<Database>,
  userId: string
): Promise<Prefs | null> {
  const { data, error } = await client
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateNotificationPreference(
  client: SupabaseClient<Database>,
  userId: string,
  key: PrefKey,
  value: boolean
): Promise<void> {
  const { error } = await client
    .from('notification_preferences')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ [key]: value } as any)
    .eq('user_id', userId);
  if (error) throw error;
}
