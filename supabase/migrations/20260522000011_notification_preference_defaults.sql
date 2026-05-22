-- Fix notification preference defaults (issue #48 / PRD #41)
-- Four columns should default to true: new_expense, payment_received,
-- someone_joins_group, someone_added.
-- trip_expired reverted to false (spec updated in PRD #41).
-- Existing rows are unaffected — only the column DEFAULT is changed.

ALTER TABLE notification_preferences
  ALTER COLUMN new_expense         SET DEFAULT TRUE,
  ALTER COLUMN payment_received    SET DEFAULT TRUE,
  ALTER COLUMN someone_joins_group SET DEFAULT TRUE,
  ALTER COLUMN someone_added       SET DEFAULT TRUE,
  ALTER COLUMN trip_expired        SET DEFAULT FALSE;

-- Re-create handle_new_auth_user to explicitly set the four default-on
-- columns so the intent is clear and independent of column defaults.
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, google_avatar_url, google_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO UPDATE SET
    email             = EXCLUDED.email,
    google_avatar_url = EXCLUDED.google_avatar_url,
    google_name       = COALESCE(EXCLUDED.google_name, profiles.google_name);

  INSERT INTO public.notification_preferences (
    user_id,
    new_expense,
    payment_received,
    someone_joins_group,
    someone_added
  )
  VALUES (NEW.id, TRUE, TRUE, TRUE, TRUE)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
