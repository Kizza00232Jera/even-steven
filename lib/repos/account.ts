import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

type GroupSummary = { id: string; name: string };

export async function getGroupsWithOutstandingBalances(
  client: SupabaseClient<Database>,
  userId: string
): Promise<GroupSummary[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).rpc(
    'get_groups_with_outstanding_balances',
    { p_user_id: userId }
  );
  if (error) throw error;
  return (data ?? []) as GroupSummary[];
}

export async function anonymiseAccount(
  client: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const anonymisedEmail = `deleted_${userId}@evensteven.app`;

  const { error: profileError } = await client
    .from('profiles')
    .update({
      display_name: 'Deleted User',
      avatar_url: null,
      google_avatar_url: null,
      email: anonymisedEmail,
    })
    .eq('id', userId);
  if (profileError) throw profileError;

  const { error: memberError } = await client
    .from('group_members')
    .update({
      display_name: 'Deleted User',
      email: anonymisedEmail,
    })
    .eq('user_id', userId);
  if (memberError) throw memberError;
}
