import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export async function getProfile(
  client: SupabaseClient<Database>,
  userId: string
): Promise<Profile> {
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  client: SupabaseClient<Database>,
  userId: string,
  update: ProfileUpdate
): Promise<Profile> {
  const { data, error } = await client
    .from('profiles')
    .update(update)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
