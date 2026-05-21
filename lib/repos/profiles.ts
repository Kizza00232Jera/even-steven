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

export async function uploadProfilePhoto(
  client: SupabaseClient<Database>,
  userId: string,
  imageUri: string
): Promise<string> {
  const response = await fetch(imageUri);
  const blob = await response.blob();
  const ext = imageUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filePath = `avatars/${userId}.${ext}`;

  const { error: uploadError } = await client.storage
    .from('profile-photos')
    .upload(filePath, blob, { contentType: blob.type || 'image/jpeg', upsert: true });

  if (uploadError) throw uploadError;

  const { data } = client.storage.from('profile-photos').getPublicUrl(filePath);
  return `${data.publicUrl}?t=${Date.now()}`;
}
