-- Create profile-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for profile-photos
DROP POLICY IF EXISTS "authenticated users can upload profile photos" ON storage.objects;
CREATE POLICY "authenticated users can upload profile photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "anyone can view profile photos" ON storage.objects;
CREATE POLICY "anyone can view profile photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "authenticated users can update profile photos" ON storage.objects;
CREATE POLICY "authenticated users can update profile photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "authenticated users can delete profile photos" ON storage.objects;
CREATE POLICY "authenticated users can delete profile photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'profile-photos');

-- Create group-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-photos', 'group-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for group-photos
DROP POLICY IF EXISTS "authenticated users can upload group photos" ON storage.objects;
CREATE POLICY "authenticated users can upload group photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'group-photos');

DROP POLICY IF EXISTS "anyone can view group photos" ON storage.objects;
CREATE POLICY "anyone can view group photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'group-photos');

DROP POLICY IF EXISTS "authenticated users can update group photos" ON storage.objects;
CREATE POLICY "authenticated users can update group photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'group-photos');

DROP POLICY IF EXISTS "authenticated users can delete group photos" ON storage.objects;
CREATE POLICY "authenticated users can delete group photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'group-photos');
