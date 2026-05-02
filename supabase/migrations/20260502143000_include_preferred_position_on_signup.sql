CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.users (id, username, full_name, avatar_url, preferred_position, birthday)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
      NEW.raw_user_meta_data->>'picture'
    ),
    NULLIF(NEW.raw_user_meta_data->>'preferred_position', ''),
    COALESCE((NEW.raw_user_meta_data->>'birthday')::date, '2000-01-01'::date)
  );
  RETURN NEW;
END;
$function$;
