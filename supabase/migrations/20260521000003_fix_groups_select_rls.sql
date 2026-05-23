-- Allow group admin to see their own group immediately after creation,
-- before being inserted into group_members. Without this, the `.insert().select()`
-- in createGroup() returns 0 rows (RLS filters the newly created row), causing
-- the entire group creation to fail.
DROP POLICY "groups_select" ON groups;
CREATE POLICY "groups_select"
  ON groups FOR SELECT
  TO authenticated
  USING (admin_id = auth.uid() OR is_group_member(id));
