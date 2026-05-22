import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import type { Currency } from '../currency';

export interface MemberContribution {
  memberId: string;
  name: string;
  avatarUrl: string | null;
  amount: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

export interface GroupSummaryData {
  groupId: string;
  currency: Currency;
  totalSpending: number;
  memberContributions: MemberContribution[];
  categoryBreakdown: CategoryBreakdown[];
}

type ProfileJoin = {
  display_name: string | null;
  avatar_url: string | null;
  google_avatar_url: string | null;
};

export async function fetchGroupSummary(
  client: SupabaseClient<Database>,
  groupId: string
): Promise<GroupSummaryData> {
  const [groupResult, expensesResult, membersResult] = await Promise.all([
    client.from('groups').select('base_currency').eq('id', groupId).single(),
    client
      .from('expenses')
      .select('payer_id, amount, currency, category')
      .eq('group_id', groupId),
    client
      .from('group_members')
      .select(
        'id, display_name, profiles!group_members_user_id_fkey(display_name, avatar_url, google_avatar_url)'
      )
      .eq('group_id', groupId)
      .eq('status', 'active'),
  ]);

  if (groupResult.error) throw groupResult.error;
  if (expensesResult.error) throw expensesResult.error;
  if (membersResult.error) throw membersResult.error;

  const currency = groupResult.data.base_currency;
  const expenses = expensesResult.data ?? [];
  const members = membersResult.data ?? [];

  const memberMap = new Map<string, { name: string; avatarUrl: string | null }>();
  for (const m of members) {
    const raw = m.profiles;
    const profile = (Array.isArray(raw) ? raw[0] : raw) as ProfileJoin | null;
    memberMap.set(m.id, {
      name: m.display_name ?? profile?.display_name ?? 'Unknown',
      avatarUrl: profile?.avatar_url ?? profile?.google_avatar_url ?? null,
    });
  }

  const totalSpending = expenses.reduce((sum, e) => sum + e.amount, 0);

  const payerMap = new Map<string, number>();
  for (const e of expenses) {
    payerMap.set(e.payer_id, (payerMap.get(e.payer_id) ?? 0) + e.amount);
  }
  const memberContributions: MemberContribution[] = Array.from(payerMap.entries())
    .map(([memberId, amount]) => ({
      memberId,
      name: memberMap.get(memberId)?.name ?? 'Unknown',
      avatarUrl: memberMap.get(memberId)?.avatarUrl ?? null,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  const categoryMap = new Map<string, number>();
  for (const e of expenses) {
    categoryMap.set(e.category, (categoryMap.get(e.category) ?? 0) + e.amount);
  }
  const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalSpending > 0 ? (amount / totalSpending) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return { groupId, currency: currency as Currency, totalSpending, memberContributions, categoryBreakdown };
}
