-- Add base-currency columns so the balance trigger operates in a single
-- currency regardless of what currency each expense was entered in.
-- Nullable: existing rows fall back to raw amount in trigger.

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS base_currency_amount DECIMAL(12,2);

ALTER TABLE expense_participants
  ADD COLUMN IF NOT EXISTS base_share_amount DECIMAL(12,2);

DROP FUNCTION IF EXISTS public.create_expense(uuid,text,text,numeric,text,text,uuid,text,date,text,jsonb);

CREATE OR REPLACE FUNCTION public.create_expense(
  p_group_id             uuid,
  p_title                text,
  p_description          text,
  p_amount               numeric,
  p_currency             text,
  p_category             text,
  p_payer_id             uuid,
  p_split_method         text,
  p_expense_date         date,
  p_receipt_url          text,
  p_splits               jsonb,
  p_base_currency_amount numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid;
  v_expense_id uuid;
  v_split      jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id AND user_id = v_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not a member of this group' USING ERRCODE = '42501';
  END IF;

  INSERT INTO expenses (
    group_id, title, description, amount, currency,
    category, payer_id, split_method, expense_date, receipt_url,
    base_currency_amount
  ) VALUES (
    p_group_id, p_title, p_description, p_amount, p_currency,
    p_category, p_payer_id, p_split_method, p_expense_date, p_receipt_url,
    p_base_currency_amount
  )
  RETURNING id INTO v_expense_id;

  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    INSERT INTO expense_participants (expense_id, member_id, share_amount, base_share_amount)
    VALUES (
      v_expense_id,
      (v_split->>'memberId')::uuid,
      (v_split->>'share')::numeric,
      nullif(v_split->>'baseShare', '')::numeric
    );
  END LOOP;

  RETURN v_expense_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_expense TO authenticated;

CREATE OR REPLACE FUNCTION public.recompute_group_member_balances(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE group_members gm
  SET balance = (
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
  )
  WHERE gm.group_id = p_group_id;
END;
$$;
