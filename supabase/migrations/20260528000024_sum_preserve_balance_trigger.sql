-- Update recompute_group_member_balances to apply sum-preservation rounding.
--
-- Problem fixed: when a multi-currency expense produces per-participant
-- base_share values that both round the same direction (e.g. both 33.345 →
-- 33.35), sum(base_shares) can exceed base_currency_amount by one cent.
-- The trigger then stores asymmetric balances (e.g. +33.34 / -33.35) whose
-- sum is -0.01, causing simplifyDebts to show a settlement of 33.34 when the
-- displayed balance says 33.35.
--
-- Fix: after rounding each member's balance to 2dp, check whether the group
-- sum is still non-zero (rounding residual), and if so absorb it into the
-- member with the largest absolute balance — exactly the same logic used by
-- the TypeScript fetchGroupBalances in lib/repos/balances.ts.
--
-- This makes group_members.balance the single authoritative source; the
-- TypeScript layer now reads this column directly instead of recomputing.

CREATE OR REPLACE FUNCTION public.recompute_group_member_balances(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum   NUMERIC(12,2);
  v_max_id UUID;
BEGIN
  -- Step 1: recompute and round each active member's balance to 2dp
  UPDATE group_members gm
  SET balance = ROUND((
    COALESCE((
      SELECT SUM(COALESCE(e.base_currency_amount, e.amount))
      FROM expenses e
      WHERE e.payer_id = gm.id AND e.group_id = p_group_id
    ), 0)
    - COALESCE((
      SELECT SUM(COALESCE(ep.base_share_amount, ep.share_amount))
      FROM expense_participants ep
      JOIN expenses e ON e.id = ep.expense_id
      WHERE ep.member_id = gm.id AND e.group_id = p_group_id
    ), 0)
    + COALESCE((
      SELECT SUM(s.amount) FROM settlements s
      WHERE s.payer_member_id = gm.id AND s.group_id = p_group_id AND NOT s.is_voided
    ), 0)
    - COALESCE((
      SELECT SUM(s.amount) FROM settlements s
      WHERE s.payee_member_id = gm.id AND s.group_id = p_group_id AND NOT s.is_voided
    ), 0)
  )::numeric, 2)
  WHERE gm.group_id = p_group_id;

  -- Step 2: if active members' balances don't sum to zero (rounding residual),
  -- absorb the error into the member with the largest absolute balance so that
  -- simplifyDebts always produces settlement amounts that match display values.
  SELECT SUM(balance) INTO v_sum
  FROM group_members
  WHERE group_id = p_group_id AND status = 'active';

  IF v_sum IS NOT NULL AND ABS(v_sum) >= 0.01 THEN
    SELECT id INTO v_max_id
    FROM group_members
    WHERE group_id = p_group_id AND status = 'active'
    ORDER BY ABS(balance) DESC
    LIMIT 1;

    UPDATE group_members
    SET balance = ROUND((balance - v_sum)::numeric, 2)
    WHERE id = v_max_id;
  END IF;
END;
$$;

-- Backfill: recompute balances for all existing groups with the new logic
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT id FROM groups LOOP
    PERFORM recompute_group_member_balances(r.id);
  END LOOP;
END;
$$;
