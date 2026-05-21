import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

type Group = Database['public']['Tables']['groups']['Row'];
type GroupType = Group['type'];
type Currency = Group['base_currency'];

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

export interface GroupDetail {
  id: string;
  name: string;
  type: Group['type'];
  base_currency: Group['base_currency'];
  status: Group['status'];
  settlement_visibility: Group['settlement_visibility'];
  currentMember: {
    id: string;
    role: 'admin' | 'member';
    status: 'active' | 'invited' | 'removed';
  } | null;
}

export async function fetchGroupDetail(
  client: SupabaseClient<Database>,
  groupId: string,
  userId: string
): Promise<GroupDetail> {
  const [groupResult, memberResult] = await Promise.all([
    client
      .from('groups')
      .select('id, name, type, base_currency, status, settlement_visibility')
      .eq('id', groupId)
      .single(),
    client
      .from('group_members')
      .select('id, role, status')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (groupResult.error) throw groupResult.error;
  if (memberResult.error) throw memberResult.error;

  const group = groupResult.data;
  const member = memberResult.data;

  return {
    id: group.id,
    name: group.name,
    type: group.type,
    base_currency: group.base_currency,
    status: group.status,
    settlement_visibility: group.settlement_visibility,
    currentMember: member
      ? { id: member.id, role: member.role as 'admin' | 'member', status: member.status }
      : null,
  };
}
