import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import type { GroupWithMembership } from '../groupFilters';
import { sortGroups } from '../groupFilters';

type Group = Database['public']['Tables']['groups']['Row'];
type GroupMember = Database['public']['Tables']['group_members']['Row'];
type GroupType = Group['type'];
type Currency = Group['base_currency'];

export type { GroupWithMembership };

export interface GroupMemberWithProfile {
  id: string;
  group_id: string;
  user_id: string | null;
  email: string;
  display_name: string | null;
  role: 'admin' | 'member';
  status: 'active' | 'invited' | 'removed';
  is_pinned: boolean;
  is_muted: boolean;
  joined_at: string;
  avatar_url: string | null;
  google_avatar_url: string | null;
}

export interface GroupDetail {
  // Flat fields (used by group detail screen)
  id: string;
  name: string;
  type: GroupType;
  base_currency: string;
  admin_id: string;
  status: 'active' | 'expired' | 'archived';
  start_date: string | null;
  end_date: string | null;
  settlement_visibility: 'public' | 'private';
  background_image_url: string | null;
  isMember: boolean;
  isAdmin: boolean;
  memberId: string | null;
  isMuted: boolean;
  balance: number;
  memberCount: number;
  hasUnsettledBalances: boolean;
  // Nested fields (used by settings screen)
  group: Group;
  currentMemberId: string;
  currentMemberRole: 'admin' | 'member';
  currentMemberIsMuted: boolean;
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

export async function fetchGroupsWithMembership(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<GroupWithMembership[]> {
  const { data, error } = await client
    .from('group_members')
    .select('id, is_pinned, is_muted, role, groups(*)')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) throw error;

  const groups: GroupWithMembership[] = (data ?? []).map((row) => {
    const g = row.groups as Group;
    return {
      ...g,
      member_id: row.id,
      is_pinned: row.is_pinned,
      is_muted: row.is_muted,
      role: row.role,
      balance: 0,
    };
  });

  return sortGroups(groups);
}

export async function fetchGroupDetail(
  client: SupabaseClient<Database>,
  groupId: string,
  userId: string,
): Promise<GroupDetail | null> {
  const { data: group, error: groupError } = await client
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (groupError) {
    if (groupError.code === 'PGRST116') return null;
    throw groupError;
  }

  const { data: myMember } = await client
    .from('group_members')
    .select('id, role, is_muted, status')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single();

  const { count: memberCount } = await client
    .from('group_members')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .in('status', ['active', 'invited']);

  const { count: expenseCount } = await client
    .from('expenses')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId);

  const isMember = !!myMember && myMember.status === 'active';
  const isAdmin = myMember?.role === 'admin';
  const currentMemberRole = (myMember?.role ?? 'member') as 'admin' | 'member';
  const currentMemberId = myMember?.id ?? '';
  const isMuted = myMember?.is_muted ?? false;
  const memberCountVal = memberCount ?? 0;
  const hasUnsettledBalances = (expenseCount ?? 0) > 0;

  return {
    // Flat fields
    id: group.id,
    name: group.name,
    type: group.type,
    base_currency: group.base_currency,
    admin_id: group.admin_id,
    status: group.status,
    start_date: group.start_date,
    end_date: group.end_date,
    settlement_visibility: group.settlement_visibility,
    background_image_url: group.background_image_url,
    isMember,
    isAdmin,
    memberId: myMember?.id ?? null,
    isMuted,
    balance: 0,
    memberCount: memberCountVal,
    hasUnsettledBalances,
    // Nested fields (for settings screen compat)
    group,
    currentMemberId,
    currentMemberRole,
    currentMemberIsMuted: isMuted,
  };
}

export async function fetchGroupMembers(
  client: SupabaseClient<Database>,
  groupId: string,
): Promise<GroupMemberWithProfile[]> {
  const { data, error } = await client
    .from('group_members')
    .select('*, profiles(avatar_url, google_avatar_url)')
    .eq('group_id', groupId)
    .in('status', ['active', 'invited'])
    .order('joined_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const profile = row.profiles as { avatar_url: string | null; google_avatar_url: string | null } | null;
    return {
      id: row.id,
      group_id: row.group_id,
      user_id: row.user_id,
      email: row.email,
      display_name: row.display_name,
      role: row.role,
      status: row.status,
      is_pinned: row.is_pinned,
      is_muted: row.is_muted,
      joined_at: row.joined_at,
      avatar_url: profile?.avatar_url ?? null,
      google_avatar_url: profile?.google_avatar_url ?? null,
    };
  });
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

export async function pinGroup(
  client: SupabaseClient<Database>,
  memberId: string,
): Promise<void> {
  const { error } = await client
    .from('group_members')
    .update({ is_pinned: true })
    .eq('id', memberId);
  if (error) throw error;
}

export async function unpinGroup(
  client: SupabaseClient<Database>,
  memberId: string,
): Promise<void> {
  const { error } = await client
    .from('group_members')
    .update({ is_pinned: false })
    .eq('id', memberId);
  if (error) throw error;
}

export async function muteGroup(
  client: SupabaseClient<Database>,
  memberId: string,
): Promise<void> {
  const { error } = await client
    .from('group_members')
    .update({ is_muted: true })
    .eq('id', memberId);
  if (error) throw error;
}

export async function unmuteGroup(
  client: SupabaseClient<Database>,
  memberId: string,
): Promise<void> {
  const { error } = await client
    .from('group_members')
    .update({ is_muted: false })
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

export async function fetchGroupById(
  client: SupabaseClient<Database>,
  id: string,
): Promise<Group | null> {
  const { data, error } = await client
    .from('groups')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function markGroupExpired(
  client: SupabaseClient<Database>,
  groupId: string,
): Promise<void> {
  const { error } = await client
    .from('groups')
    .update({ status: 'expired' })
    .eq('id', groupId);
  if (error) throw error;
}

export async function markGroupArchived(
  client: SupabaseClient<Database>,
  groupId: string,
): Promise<void> {
  const { error } = await client
    .from('groups')
    .update({ status: 'archived' })
    .eq('id', groupId);
  if (error) throw error;
}

export async function getGroupMemberId(
  client: SupabaseClient<Database>,
  groupId: string,
  userId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();
  if (error) return null;
  return data?.id ?? null;
}

export type { GroupMember };
