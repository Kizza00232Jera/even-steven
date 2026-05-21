import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

export interface ActiveFriend {
  friendshipId: string;
  friendId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  totalBalance: number;
  sharedGroupCount: number;
}

export interface PendingFriend {
  friendshipId: string;
  email: string;
  createdAt: string;
}

export interface FriendsList {
  active: ActiveFriend[];
  pending: PendingFriend[];
}

export interface FriendDetail {
  friendshipId: string;
  friendId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  totalBalance: number;
  sharedGroups: { groupId: string; groupName: string; balance: number }[];
}

export async function addFriend(
  client: SupabaseClient<Database>,
  userId: string,
  friendEmail: string
): Promise<void> {
  const email = friendEmail.trim().toLowerCase();

  const { data: profile } = await client
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  const { error } = await client.from('friendships').insert({
    user_id: userId,
    friend_id: profile?.id ?? null,
    friend_email: email,
    status: profile ? 'active' : 'pending',
  });

  if (error) throw error;
}

export async function removeFriendship(
  client: SupabaseClient<Database>,
  friendshipId: string
): Promise<void> {
  const { error } = await client
    .from('friendships')
    .delete()
    .eq('id', friendshipId);
  if (error) throw error;
}

type ProfileRow = {
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  google_avatar_url: string | null;
};

export async function listFriendships(
  client: SupabaseClient<Database>,
  userId: string
): Promise<FriendsList> {
  const { data, error } = await client
    .from('friendships')
    .select(
      `id, friend_id, friend_email, status, created_at,
       friend_profile:profiles!friendships_friend_id_fkey ( display_name, email, avatar_url, google_avatar_url )`
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const active: ActiveFriend[] = [];
  const pending: PendingFriend[] = [];

  for (const row of data ?? []) {
    if (row.status === 'active' && row.friend_id) {
      const raw = row.friend_profile;
      const p = (Array.isArray(raw) ? raw[0] : raw) as ProfileRow | null;
      active.push({
        friendshipId: row.id,
        friendId: row.friend_id,
        name: p?.display_name ?? p?.email ?? row.friend_email,
        email: p?.email ?? row.friend_email,
        avatarUrl: p?.avatar_url ?? p?.google_avatar_url ?? null,
        totalBalance: 0,
        sharedGroupCount: 0,
      });
    } else {
      pending.push({
        friendshipId: row.id,
        email: row.friend_email,
        createdAt: row.created_at,
      });
    }
  }

  return { active, pending };
}

export async function getFriendDetail(
  client: SupabaseClient<Database>,
  userId: string,
  friendId: string
): Promise<FriendDetail> {
  const { data: friendship, error: fsError } = await client
    .from('friendships')
    .select('id')
    .eq('user_id', userId)
    .eq('friend_id', friendId)
    .single();

  if (fsError) throw fsError;

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, display_name, email, avatar_url, google_avatar_url')
    .eq('id', friendId)
    .single();

  if (profileError) throw profileError;

  return {
    friendshipId: friendship.id,
    friendId: profile.id,
    name: profile.display_name ?? profile.email,
    email: profile.email,
    avatarUrl: profile.avatar_url ?? profile.google_avatar_url ?? null,
    totalBalance: 0,
    sharedGroups: [],
  };
}
