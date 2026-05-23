-- RLS WITH CHECK context is broken for this table regardless of policy content.
-- Use a SECURITY DEFINER RPC that runs as postgres, bypasses RLS, and enforces
-- membership itself. This is the standard Supabase pattern for writes where RLS
-- WITH CHECK is unreliable.

CREATE OR REPLACE FUNCTION public.create_expense(
  p_group_id    uuid,
  p_title       text,
  p_description text,
  p_amount      numeric,
  p_currency    text,
  p_category    text,
  p_payer_id    uuid,
  p_split_method text,
  p_expense_date date,
  p_receipt_url text,
  p_splits      jsonb
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
    WHERE group_id = p_group_id
      AND user_id  = v_user_id
      AND status   = 'active'
  ) THEN
    RAISE EXCEPTION 'Not a member of this group' USING ERRCODE = '42501';
  END IF;

  INSERT INTO expenses (
    group_id, title, description, amount, currency,
    category, payer_id, split_method, expense_date, receipt_url
  ) VALUES (
    p_group_id, p_title, p_description, p_amount, p_currency,
    p_category, p_payer_id, p_split_method, p_expense_date, p_receipt_url
  )
  RETURNING id INTO v_expense_id;

  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    INSERT INTO expense_participants (expense_id, member_id, share_amount)
    VALUES (
      v_expense_id,
      (v_split->>'memberId')::uuid,
      (v_split->>'share')::numeric
    );
  END LOOP;

  RETURN v_expense_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_expense TO authenticated;
