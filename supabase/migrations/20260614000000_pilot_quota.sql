ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS generation_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quota_limit INTEGER NOT NULL DEFAULT 10;

CREATE OR REPLACE FUNCTION public.increment_generation_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE new_count INTEGER;
BEGIN
  INSERT INTO public.user_settings (user_id, generation_count)
  VALUES (p_user_id, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET generation_count = public.user_settings.generation_count + 1
  RETURNING generation_count INTO new_count;
  RETURN new_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_generation_count(UUID) TO authenticated, service_role;
