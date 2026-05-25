-- is_group_member, is_expense_participant, and is_expense_payer_or_group_admin
-- were marked STABLE, which allows PostgreSQL's query planner to cache their
-- results at plan time — before JWT claims are populated. This causes
-- auth.uid() to return NULL inside each function, making every membership /
-- participant check return false and blocking every expense INSERT with an
-- RLS violation.
--
-- Changing all three to VOLATILE forces the planner to re-evaluate them at
-- execution time when the JWT context is correctly populated.

ALTER FUNCTION is_group_member(UUID) VOLATILE;
ALTER FUNCTION is_expense_participant(UUID) VOLATILE;
ALTER FUNCTION is_expense_payer_or_group_admin(UUID) VOLATILE;
