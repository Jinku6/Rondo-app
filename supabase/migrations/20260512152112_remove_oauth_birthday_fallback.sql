BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  user_phone text := NULLIF(NEW.raw_user_meta_data->>'phone', '');
  user_birthday date := NULLIF(NEW.raw_user_meta_data->>'birthday', '')::date;
BEGIN
  INSERT INTO public.users (id, username, full_name, avatar_url, preferred_position)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
      NEW.raw_user_meta_data->>'picture'
    ),
    NULLIF(NEW.raw_user_meta_data->>'preferred_position', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    avatar_url = COALESCE(public.users.avatar_url, EXCLUDED.avatar_url),
    preferred_position = COALESCE(EXCLUDED.preferred_position, public.users.preferred_position);

  INSERT INTO public.user_account_private (user_id, birthday)
  VALUES (NEW.id, user_birthday)
  ON CONFLICT (user_id) DO UPDATE SET
    birthday = COALESCE(EXCLUDED.birthday, public.user_account_private.birthday),
    updated_at = now();

  IF user_phone IS NOT NULL AND to_regclass('public.user_private_data') IS NOT NULL THEN
    EXECUTE
      'INSERT INTO public.user_private_data (user_id, phone)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone, updated_at = now()'
    USING NEW.id, user_phone;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

UPDATE public.user_account_private account
SET birthday = NULL,
    updated_at = now()
WHERE account.birthday = '2000-01-01'::date
  AND abs(extract(epoch FROM (account.updated_at - account.created_at))) < 5
  AND EXISTS (
    SELECT 1
    FROM auth.identities identity
    WHERE identity.user_id = account.user_id
      AND identity.provider IN ('google', 'apple')
  );

COMMIT;
