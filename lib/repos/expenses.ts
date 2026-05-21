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
    .in('status', ['active'])
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
