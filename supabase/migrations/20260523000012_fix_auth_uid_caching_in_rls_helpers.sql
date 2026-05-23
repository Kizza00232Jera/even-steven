-- The VOLATILE migration prevented caching of the helper functions themselves,
-- but auth.uid() is STABLE. When PostgreSQL inlines a SQL function body into
-- the RLS policy expression, the STABLE auth.uid() can be evaluated once at
-- plan time (before JWT claims are set), returning NULL and causing every
-- membership check to fail.
--
-- Fix: wrap auth.uid() in (SELECT auth.uid()) in all three helpers. The
-- subquery form is an optimisation barrier that forces re-evaluation at
-- execution time regardless of inlining.

CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid)
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
      AND user_id  = (SELECT auth.uid())
      AND status   = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_expense_participant(p_expense_id uuid)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM expense_participants ep
    JOIN group_members gm ON ep.member_id = gm.id
    WHERE ep.expense_id = p_expense_id
      AND gm.user_id    = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_expense_payer_or_group_admin(p_expense_id uuid)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM expenses e
    JOIN group_members gm ON gm.id = e.payer_id
    WHERE e.id       = p_expense_id
      AND gm.user_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM expenses e
    JOIN groups g ON g.id = e.group_id
    WHERE e.id       = p_expense_id
      AND g.admin_id = (SELECT auth.uid())
  );
$$;
