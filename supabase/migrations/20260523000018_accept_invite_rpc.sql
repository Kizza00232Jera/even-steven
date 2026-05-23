-- Same RLS WITH CHECK problem as expenses: auth.uid() unreliable in WITH CHECK context.
-- Use SECURITY DEFINER RPC that bypasses RLS and enforces rules internally.

CREATE OR REPLACE FUNCTION public.accept_invite(
  p_group_id uuid,
  p_user_id  uuid,
  p_email    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Caller must only add themselves
  IF v_uid <> p_user_id THEN
    RAISE EXCEPTION 'Cannot join on behalf of another user' USING ERRCODE = '42501';
  END IF;

  -- Upsert: silently succeed if already an active member
  INSERT INTO group_members (group_id, user_id, email, role, status)
  VALUES (p_group_id, p_user_id, p_email, 'member', 'active')
  ON CONFLICT (group_id, user_id) DO UPDATE
    SET status = 'active',
        email  = EXCLUDED.email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invite TO authenticated;
