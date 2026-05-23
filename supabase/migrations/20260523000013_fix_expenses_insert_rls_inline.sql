-- All attempts to fix the helper functions failed. The expenses INSERT RLS
-- policy is rewritten as a direct inline EXISTS subquery to eliminate every
-- possible variable: function inlining, SECURITY DEFINER context, caching.
--
-- The first inline attempt had a column-scoping bug:
--   WHERE gm.group_id = group_id
-- resolved as gm.group_id = gm.group_id (always true) because bare `group_id`
-- inside the subquery resolved to the nearest alias, not the new expenses row.
-- Must use explicit table qualification: expenses.group_id.

DROP POLICY IF EXISTS expenses_insert ON public.expenses;

CREATE POLICY expenses_insert ON public.expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = expenses.group_id
        AND gm.user_id  = (SELECT auth.uid())
        AND gm.status   = 'active'
    )
  );
