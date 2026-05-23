-- WITH CHECK evaluation appears to run in a context where JWT claims
-- are not accessible — even SECURITY DEFINER + plpgsql + both claim paths fail.
-- SELECT policies (USING clause) work fine because they use the same auth.uid()
-- in a different evaluation context.
--
-- Approach: drop the membership WITH CHECK entirely, replace it with a
-- BEFORE INSERT trigger. Triggers run in the normal execution context
-- (same as USING policies), so auth.uid() is reliably set.
--
-- WITH CHECK is set to (auth.uid() IS NOT NULL) — authenticated only,
-- which is already guaranteed by TO authenticated. Trigger does the
-- actual membership enforcement.

-- Step 1: trigger function
CREATE OR REPLACE FUNCTION public.enforce_expense_group_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = NEW.group_id
      AND user_id  = auth.uid()
      AND status   = 'active'
  ) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;
  RETURN NEW;
END;
$$;

-- Step 2: attach trigger
DROP TRIGGER IF EXISTS expenses_insert_membership_check ON public.expenses;
CREATE TRIGGER expenses_insert_membership_check
  BEFORE INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_expense_group_membership();

-- Step 3: simplify WITH CHECK to just require authentication
DROP POLICY IF EXISTS expenses_insert ON public.expenses;
CREATE POLICY expenses_insert ON public.expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
