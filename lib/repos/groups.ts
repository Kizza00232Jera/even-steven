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
