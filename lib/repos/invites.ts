import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

export interface InviteTokenDetails {
  valid: true;
  group_id: string;
  group_name: string;
  group_type: 'Trip' | 'Home' | 'Couple' | 'Utilities' | 'Family' | 'Other';
  start_date: string | null;
  end_date: string | null;
  member_count: number;
  inviter_name: string | null;
}

interface InvalidTokenResponse {
  valid: false;
  error: 'not_found' | 'invalidated';
}

export async function lookupInviteToken(
  client: SupabaseClient<Database>,
  token: string,
): Promise<InviteTokenDetails | null> {
  const { data, error } = await client.rpc('resolve_invite_token', { p_token: token });
  if (error) throw error;

  const result = data as unknown as InviteTokenDetails | InvalidTokenResponse;
  if (!result.valid) return null;
  return result as InviteTokenDetails;
}

// Any group member can call this (RLS: is_group_member).
export async function getOrCreateInviteToken(
  client: SupabaseClient<Database>,
  groupId: string,
  createdByMemberId: string,
): Promise<string> {
  const { data: existing } = await client
    .from('invite_tokens')
    .select('token')
    .eq('group_id', groupId)
    .is('invalidated_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing.token;

  const { data: created, error } = await client
    .from('invite_tokens')
    .insert({ group_id: groupId, created_by: createdByMemberId })
    .select()
    .single();

  if (error) throw error;
  return created.token;
}

// Only the group admin can invalidate tokens (RLS: admin_id = auth.uid()).
export async function resetInviteToken(
  client: SupabaseClient<Database>,
  groupId: string,
  createdByMemberId: string,
): Promise<string> {
  const { error: updateError } = await client
    .from('invite_tokens')
    .update({ invalidated_at: new Date().toISOString() })
    .eq('group_id', groupId);

  if (updateError) throw updateError;

  const { data: created, error: insertError } = await client
    .from('invite_tokens')
    .insert({ group_id: groupId, created_by: createdByMemberId })
    .select()
    .single();

  if (insertError) throw insertError;
  return created.token;
}

export async function addInvitedMember(
  client: SupabaseClient<Database>,
  groupId: string,
  email: string,
  inviterMemberId?: string,
): Promise<void> {
  const normalised = email.trim().toLowerCase();

  const { data: profile } = await client
    .from('profiles')
    .select('id')
    .eq('email', normalised)
    .single();

  const status = profile ? 'active' : 'invited';
  const { error } = await client
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: profile?.id ?? null,
      email: normalised,
      role: 'member',
      status,
    });

  // Ignore duplicate (already a member)
  if (error && error.code !== '23505') throw error;

  if (status === 'invited' && !error && inviterMemberId) {
    sendInviteEmailAsync(client, groupId, normalised, inviterMemberId).catch(() => {});
  }
}

async function sendInviteEmailAsync(
  client: SupabaseClient<Database>,
  groupId: string,
  toEmail: string,
  inviterMemberId: string,
): Promise<void> {
  const [groupRes, inviterRes, countRes] = await Promise.all([
    client.from('groups').select('name, type, start_date, end_date').eq('id', groupId).single(),
    client
      .from('group_members')
      .select('display_name, email, profiles(display_name, google_name)')
      .eq('id', inviterMemberId)
      .single(),
    client
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .in('status', ['active', 'invited']),
  ]);

  if (groupRes.error || inviterRes.error) return;

  const group = groupRes.data;
  const inviter = inviterRes.data;
  const memberCount = countRes.count ?? 0;
  const token = await getOrCreateInviteToken(client, groupId, inviterMemberId);

  const inviterProfileRaw = inviter.profiles;
  const inviterProfile = (Array.isArray(inviterProfileRaw) ? inviterProfileRaw[0] : inviterProfileRaw) as
    | { display_name: string | null; google_name: string | null }
    | null;
  const inviterName =
    inviter.display_name ??
    inviterProfile?.display_name ??
    inviterProfile?.google_name ??
    inviter.email;

  await client.functions.invoke('send-invite-email', {
    body: {
      to: toEmail,
      inviterName,
      groupName: group.name,
      groupType: group.type,
      startDate: group.start_date,
      endDate: group.end_date,
      memberCount,
      token,
    },
  });
}

export async function acceptInvite(
  client: SupabaseClient<Database>,
  groupId: string,
  userId: string,
  email: string,
): Promise<string> {
  const { error } = await client.rpc('accept_invite', {
    p_group_id: groupId,
    p_user_id:  userId,
    p_email:    email,
  });

  if (error) throw error;
  return groupId;
}
