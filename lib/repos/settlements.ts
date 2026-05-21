import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';
import type { Currency } from '../currency';

export interface RecordSettlementParams {
  groupId: string;
  payerMemberId: string;
  payeeMemberId: string;
  amount: number;
  currency: Currency;
  recordedBy: string;
}

export async function recordSettlement(
  client: SupabaseClient<Database>,
  params: RecordSettlementParams
): Promise<void> {
  const { error } = await client.from('settlements').insert({
    group_id: params.groupId,
    payer_member_id: params.payerMemberId,
    payee_member_id: params.payeeMemberId,
    amount: params.amount,
    currency: params.currency,
    recorded_by: params.recordedBy,
  });
  if (error) throw error;
}

export interface SettlementRecord {
  id: string;
  payerMemberId: string;
  payeeMemberId: string;
  amount: number;
  currency: Currency;
  recordedBy: string;
  createdAt: string;
}

export async function fetchGroupSettlements(
  client: SupabaseClient<Database>,
  groupId: string
): Promise<SettlementRecord[]> {
  const { data, error } = await client
    .from('settlements')
    .select('id, payer_member_id, payee_member_id, amount, currency, recorded_by, created_at')
    .eq('group_id', groupId)
    .eq('is_voided', false)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((s) => ({
    id: s.id,
    payerMemberId: s.payer_member_id,
    payeeMemberId: s.payee_member_id,
    amount: s.amount,
    currency: s.currency as Currency,
    recordedBy: s.recorded_by,
    createdAt: s.created_at,
  }));
}

export async function voidSettlement(
  client: SupabaseClient<Database>,
  settlementId: string,
  voidedByMemberId: string
): Promise<void> {
  const { error } = await client
    .from('settlements')
    .update({
      is_voided: true,
      voided_by: voidedByMemberId,
      voided_at: new Date().toISOString(),
    })
    .eq('id', settlementId);

  if (error) throw error;
}
