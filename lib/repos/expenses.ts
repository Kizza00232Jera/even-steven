import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import type { Split } from '../splits';

type Expense = Database['public']['Tables']['expenses']['Row'];
type GroupMember = Database['public']['Tables']['group_members']['Row'];
type Currency = Database['public']['Tables']['expenses']['Row']['currency'];

export interface CreateExpenseParams {
  group_id: string;
  title: string;
  description: string | null;
  amount: number;
  currency: Currency;
  category: string;
  payer_id: string;
  split_method: 'equal' | 'unequal' | 'percentage';
  expense_date: string;
}

export async function createExpense(
  client: SupabaseClient<Database>,
  params: CreateExpenseParams,
  splits: Split[]
): Promise<Expense> {
  const { data: expense, error: expenseError } = await client
    .from('expenses')
    .insert(params)
    .select()
    .single();

  if (expenseError) throw expenseError;

  const { error: participantError } = await client
    .from('expense_participants')
    .insert(
      splits.map((s) => ({
        expense_id: expense.id,
        member_id: s.memberId,
        share_amount: s.share,
      }))
    );

  if (participantError) throw participantError;

  return expense;
}

export async function fetchGroupMembers(
  client: SupabaseClient<Database>,
  groupId: string
): Promise<GroupMember[]> {
  const { data, error } = await client
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface ExpenseListItem {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  currency: Currency;
  category: string;
  payer_id: string;
  payer_user_id: string | null;
  payer_name: string;
  split_method: 'equal' | 'unequal' | 'percentage';
  expense_date: string;
  is_edited: boolean;
  participant_member_ids: string[];
}

type ParticipantRow = { member_id: string };
type PayerJoin = { display_name: string | null; email: string; user_id: string | null };

export async function fetchGroupExpenses(
  client: SupabaseClient<Database>,
  groupId: string
): Promise<ExpenseListItem[]> {
  const { data, error } = await client
    .from('expenses')
    .select(
      `id, title, description, amount, currency, category, payer_id,
       split_method, expense_date, is_edited,
       payer:payer_id(display_name, email, user_id),
       expense_participants(member_id)`
    )
    .eq('group_id', groupId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const payer = row.payer as PayerJoin | null;
    const participants = (row.expense_participants as ParticipantRow[]) ?? [];
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      amount: row.amount,
      currency: row.currency as Currency,
      category: row.category,
      payer_id: row.payer_id,
      payer_user_id: payer?.user_id ?? null,
      payer_name: payer?.display_name ?? payer?.email ?? '—',
      split_method: row.split_method as 'equal' | 'unequal' | 'percentage',
      expense_date: row.expense_date,
      is_edited: row.is_edited,
      participant_member_ids: participants.map((p) => p.member_id),
    };
  });
}

export async function hasGroupSettlements(
  client: SupabaseClient<Database>,
  groupId: string
): Promise<boolean> {
  const { count, error } = await client
    .from('settlements')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .eq('is_voided', false);

  if (error) throw error;
  return (count ?? 0) > 0;
}

export interface UpdateExpenseMetadataParams {
  title: string;
  description: string | null;
  category: string;
}

export async function updateExpenseMetadata(
  client: SupabaseClient<Database>,
  expenseId: string,
  params: UpdateExpenseMetadataParams
): Promise<void> {
  const { error } = await client
    .from('expenses')
    .update({ ...params, is_edited: true })
    .eq('id', expenseId);

  if (error) throw error;
}

export async function deleteExpense(
  client: SupabaseClient<Database>,
  expenseId: string
): Promise<void> {
  const { error } = await client.from('expenses').delete().eq('id', expenseId);
  if (error) throw error;
}
