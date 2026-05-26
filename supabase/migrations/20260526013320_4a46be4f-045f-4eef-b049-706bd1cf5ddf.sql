-- Convert empty-string phones to NULL so the unique index doesn't collide
UPDATE public.profiles SET phone = NULL WHERE phone = '';

-- Update handle_new_user to NULL out empty values
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role app_role;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, city)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'phone', ''), ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'city', ''), '')
  );
  IF lower(NEW.email) = 'matt@techtamer.online' THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'pending';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;