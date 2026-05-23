-- Store Gmail name on profiles for display name fallback chain (spec §19)
-- Priority: group display name → account display name → Gmail name → email

ALTER TABLE profiles
  ADD COLUMN google_name TEXT;

-- Update trigger to capture Gmail name from Google OAuth metadata
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

  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
