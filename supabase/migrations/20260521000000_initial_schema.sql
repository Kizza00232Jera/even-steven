-- =============================================================================
-- Even Steven — Initial Schema
-- =============================================================================
-- Tables: profiles, groups, group_members, expenses, expense_participants,
--         settlements, invite_tokens, friendships, activity_events,
--         notification_preferences, push_tokens
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id                 UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email              TEXT        NOT NULL UNIQUE,
  display_name       TEXT        CHECK (char_length(display_name) <= 60),
  avatar_url         TEXT,                          -- custom upload (Supabase Storage)
  google_avatar_url  TEXT,                          -- pulled from Google on each login
  preferred_currency TEXT        NOT NULL DEFAULT 'USD'
                     CHECK (preferred_currency IN ('USD', 'EUR', 'DKK', 'SEK')),
  onboarding_done    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. groups
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS groups (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT        NOT NULL CHECK (char_length(name) <= 30),
  type                   TEXT        NOT NULL
                         CHECK (type IN ('Trip', 'Home', 'Couple', 'Utilities', 'Family', 'Other')),
  base_currency          TEXT        NOT NULL
                         CHECK (base_currency IN ('USD', 'EUR', 'DKK', 'SEK')),
  admin_id               UUID        NOT NULL REFERENCES profiles(id),
  status                 TEXT        NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'expired', 'archived')),
  start_date             DATE,        -- Trip groups only
  end_date               DATE,        -- Trip groups only
  settlement_visibility  TEXT        NOT NULL DEFAULT 'public'
                         CHECK (settlement_visibility IN ('public', 'private')),
  background_image_url   TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Trip groups must have both dates or neither
  CONSTRAINT trip_dates_required
    CHECK (type != 'Trip' OR (start_date IS NOT NULL AND end_date IS NOT NULL)),
  CONSTRAINT trip_dates_order
    CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date),
  -- Non-trip groups must not have dates
  CONSTRAINT non_trip_no_dates
    CHECK (type = 'Trip' OR (start_date IS NULL AND end_date IS NULL)),
  -- Expired status only valid for Trip groups
  CONSTRAINT expired_trips_only
    CHECK (status != 'expired' OR type = 'Trip')
);

-- Immutability trigger: prevent changing base_currency after insert
CREATE OR REPLACE FUNCTION prevent_base_currency_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.base_currency IS DISTINCT FROM OLD.base_currency THEN
    RAISE EXCEPTION 'base_currency is immutable after group creation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_groups_base_currency_immutable
  BEFORE UPDATE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION prevent_base_currency_change();

-- ---------------------------------------------------------------------------
-- 3. group_members
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_members (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id      UUID        REFERENCES profiles(id) ON DELETE SET NULL,  -- NULL = invited, not yet registered
  email        TEXT        NOT NULL,
  display_name TEXT,                                -- group-level override; NULL = fall through to profile
  role         TEXT        NOT NULL DEFAULT 'member'
               CHECK (role IN ('admin', 'member')),
  status       TEXT        NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'invited', 'removed')),
  is_pinned    BOOLEAN     NOT NULL DEFAULT FALSE,
  is_muted     BOOLEAN     NOT NULL DEFAULT FALSE,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, email)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id  ON group_members (user_id);

-- ---------------------------------------------------------------------------
-- 4. expenses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 60),
  description   TEXT        CHECK (char_length(description) <= 500),
  amount        NUMERIC(12,2) NOT NULL
                CHECK (amount >= 0.01 AND amount <= 999999.99),
  currency      TEXT        NOT NULL CHECK (currency IN ('USD', 'EUR', 'DKK', 'SEK')),
  category      TEXT        NOT NULL DEFAULT 'Other',
  payer_id      UUID        NOT NULL REFERENCES group_members(id),
  split_method  TEXT        NOT NULL
                CHECK (split_method IN ('equal', 'unequal', 'percentage')),
  expense_date  DATE        NOT NULL,
  receipt_url   TEXT,
  is_edited     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON expenses (group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payer_id ON expenses (payer_id);

-- Immutability trigger: prevent changing amount once a settlement exists in the group
CREATE OR REPLACE FUNCTION prevent_expense_amount_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    IF EXISTS (
      SELECT 1 FROM settlements
      WHERE group_id = NEW.group_id
        AND is_voided = FALSE
    ) THEN
      RAISE EXCEPTION
        'expense amount is locked once settlements have been recorded in this group';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_expenses_amount_immutable
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION prevent_expense_amount_change();

-- ---------------------------------------------------------------------------
-- 5. expense_participants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_participants (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id        UUID          NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id         UUID          NOT NULL REFERENCES group_members(id),
  share_amount      NUMERIC(12,2) NOT NULL CHECK (share_amount >= 0),
  share_percentage  NUMERIC(5,2)  CHECK (share_percentage IS NULL OR share_percentage >= 0),
  UNIQUE (expense_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_expense_participants_expense_id ON expense_participants (expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_participants_member_id  ON expense_participants (member_id);

-- ---------------------------------------------------------------------------
-- 6. settlements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settlements (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         UUID          NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  payer_member_id  UUID          NOT NULL REFERENCES group_members(id), -- who paid
  payee_member_id  UUID          NOT NULL REFERENCES group_members(id), -- who received
  amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency         TEXT          NOT NULL CHECK (currency IN ('USD', 'EUR', 'DKK', 'SEK')),
  recorded_by      UUID          NOT NULL REFERENCES group_members(id), -- who logged it
  is_voided        BOOLEAN       NOT NULL DEFAULT FALSE,
  voided_by        UUID          REFERENCES group_members(id),
  voided_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT payer_and_payee_differ
    CHECK (payer_member_id != payee_member_id),
  CONSTRAINT void_requires_voider
    CHECK (NOT is_voided OR (voided_by IS NOT NULL AND voided_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_settlements_group_id        ON settlements (group_id);
CREATE INDEX IF NOT EXISTS idx_settlements_payer_member_id ON settlements (payer_member_id);
CREATE INDEX IF NOT EXISTS idx_settlements_payee_member_id ON settlements (payee_member_id);

-- ---------------------------------------------------------------------------
-- 7. invite_tokens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invite_tokens (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  token           TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_by      UUID        NOT NULL REFERENCES group_members(id),
  invalidated_at  TIMESTAMPTZ,         -- NULL = currently valid
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_group_id ON invite_tokens (group_id);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_token    ON invite_tokens (token);

-- ---------------------------------------------------------------------------
-- 8. friendships
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS friendships (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,  -- NULL = not yet registered
  friend_email  TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('active', 'pending')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, friend_email),
  CONSTRAINT no_self_friendship CHECK (user_id != friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_id   ON friendships (user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships (friend_id);

-- ---------------------------------------------------------------------------
-- 9. activity_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID        REFERENCES groups(id) ON DELETE CASCADE,
  actor_id    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  event_type  TEXT        NOT NULL
              CHECK (event_type IN (
                'expense_added', 'expense_edited', 'expense_deleted',
                'settlement_recorded', 'settlement_voided',
                'member_joined', 'member_removed', 'member_left',
                'group_created', 'group_archived', 'group_unarchived',
                'invite_link_reset', 'trip_expired'
              )),
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_group_id   ON activity_events (group_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_actor_id   ON activity_events (actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_created_at ON activity_events (created_at DESC);

-- ---------------------------------------------------------------------------
-- 10. notification_preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_preferences (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  -- Default ON (per §17)
  trip_expired          BOOLEAN     NOT NULL DEFAULT TRUE,
  -- Default OFF (per §17)
  someone_joins_group   BOOLEAN     NOT NULL DEFAULT FALSE,
  someone_added         BOOLEAN     NOT NULL DEFAULT FALSE,
  member_removed        BOOLEAN     NOT NULL DEFAULT FALSE,
  trip_end_approaching  BOOLEAN     NOT NULL DEFAULT FALSE,
  trip_ends_today       BOOLEAN     NOT NULL DEFAULT FALSE,
  new_expense           BOOLEAN     NOT NULL DEFAULT FALSE,
  expense_edited        BOOLEAN     NOT NULL DEFAULT FALSE,
  expense_deleted       BOOLEAN     NOT NULL DEFAULT FALSE,
  payment_received      BOOLEAN     NOT NULL DEFAULT FALSE,
  payment_in_group      BOOLEAN     NOT NULL DEFAULT FALSE,
  balance_reaches_zero  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 11. push_tokens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL UNIQUE,
  platform    TEXT        CHECK (platform IN ('ios', 'android')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Helpers (defined after tables so SQL function bodies can be validated)
-- ---------------------------------------------------------------------------

-- Returns the group_member row for the current authenticated user in a group.
CREATE OR REPLACE FUNCTION current_member_id(p_group_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM group_members
  WHERE group_id = p_group_id
    AND user_id  = auth.uid()
    AND status   = 'active'
  LIMIT 1;
$$;

-- Returns true if the current user is an active member of the group.
CREATE OR REPLACE FUNCTION is_group_member(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_members
    WHERE group_id = p_group_id
      AND user_id  = auth.uid()
      AND status   = 'active'
  );
$$;

-- Returns true if the current user is a participant of an expense.
CREATE OR REPLACE FUNCTION is_expense_participant(p_expense_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM expense_participants ep
    JOIN group_members gm ON ep.member_id = gm.id
    WHERE ep.expense_id = p_expense_id
      AND gm.user_id    = auth.uid()
  );
$$;

-- Returns true if the current user is the payer of an expense or the group admin.
CREATE OR REPLACE FUNCTION is_expense_payer_or_group_admin(p_expense_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM expenses e
    JOIN group_members gm ON gm.id = e.payer_id
    WHERE e.id       = p_expense_id
      AND gm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM expenses e
    JOIN groups g ON g.id = e.group_id
    WHERE e.id       = p_expense_id
      AND g.admin_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Auto-update updated_at columns
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create profile on new auth user
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, google_avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Auto-activate invited member when they register with the same email
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION activate_invited_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.group_members
  SET user_id = NEW.id,
      status  = 'active'
  WHERE email  = NEW.email
    AND user_id IS NULL
    AND status  = 'invited';

  UPDATE public.friendships
  SET friend_id = NEW.id,
      status    = 'active'
  WHERE friend_email = NEW.email
    AND friend_id IS NULL;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_activate_invited_members
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION activate_invited_members();
