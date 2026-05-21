import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../database.types';

export interface RecordSettlementParams {
  groupId: string;
  payerMemberId: string;
  payeeMemberId: string;
  amount: number;
  currency: 'USD' | 'EUR' | 'DKK' | 'SEK';
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
