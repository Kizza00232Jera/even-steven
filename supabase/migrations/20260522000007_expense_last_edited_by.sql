-- Track which group member last edited an expense
-- Used by Realtime handler to show "edited by [name]" toast to other viewers

ALTER TABLE expenses
  ADD COLUMN last_edited_by uuid REFERENCES group_members(id) ON DELETE SET NULL;
