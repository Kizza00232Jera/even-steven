import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

type Group = Database['public']['Tables']['groups']['Row'];
type GroupType = Group['type'];
type Currency = Group['base_currency'];

export interface GroupDetail {
  group: Group;
  currentMemberId: string;
  currentMemberRole: 'admin' | 'member';
  currentMemberIsMuted: boolean;
  memberCount: number;
  hasUnsettledBalances: boolean;
}

export interface GroupMemberRow {
  id: string;
  user_id: string | null;
  email: string;
  display_name: string | null;
  role: 'admin' | 'member';
  status: 'active' | 'invited' | 'removed';
  joined_at: string;
  profile_display_name: string | null;
  avatar_url: string | null;
  balance: number;
}

export interface CreateGroupParams {
  name: string;
  type: GroupType;
  base_currency: Currency;
  admin_id: string;
  start_date: string | null;
  end_date: string | null;
  settlement_visibility: 'public' | 'private';
}

export interface Creator {
  userId: string;
  email: string;
  displayName: string | null;
}

export async function createGroup(
  client: SupabaseClient<Database>,
  params: CreateGroupParams,
  creator: Creator,
  inviteEmails: string[],
): Promise<Group> {
  const { data: group, error: groupError } = await client
    .from('groups')
    .insert({
      name: params.name,
      type: params.type,
      base_currency: params.base_currency,
      admin_id: params.admin_id,
      start_date: params.start_date,
      end_date: params.end_date,
      settlement_visibility: params.settlement_visibility,
    })
    .select()
    .single();

  if (groupError) throw groupError;

  const { error: creatorError } = await client.from('group_members').insert({
    group_id: group.id,
    user_id: creator.userId,
    email: creator.email,
    display_name: creator.displayName,
    role: 'admin',
    status: 'active',
  });
  if (creatorError) throw creatorError;

  if (inviteEmails.length > 0) {
    const { error: inviteError } = await client.from('group_members').insert(
      inviteEmails.map((email) => ({
        group_id: group.id,
        user_id: null as string | null,
        email,
        role: 'member' as const,
        status: 'invited' as const,
      }))
    );
    if (inviteError) throw inviteError;
  }

  return group;
}

export async function fetchGroups(
  client: SupabaseClient<Database>,
): Promise<Group[]> {
  const { data, error } = await client
    .from('groups')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchGroupDetail(
  client: SupabaseClient<Database>,
  groupId: string,
  userId: string,
): Promise<GroupDetail> {
  const [
    { data: group, error: groupError },
    { data: membership, error: membershipError },
    { count: memberCount, error: countError },
    { count: expenseCount, error: expenseCountError },
  ] = await Promise.all([
    client.from('groups').select('*').eq('id', groupId).single(),
    client
      .from('group_members')
      .select('id, role, is_muted')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single(),
    client
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .neq('status', 'removed'),
    client
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId),
  ]);

  if (groupError) throw groupError;
  if (membershipError) throw membershipError;
  if (countError) throw countError;
  if (expenseCountError) throw expenseCountError;

  return {
    group,
    currentMemberId: membership.id,
    currentMemberRole: membership.role,
    currentMemberIsMuted: membership.is_muted,
    memberCount: memberCount ?? 0,
    hasUnsettledBalances: (expenseCount ?? 0) > 0,
  };
}

type ProfileRow = {
  display_name: string | null;
  avatar_url: string | null;
  google_avatar_url: string | null;
};

export async function fetchGroupMembers(
  client: SupabaseClient<Database>,
  groupId: string,
): Promise<GroupMemberRow[]> {
  const { data, error } = await client
    .from('group_members')
    .select(
      'id, user_id, email, display_name, role, status, joined_at, profile:profiles!group_members_user_id_fkey(display_name, avatar_url, google_avatar_url)'
    )
    .eq('group_id', groupId)
    .neq('status', 'removed')
    .order('joined_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((m) => {
    const raw = m.profile;
    const p = (Array.isArray(raw) ? raw[0] : raw) as ProfileRow | null;
    return {
      id: m.id,
      user_id: m.user_id,
      email: m.email,
      display_name: m.display_name,
      role: m.role,
      status: m.status as 'active' | 'invited' | 'removed',
      joined_at: m.joined_at,
      profile_display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? p?.google_avatar_url ?? null,
      balance: 0,
    };
  });
}

export async function renameGroup(
  client: SupabaseClient<Database>,
  groupId: string,
  name: string,
): Promise<void> {
  const { error } = await client
    .from('groups')
    .update({ name })
    .eq('id', groupId);
  if (error) throw error;
}

export async function updateSettlementVisibility(
  client: SupabaseClient<Database>,
  groupId: string,
  visibility: 'public' | 'private',
): Promise<void> {
  const { error } = await client
    .from('groups')
    .update({ settlement_visibility: visibility })
    .eq('id', groupId);
  if (error) throw error;
}

export async function uploadGroupPhoto(
  client: SupabaseClient<Database>,
  groupId: string,
  imageUri: string,
): Promise<string> {
  const response = await fetch(imageUri);
  const blob = await response.blob();
  const ext = imageUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filePath = `groups/${groupId}.${ext}`;

  const { error: uploadError } = await client.storage
    .from('group-photos')
    .upload(filePath, blob, { contentType: blob.type || 'image/jpeg', upsert: true });

  if (uploadError) throw uploadError;

  const { data } = client.storage.from('group-photos').getPublicUrl(filePath);
  const photoUrl = `${data.publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await client
    .from('groups')
    .update({ background_image_url: photoUrl })
    .eq('id', groupId);
  if (updateError) throw updateError;

  return photoUrl;
}

export async function extendTripEndDate(
  client: SupabaseClient<Database>,
  groupId: string,
  newEndDate: string,
): Promise<void> {
  const { error } = await client
    .from('groups')
    .update({ end_date: newEndDate, status: 'active' })
    .eq('id', groupId);
  if (error) throw error;
}

export async function removeMember(
  client: SupabaseClient<Database>,
  memberId: string,
): Promise<void> {
  const { error } = await client
    .from('group_members')
    .update({ status: 'removed' })
    .eq('id', memberId);
  if (error) throw error;
}

export async function archiveGroup(
  client: SupabaseClient<Database>,
  groupId: string,
): Promise<void> {
  const { error } = await client
    .from('groups')
    .update({ status: 'archived' })
    .eq('id', groupId);
  if (error) throw error;
}

export async function unarchiveGroup(
  client: SupabaseClient<Database>,
  groupId: string,
): Promise<void> {
  const { error } = await client
    .from('groups')
    .update({ status: 'active' })
    .eq('id', groupId);
  if (error) throw error;
}

export async function deleteGroup(
  client: SupabaseClient<Database>,
  groupId: string,
): Promise<void> {
  const { error } = await client.from('groups').delete().eq('id', groupId);
  if (error) throw error;
}

export async function leaveGroup(
  client: SupabaseClient<Database>,
  groupId: string,
  memberId: string,
  isAdmin: boolean,
): Promise<void> {
  if (isAdmin) {
    const { data: nextAdmin } = await client
      .from('group_members')
      .select('id, user_id')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .neq('id', memberId)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!nextAdmin || !nextAdmin.user_id) {
      // Last member (or only invited members remain) — delete the group
      const { error } = await client.from('groups').delete().eq('id', groupId);
      if (error) throw error;
      return;
    }

    const { error: adminUpdateError } = await client
      .from('groups')
      .update({ admin_id: nextAdmin.user_id })
      .eq('id', groupId);
    if (adminUpdateError) throw adminUpdateError;

    const { error: roleUpdateError } = await client
      .from('group_members')
      .update({ role: 'admin' })
      .eq('id', nextAdmin.id);
    if (roleUpdateError) throw roleUpdateError;
  }

  const { error } = await client
    .from('group_members')
    .update({ status: 'removed' })
    .eq('id', memberId);
  if (error) throw error;
}

export async function toggleMuteGroup(
  client: SupabaseClient<Database>,
  memberId: string,
  isMuted: boolean,
): Promise<void> {
  const { error } = await client
    .from('group_members')
    .update({ is_muted: isMuted })
    .eq('id', memberId);
  if (error) throw error;
}
