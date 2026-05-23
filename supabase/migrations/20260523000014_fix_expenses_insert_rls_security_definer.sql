-- The inline EXISTS approach still fails because reading group_members triggers
-- group_members_select RLS, which calls is_group_member(), which calls auth.uid()
-- in a nested RLS evaluation context where it appears to return NULL.
--
-- Root fix: wrap the entire check in a SECURITY DEFINER function that:
--   1. Runs as postgres (superuser) → bypasses group_members RLS entirely
--   2. Reads current_setting('request.jwt.claim.sub') directly instead of
--      calling auth.uid() — eliminates any caching/inlining path
--   3. Is VOLATILE to prevent any plan-time evaluation

CREATE OR REPLACE FUNCTION public.current_user_is_group_member(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_members
    WHERE group_id = p_group_id
      AND user_id  = nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      AND status   = 'active'
  );
$$;

DROP POLICY IF EXISTS expenses_insert ON public.expenses;

CREATE POLICY expenses_insert ON public.expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_is_group_member(group_id)
  );
