import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import type { Split } from '../splits';
import { resolveDisplayName } from '../displayName';

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
  receipt_url?: string | null;
  base_currency_amount?: number;
}

export async function createExpense(
  client: SupabaseClient<Database>,
  params: CreateExpenseParams,
  splits: Split[]
): Promise<Expense> {
  const { data: expenseId, error } = await client.rpc('create_expense', {
    p_group_id:             params.group_id,
    p_title:                params.title,
    p_description:          params.description ?? null,
    p_amount:               params.amount,
    p_currency:             params.currency,
    p_category:             params.category,
    p_payer_id:             params.payer_id,
    p_split_method:         params.split_method,
    p_expense_date:         params.expense_date,
    p_receipt_url:          params.receipt_url ?? null,
    p_splits:               splits.map((s) => ({ memberId: s.memberId, share: s.share, baseShare: s.baseShare ?? s.share })),
    p_base_currency_amount: params.base_currency_amount ?? params.amount,
  });

  if (error) throw error;

  const { data: expense, error: fetchError } = await client
    .from('expenses')
    .select('*')
    .eq('id', expenseId as string)
    .single();

  if (fetchError) throw fetchError;
  return expense as Expense;
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

export interface ExpenseParticipantShare {
  memberId: string;
  shareAmount: number;
  baseShareAmount: number | null;
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
  last_edited_by_name: string | null;
  participant_member_ids: string[];
  participants: ExpenseParticipantShare[];
  receipt_url: string | null;
}

type ParticipantRow = { member_id: string; share_amount: number; base_share_amount: number | null };
type ProfileNestedJoin = { display_name: string | null; google_name: string | null } | null;
type PayerJoin = { display_name: string | null; email: string; user_id: string | null; profiles: ProfileNestedJoin | ProfileNestedJoin[] } | null;
type EditorJoin = { display_name: string | null; email: string; profiles: ProfileNestedJoin | ProfileNestedJoin[] } | null;

export async function fetchGroupExpenses(
  client: SupabaseClient<Database>,
  groupId: string
): Promise<ExpenseListItem[]> {
  const { data, error } = await client
    .from('expenses')
    .select(
      `id, title, description, amount, currency, category, payer_id,
       split_method, expense_date, is_edited, receipt_url,
       payer:payer_id(display_name, email, user_id, profiles!group_members_user_id_fkey(display_name, google_name)),
       editor:last_edited_by(display_name, email, profiles!group_members_user_id_fkey(display_name, google_name)),
       expense_participants(member_id, share_amount, base_share_amount)`
    )
    .eq('group_id', groupId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const payer = (row as unknown as { payer: PayerJoin | null }).payer;
    const editor = (row as unknown as { editor: EditorJoin }).editor;
    const participants = (row.expense_participants as ParticipantRow[]) ?? [];

    const resolveProfile = (raw: ProfileNestedJoin | ProfileNestedJoin[] | undefined): ProfileNestedJoin =>
      Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);

    const payerProfile = payer ? resolveProfile(payer.profiles) : null;
    const editorProfile = editor ? resolveProfile(editor.profiles) : null;

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      amount: row.amount,
      currency: row.currency as Currency,
      category: row.category,
      payer_id: row.payer_id,
      payer_user_id: payer?.user_id ?? null,
      payer_name: payer
        ? resolveDisplayName(payer.display_name, payerProfile?.display_name, payerProfile?.google_name, payer.email)
        : '—',
      split_method: row.split_method as 'equal' | 'unequal' | 'percentage',
      expense_date: row.expense_date,
      is_edited: row.is_edited,
      last_edited_by_name: editor
        ? resolveDisplayName(editor.display_name, editorProfile?.display_name, editorProfile?.google_name, editor.email)
        : null,
      participant_member_ids: participants.map((p) => p.member_id),
      participants: participants.map((p) => ({
        memberId: p.member_id,
        shareAmount: p.share_amount,
        baseShareAmount: p.base_share_amount,
      })),
      receipt_url: row.receipt_url,
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
  receipt_url?: string | null;
  currentMemberId?: string;
}

export async function updateExpenseMetadata(
  client: SupabaseClient<Database>,
  expenseId: string,
  params: UpdateExpenseMetadataParams
): Promise<void> {
  type ExpenseUpdate = Database['public']['Tables']['expenses']['Update'];
  const update: ExpenseUpdate = {
    title: params.title,
    description: params.description,
    category: params.category,
    is_edited: true,
    ...(params.receipt_url !== undefined ? { receipt_url: params.receipt_url } : {}),
    ...(params.currentMemberId ? { last_edited_by: params.currentMemberId } : {}),
  };
  const { error } = await client
    .from('expenses')
    .update(update)
    .eq('id', expenseId);

  if (error) throw error;
}

export async function uploadReceipt(
  client: SupabaseClient<Database>,
  path: string,
  imageUri: string
): Promise<string> {
  const response = await fetch(imageUri);
  const blob = await response.blob();

  const { error: uploadError } = await client.storage
    .from('receipts')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

  if (uploadError) throw uploadError;

  const { data } = client.storage.from('receipts').getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteExpense(
  client: SupabaseClient<Database>,
  expenseId: string
): Promise<void> {
  const { error } = await client.from('expenses').delete().eq('id', expenseId);
  if (error) throw error;
}

export interface ExpenseParticipantDetail {
  memberId: string;
  shareAmount: number;
  baseShareAmount: number | null;
}

export async function fetchExpenseParticipants(
  client: SupabaseClient<Database>,
  expenseId: string,
): Promise<ExpenseParticipantDetail[]> {
  const { data, error } = await client
    .from('expense_participants')
    .select('member_id, share_amount, base_share_amount')
    .eq('expense_id', expenseId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    memberId: r.member_id,
    shareAmount: r.share_amount,
    baseShareAmount: r.base_share_amount,
  }));
}

export interface UpdateExpenseFinancialParams {
  amount: number;
  payerId: string;
  splitMethod: 'equal' | 'unequal' | 'percentage';
  splits: Split[];
  baseCurrencyAmount?: number;
  currentMemberId?: string;
}

export async function updateExpenseFinancial(
  client: SupabaseClient<Database>,
  expenseId: string,
  params: UpdateExpenseFinancialParams,
): Promise<void> {
  const { error: expError } = await client.from('expenses')
    .update({
      amount: params.amount,
      payer_id: params.payerId,
      split_method: params.splitMethod,
      is_edited: true,
      base_currency_amount: params.baseCurrencyAmount ?? params.amount,
      ...(params.currentMemberId ? { last_edited_by: params.currentMemberId } : {}),
    })
    .eq('id', expenseId);
  if (expError) throw expError;

  const { error: deleteError } = await client
    .from('expense_participants')
    .delete()
    .eq('expense_id', expenseId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await client
    .from('expense_participants')
    .insert(
      params.splits.map((s) => ({
        expense_id: expenseId,
        member_id: s.memberId,
        share_amount: s.share,
        base_share_amount: s.baseShare ?? s.share,
      }))
    );
  if (insertError) throw insertError;
}
