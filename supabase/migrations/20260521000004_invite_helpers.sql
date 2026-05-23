-- =============================================================================
-- Even Steven — Invite Helpers
-- =============================================================================
-- resolve_invite_token: SECURITY DEFINER so any caller (including anon role)
-- can validate a token and retrieve safe group info without bypassing-safe RLS.
-- show_balance_nudge: flag set by activate_invited_members trigger to surface
-- the "you have inherited balances" pop-up on first app open.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add show_balance_nudge to profiles
-- ---------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS show_balance_nudge BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- 2. Update activate_invited_members to set show_balance_nudge
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION activate_invited_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated INT;
BEGIN
  UPDATE public.group_members
  SET user_id = NEW.id,
      status  = 'active'
  WHERE email  = NEW.email
    AND user_id IS NULL
    AND status  = 'invited';

  GET DIAGNOSTICS rows_updated = ROW_COUNT;

  -- If any invited group_member rows were activated, set the nudge so the
  -- app can show "you have inherited balances" on first open.
  IF rows_updated > 0 THEN
    UPDATE public.profiles
    SET show_balance_nudge = TRUE
    WHERE id = NEW.id;
  END IF;

  UPDATE public.friendships
  SET friend_id = NEW.id,
      status    = 'active'
  WHERE friend_email = NEW.email
    AND friend_id IS NULL;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. resolve_invite_token — safe public lookup, bypasses RLS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_invite_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token     invite_tokens%ROWTYPE;
  v_group     groups%ROWTYPE;
  v_inviter   TEXT;
  v_count     BIGINT;
BEGIN
  SELECT * INTO v_token FROM invite_tokens WHERE token = p_token LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'not_found');
  END IF;

  IF v_token.invalidated_at IS NOT NULL THEN
    RETURN json_build_object('valid', false, 'error', 'invalidated');
  END IF;

  SELECT * INTO v_group FROM groups WHERE id = v_token.group_id;

  SELECT COUNT(*) INTO v_count
  FROM group_members
  WHERE group_id = v_token.group_id AND status = 'active';

  SELECT COALESCE(gm.display_name, p.display_name, p.email)
  INTO v_inviter
  FROM group_members gm
  LEFT JOIN profiles p ON p.id = gm.user_id
  WHERE gm.id = v_token.created_by
  LIMIT 1;

  RETURN json_build_object(
    'valid',        true,
    'group_id',     v_group.id,
    'group_name',   v_group.name,
    'group_type',   v_group.type,
    'start_date',   v_group.start_date,
    'end_date',     v_group.end_date,
    'member_count', v_count,
    'inviter_name', v_inviter
  );
END;
$$;

-- Allow anon and authenticated callers to invoke this function.
GRANT EXECUTE ON FUNCTION public.resolve_invite_token(TEXT) TO anon, authenticated;
