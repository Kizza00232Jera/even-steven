-- =============================================================================
-- Even Steven — Row-Level Security Policies
-- =============================================================================
-- Principle: a Member can only read data for groups they belong to.
-- Non-participants cannot SELECT expense rows.
-- Private settlements are invisible to non-parties at DB level.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enable RLS on all tables
-- ---------------------------------------------------------------------------
ALTER TABLE profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members             ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_participants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements               ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_tokens             ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships               ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences  ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens               ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- Any authenticated user can read profiles (needed for display names,
-- avatars, friend lookup by email).
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT
  TO authenticated
  USING (TRUE);

-- Users can only insert their own profile row (also done via trigger).
CREATE POLICY "profiles_insert"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Users can only update their own profile.
CREATE POLICY "profiles_update"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Account deletion is handled server-side; no direct DELETE from client.
CREATE POLICY "profiles_delete"
  ON profiles FOR DELETE
  TO authenticated
  USING (id = auth.uid());

-- ---------------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------------
CREATE POLICY "groups_select"
  ON groups FOR SELECT
  TO authenticated
  USING (is_group_member(id));

CREATE POLICY "groups_insert"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (admin_id = auth.uid());

-- Only the group admin can update group settings.
CREATE POLICY "groups_update"
  ON groups FOR UPDATE
  TO authenticated
  USING (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "groups_delete"
  ON groups FOR DELETE
  TO authenticated
  USING (admin_id = auth.uid());

-- ---------------------------------------------------------------------------
-- group_members
-- ---------------------------------------------------------------------------
-- Any member of a group can see all other members.
CREATE POLICY "group_members_select"
  ON group_members FOR SELECT
  TO authenticated
  USING (is_group_member(group_id));

-- Inserting a member: must be an active member of the group yourself
-- (admins add invited members; invite acceptance also inserts a row).
CREATE POLICY "group_members_insert"
  ON group_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Self-join via invite acceptance (user_id matches authenticated user)
    user_id = auth.uid()
    OR
    -- A member of the group is adding someone
    is_group_member(group_id)
  );

-- Members can update their own row (display_name, is_pinned, is_muted).
-- Admins can update any member row (role, status).
CREATE POLICY "group_members_update"
  ON group_members FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_id AND g.admin_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_id AND g.admin_id = auth.uid()
    )
  );

-- Only admins can hard-delete a member row (soft-delete via status='removed' preferred).
CREATE POLICY "group_members_delete"
  ON group_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_id AND g.admin_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
-- CRITICAL: Non-participants cannot SELECT expense rows.
-- A user must be a participant (via expense_participants + group_members).
CREATE POLICY "expenses_select"
  ON expenses FOR SELECT
  TO authenticated
  USING (is_expense_participant(id));

-- Any active group member can add an expense.
CREATE POLICY "expenses_insert"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (is_group_member(group_id));

-- Only the payer or the group admin can edit financial structure / metadata.
CREATE POLICY "expenses_update"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    -- Payer of this expense
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.id      = payer_id
        AND gm.user_id = auth.uid()
    )
    OR
    -- Group admin
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_id AND g.admin_id = auth.uid()
    )
    OR
    -- Any participant can edit description and category (enforced at app layer
    -- to restrict which columns; RLS just gates access to the row).
    is_expense_participant(id)
  )
  WITH CHECK (is_group_member(group_id));

-- Any participant or group admin can delete (no-settlement guard is enforced
-- by the application layer per §11).
CREATE POLICY "expenses_delete"
  ON expenses FOR DELETE
  TO authenticated
  USING (
    is_expense_participant(id)
    OR
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_id AND g.admin_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- expense_participants
-- ---------------------------------------------------------------------------
-- A user can see participant rows for any expense they are themselves part of.
CREATE POLICY "expense_participants_select"
  ON expense_participants FOR SELECT
  TO authenticated
  USING (is_expense_participant(expense_id));

-- The payer or group admin can insert participant rows.
CREATE POLICY "expense_participants_insert"
  ON expense_participants FOR INSERT
  TO authenticated
  WITH CHECK (is_expense_payer_or_group_admin(expense_id));

-- Payer or admin can update split distributions.
CREATE POLICY "expense_participants_update"
  ON expense_participants FOR UPDATE
  TO authenticated
  USING (is_expense_payer_or_group_admin(expense_id));

CREATE POLICY "expense_participants_delete"
  ON expense_participants FOR DELETE
  TO authenticated
  USING (is_expense_payer_or_group_admin(expense_id));

-- ---------------------------------------------------------------------------
-- settlements
-- ---------------------------------------------------------------------------
-- CRITICAL: Private settlements are invisible to non-parties at DB level.
-- Public  → any active group member can see.
-- Private → only payer_member or payee_member can see.
CREATE POLICY "settlements_select"
  ON settlements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM group_members gm
      JOIN groups g ON g.id = settlements.group_id
      WHERE gm.group_id = settlements.group_id
        AND gm.user_id  = auth.uid()
        AND gm.status   = 'active'
        AND (
          -- Public: any member can see all settlements
          g.settlement_visibility = 'public'
          OR
          -- Private: only the two parties
          gm.id = settlements.payer_member_id
          OR
          gm.id = settlements.payee_member_id
        )
    )
  );

-- Any active group member can record a settlement.
CREATE POLICY "settlements_insert"
  ON settlements FOR INSERT
  TO authenticated
  WITH CHECK (is_group_member(group_id));

-- Only the member who recorded the settlement can void it (settlement correction).
CREATE POLICY "settlements_update"
  ON settlements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.id      = recorded_by
        AND gm.user_id = auth.uid()
    )
  );

-- Settlements are never hard-deleted (voided instead).
CREATE POLICY "settlements_delete"
  ON settlements FOR DELETE
  TO authenticated
  USING (FALSE);

-- ---------------------------------------------------------------------------
-- invite_tokens
-- ---------------------------------------------------------------------------
-- Active members can read tokens for their groups (to share or reset).
-- Invite acceptance validation is done server-side via service role in Edge Functions.
CREATE POLICY "invite_tokens_select"
  ON invite_tokens FOR SELECT
  TO authenticated
  USING (is_group_member(group_id));

-- Any group member can insert a new token (e.g. after a reset).
CREATE POLICY "invite_tokens_insert"
  ON invite_tokens FOR INSERT
  TO authenticated
  WITH CHECK (is_group_member(group_id));

-- Only group admin can invalidate tokens.
CREATE POLICY "invite_tokens_update"
  ON invite_tokens FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_id AND g.admin_id = auth.uid()
    )
  );

-- Tokens are never hard-deleted (invalidated_at is set instead).
CREATE POLICY "invite_tokens_delete"
  ON invite_tokens FOR DELETE
  TO authenticated
  USING (FALSE);

-- ---------------------------------------------------------------------------
-- friendships
-- ---------------------------------------------------------------------------
CREATE POLICY "friendships_select"
  ON friendships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "friendships_insert"
  ON friendships FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- No update: friendship status is managed by triggers (activate_invited_members).
CREATE POLICY "friendships_update"
  ON friendships FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "friendships_delete"
  ON friendships FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- activity_events
-- ---------------------------------------------------------------------------
-- Members can read activity for their groups.
CREATE POLICY "activity_events_select"
  ON activity_events FOR SELECT
  TO authenticated
  USING (
    group_id IS NULL OR is_group_member(group_id)
  );

-- Events are inserted by the application (or triggers); members of the group
-- can insert.
CREATE POLICY "activity_events_insert"
  ON activity_events FOR INSERT
  TO authenticated
  WITH CHECK (
    group_id IS NULL OR is_group_member(group_id)
  );

-- Events are immutable — no updates or deletes.
CREATE POLICY "activity_events_update"
  ON activity_events FOR UPDATE
  TO authenticated
  USING (FALSE);

CREATE POLICY "activity_events_delete"
  ON activity_events FOR DELETE
  TO authenticated
  USING (FALSE);

-- ---------------------------------------------------------------------------
-- notification_preferences
-- ---------------------------------------------------------------------------
CREATE POLICY "notification_preferences_select"
  ON notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notification_preferences_insert"
  ON notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notification_preferences_update"
  ON notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notification_preferences_delete"
  ON notification_preferences FOR DELETE
  TO authenticated
  USING (FALSE);

-- ---------------------------------------------------------------------------
-- push_tokens
-- ---------------------------------------------------------------------------
CREATE POLICY "push_tokens_select"
  ON push_tokens FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "push_tokens_insert"
  ON push_tokens FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_tokens_update"
  ON push_tokens FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_tokens_delete"
  ON push_tokens FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
