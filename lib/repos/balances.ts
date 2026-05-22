import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import type { Currency } from '../currency';

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
  avatar_url: string | null;
  google_avatar_url: string | null;
};

export async function fetchGroupBalances(
  client: SupabaseClient<Database>,
  groupId: string
): Promise<GroupBalanceData> {
  const [membersResult, expensesResult, settlementsResult, groupResult] = await Promise.all([
    client
      .from('group_members')
      .select(
        'id, user_id, email, display_name, profiles!group_members_user_id_fkey(display_name, avatar_url, google_avatar_url)'
      )
      .eq('group_id', groupId)
      .eq('status', 'active'),

    client
      .from('expenses')
      .select('id, payer_id, amount, expense_participants(member_id, share_amount)')
      .eq('group_id', groupId),

    // RLS enforces private settlement visibility automatically
    client
      .from('settlements')
      .select('payer_member_id, payee_member_id, amount')
      .eq('group_id', groupId)
      .eq('is_voided', false),

    client.from('groups').select('base_currency').eq('id', groupId).single(),
  ]);

  if (membersResult.error) throw membersResult.error;
  if (expensesResult.error) throw expensesResult.error;
  if (settlementsResult.error) throw settlementsResult.error;
  if (groupResult.error) throw groupResult.error;

  const members = membersResult.data ?? [];
  const expenses = expensesResult.data ?? [];
  const settlements = settlementsResult.data ?? [];
  const currency = groupResult.data.base_currency;

  const balanceMap = new Map<string, number>();
  for (const m of members) {
    balanceMap.set(m.id, 0);
  }

  for (const expense of expenses) {
    // Payer gets credit for the full expense amount
    const payerBal = balanceMap.get(expense.payer_id) ?? 0;
    balanceMap.set(expense.payer_id, payerBal + expense.amount);

    // Each participant owes their share
    const participants = (expense.expense_participants as { member_id: string; share_amount: number }[]) ?? [];
    for (const p of participants) {
      const partBal = balanceMap.get(p.member_id) ?? 0;
      balanceMap.set(p.member_id, partBal - p.share_amount);
    }
  }

  for (const s of settlements) {
    // Debtor (payer_member_id) pays → their negative balance increases toward 0
    const payerBal = balanceMap.get(s.payer_member_id) ?? 0;
    balanceMap.set(s.payer_member_id, payerBal + s.amount);
    // Creditor (payee_member_id) receives → their positive balance decreases toward 0
    const payeeBal = balanceMap.get(s.payee_member_id) ?? 0;
    balanceMap.set(s.payee_member_id, payeeBal - s.amount);
  }

  const membersWithBalances: MemberWithBalance[] = members.map((m) => {
    const raw = m.profiles;
    const profile = (Array.isArray(raw) ? raw[0] : raw) as ProfileJoin | null;
    return {
      memberId: m.id,
      userId: m.user_id,
      name: m.display_name ?? profile?.display_name ?? m.email,
      email: m.email,
      avatarUrl: profile?.avatar_url ?? profile?.google_avatar_url ?? null,
      balance: balanceMap.get(m.id) ?? 0,
    };
  });

  return { groupId, currency: currency as Currency, members: membersWithBalances };
}
