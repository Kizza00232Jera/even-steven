-- Create receipts storage bucket for expense receipt images
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload receipts
CREATE POLICY "authenticated users can upload receipts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'receipts');

-- Allow public read (URLs are public; expense RLS controls who sees the URL)
CREATE POLICY "anyone can view receipts"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'receipts');

-- Allow authenticated users to update (replace) their receipts
CREATE POLICY "authenticated users can update receipts"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'receipts');

-- Allow authenticated users to delete receipts
CREATE POLICY "authenticated users can delete receipts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'receipts');
