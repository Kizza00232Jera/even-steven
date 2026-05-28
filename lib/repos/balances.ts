import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import type { Currency } from '../currency';
import { resolveDisplayName } from '../displayName';

export interface MemberWithBalance {
  memberId: string;
  userId: string | null;
  name: string;
  email: string;
  avatarUrl: string | null;
  balance: number;
}

export interface GroupBalanceData {
  groupId: string;
  currency: Currency;
  members: MemberWithBalance[];
}

type ProfileJoin = {
  display_name: string | null;
  google_name: string | null;
  avatar_url: string | null;
  google_avatar_url: string | null;
};

export async function fetchGroupBalances(
  client: SupabaseClient<Database>,
  groupId: string
): Promise<GroupBalanceData> {
  // Read the pre-computed balance from group_members (maintained by DB triggers
  // with sum-preservation rounding) so this value is always in sync with the
  // groups list — both read from the same authoritative column.
  const [membersResult, groupResult] = await Promise.all([
    client
      .from('group_members')
      .select(
        'id, user_id, email, display_name, balance, profiles!group_members_user_id_fkey(display_name, google_name, avatar_url, google_avatar_url)'
      )
      .eq('group_id', groupId)
      .eq('status', 'active'),

    client.from('groups').select('base_currency').eq('id', groupId).single(),
  ]);

  if (membersResult.error) throw membersResult.error;
  if (groupResult.error) throw groupResult.error;

  const members = membersResult.data ?? [];
  const currency = groupResult.data.base_currency;

  const membersWithBalances: MemberWithBalance[] = members.map((m) => {
    const raw = m.profiles;
    const profile = (Array.isArray(raw) ? raw[0] : raw) as ProfileJoin | null;
    return {
      memberId: m.id,
      userId: m.user_id,
      name: resolveDisplayName(m.display_name, profile?.display_name, profile?.google_name, m.email),
      email: m.email,
      avatarUrl: profile?.avatar_url ?? profile?.google_avatar_url ?? null,
      balance: m.balance,
    };
  });

  return { groupId, currency: currency as Currency, members: membersWithBalances };
}
