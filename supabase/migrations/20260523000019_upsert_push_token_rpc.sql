-- push_tokens INSERT WITH CHECK (user_id = auth.uid()) blocked by same broken context.
-- SECURITY DEFINER RPC bypasses it and enforces ownership internally.

CREATE OR REPLACE FUNCTION public.upsert_push_token(
  p_user_id uuid,
  p_token   text,
  p_platform text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  DELETE FROM push_tokens WHERE user_id = p_user_id;
  INSERT INTO push_tokens (user_id, token, platform)
  VALUES (p_user_id, p_token, p_platform);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_push_token TO authenticated;
