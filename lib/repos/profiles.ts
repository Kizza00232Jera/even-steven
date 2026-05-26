import type { SupabaseClient } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';
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

export async function upsertProfile(
  client: SupabaseClient<Database>,
  userId: string,
  email: string,
  update: ProfileUpdate
): Promise<Profile> {
  const { data, error } = await client
    .from('profiles')
    .upsert({ id: userId, email, ...update })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function uploadProfilePhoto(
  client: SupabaseClient<Database>,
  userId: string,
  imageUri: string,
  base64Data: string,
  mimeType?: string,
): Promise<string> {
  const arrayBuffer = decode(base64Data);
  const ext = imageUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const contentType = mimeType ?? (ext === 'png' ? 'image/png' : 'image/jpeg');
  const filePath = `avatars/${userId}.${ext}`;

  const { error: uploadError } = await client.storage
    .from('profile-photos')
    .upload(filePath, arrayBuffer, { contentType, upsert: true });

  if (uploadError) throw uploadError;

  const { data } = client.storage.from('profile-photos').getPublicUrl(filePath);
  return `${data.publicUrl}?t=${Date.now()}`;
}
