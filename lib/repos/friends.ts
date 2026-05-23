import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import { resolveDisplayName } from '../displayName';

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
  sharedGroups: { groupId: string; groupName: string; balance: number; currency: string }[];
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
  google_name: string | null;
  email: string;
  avatar_url: string | null;
  google_avatar_url: string | null;
};

export async function listFriendships(
  client: SupabaseClient<Database>,
  userId: string
): Promise<FriendsList> {
  const [friendshipsResult, myGroupsResult] = await Promise.all([
    client
      .from('friendships')
      .select(
        `id, friend_id, friend_email, status, created_at,
         friend_profile:profiles!friendships_friend_id_fkey ( display_name, google_name, email, avatar_url, google_avatar_url )`
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    client
      .from('group_members')
      .select('group_id, balance')
      .eq('user_id', userId)
      .eq('status', 'active'),
  ]);

  if (friendshipsResult.error) throw friendshipsResult.error;

  const activeFriendIds = (friendshipsResult.data ?? [])
    .filter((r) => r.status === 'active' && r.friend_id)
    .map((r) => r.friend_id as string);

  // Batch-fetch group memberships for all active friends to avoid N+1
  const friendGroupsResult = activeFriendIds.length > 0
    ? await client
        .from('group_members')
        .select('user_id, group_id')
        .in('user_id', activeFriendIds)
        .eq('status', 'active')
    : { data: [] };

  const myGroupBalance = new Map<string, number>(
    (myGroupsResult.data ?? [])
      .filter((gm) => gm.group_id != null)
      .map((gm) => [gm.group_id as string, gm.balance])
  );

  // Map: friendId → Set of group IDs they're in
  const friendGroupMap = new Map<string, Set<string>>();
  for (const gm of friendGroupsResult.data ?? []) {
    if (!gm.user_id) continue;
    if (!friendGroupMap.has(gm.user_id)) friendGroupMap.set(gm.user_id, new Set());
    friendGroupMap.get(gm.user_id)!.add(gm.group_id);
  }

  const active: ActiveFriend[] = [];
  const pending: PendingFriend[] = [];

  for (const row of friendshipsResult.data ?? []) {
    if (row.status === 'active' && row.friend_id) {
      const raw = row.friend_profile;
      const p = (Array.isArray(raw) ? raw[0] : raw) as ProfileRow | null;

      const friendGroupIds = friendGroupMap.get(row.friend_id) ?? new Set<string>();
      let totalBalance = 0;
      let sharedGroupCount = 0;
      for (const [groupId, balance] of myGroupBalance) {
        if (friendGroupIds.has(groupId)) {
          totalBalance += balance;
          sharedGroupCount++;
        }
      }

      active.push({
        friendshipId: row.id,
        friendId: row.friend_id,
        name: resolveDisplayName(null, p?.display_name, p?.google_name, p?.email ?? row.friend_email),
        email: p?.email ?? row.friend_email,
        avatarUrl: p?.avatar_url ?? p?.google_avatar_url ?? null,
        totalBalance,
        sharedGroupCount,
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
  const [friendshipResult, profileResult, myGroupsResult, friendGroupsResult] = await Promise.all([
    client.from('friendships').select('id').eq('user_id', userId).eq('friend_id', friendId).single(),
    client.from('profiles').select('id, display_name, google_name, email, avatar_url, google_avatar_url').eq('id', friendId).single(),
    client.from('group_members').select('group_id, balance, groups(name, base_currency)').eq('user_id', userId).eq('status', 'active'),
    client.from('group_members').select('group_id').eq('user_id', friendId).eq('status', 'active'),
  ]);

  if (friendshipResult.error) throw friendshipResult.error;
  if (profileResult.error) throw profileResult.error;

  const profile = profileResult.data;
  const friendGroupIds = new Set((friendGroupsResult.data ?? []).map((r) => r.group_id));

  const sharedGroups = (myGroupsResult.data ?? [])
    .filter((gm) => friendGroupIds.has(gm.group_id))
    .map((gm) => {
      const g = gm.groups as { name: string; base_currency: string } | null;
      return {
        groupId: gm.group_id,
        groupName: g?.name ?? 'Unknown',
        balance: gm.balance,
        currency: g?.base_currency ?? 'USD',
      };
    });

  const totalBalance = sharedGroups.reduce((sum, g) => sum + g.balance, 0);

  return {
    friendshipId: friendshipResult.data.id,
    friendId: profile.id,
    name: resolveDisplayName(null, profile.display_name, profile.google_name, profile.email),
    email: profile.email,
    avatarUrl: profile.avatar_url ?? profile.google_avatar_url ?? null,
    totalBalance,
    sharedGroups,
  };
}
