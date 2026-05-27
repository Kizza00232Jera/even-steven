CREATE OR REPLACE FUNCTION update_group_background_image(
  p_group_id UUID,
  p_url TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_group_member(p_group_id) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  UPDATE groups
  SET background_image_url = p_url,
      updated_at = NOW()
  WHERE id = p_group_id;
END;
$$;
