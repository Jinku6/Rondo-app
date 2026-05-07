-- Rondo security hardening: make the app login-only, move private account
-- fields out of public profile rows, close public RPC/storage exposure, and
-- tighten review integrity at the database boundary.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_account_private (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  birthday date,
  provider_account_id text,
  provider_customer_id text,
  payment_onboarding_complete boolean NOT NULL DEFAULT false,
  cancellations_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_account_private ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  select_list text := 'id';
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'birthday'
  ) THEN
    select_list := select_list || ', birthday';
  ELSE
    select_list := select_list || ', NULL::date AS birthday';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'provider_account_id'
  ) THEN
    select_list := select_list || ', provider_account_id';
  ELSE
    select_list := select_list || ', NULL::text AS provider_account_id';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'provider_customer_id'
  ) THEN
    select_list := select_list || ', provider_customer_id';
  ELSE
    select_list := select_list || ', NULL::text AS provider_customer_id';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'payment_onboarding_complete'
  ) THEN
    select_list := select_list || ', COALESCE(payment_onboarding_complete, false) AS payment_onboarding_complete';
  ELSE
    select_list := select_list || ', false AS payment_onboarding_complete';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'cancellations_count'
  ) THEN
    select_list := select_list || ', COALESCE(cancellations_count, 0) AS cancellations_count';
  ELSE
    select_list := select_list || ', 0 AS cancellations_count';
  END IF;

  EXECUTE format(
    'INSERT INTO public.user_account_private (
       user_id,
       birthday,
       provider_account_id,
       provider_customer_id,
       payment_onboarding_complete,
       cancellations_count
     )
     SELECT %s FROM public.users
     ON CONFLICT (user_id) DO UPDATE SET
       birthday = COALESCE(EXCLUDED.birthday, public.user_account_private.birthday),
       provider_account_id = COALESCE(EXCLUDED.provider_account_id, public.user_account_private.provider_account_id),
       provider_customer_id = COALESCE(EXCLUDED.provider_customer_id, public.user_account_private.provider_customer_id),
       payment_onboarding_complete = EXCLUDED.payment_onboarding_complete,
       cancellations_count = GREATEST(EXCLUDED.cancellations_count, public.user_account_private.cancellations_count)',
    select_list
  );
END;
$$;

ALTER TABLE public.users DROP COLUMN IF EXISTS birthday;
ALTER TABLE public.users DROP COLUMN IF EXISTS provider_account_id;
ALTER TABLE public.users DROP COLUMN IF EXISTS provider_customer_id;
ALTER TABLE public.users DROP COLUMN IF EXISTS payment_onboarding_complete;
ALTER TABLE public.users DROP COLUMN IF EXISTS cancellations_count;

DROP POLICY IF EXISTS "Private account: read own" ON public.user_account_private;
CREATE POLICY "Private account: read own"
  ON public.user_account_private
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Private account: insert own" ON public.user_account_private;
CREATE POLICY "Private account: insert own"
  ON public.user_account_private
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Private account: update own" ON public.user_account_private;
CREATE POLICY "Private account: update own"
  ON public.user_account_private
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users: read all" ON public.users;
DROP POLICY IF EXISTS "Users: insert own" ON public.users;
DROP POLICY IF EXISTS "Users: update own" ON public.users;

CREATE POLICY "Users: read authenticated"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users: insert own"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users: update own"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Matches: read all" ON public.matches;
DROP POLICY IF EXISTS "Matches: insert own" ON public.matches;
DROP POLICY IF EXISTS "Matches: update own" ON public.matches;
DROP POLICY IF EXISTS "Matches: delete own" ON public.matches;

CREATE POLICY "Matches: read authenticated discoverable or related"
  ON public.matches
  FOR SELECT
  TO authenticated
  USING (
    status IN ('open', 'full')
    OR organizer_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.match_participants mp
      WHERE mp.match_id = matches.id
        AND mp.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Matches: insert own"
  ON public.matches
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = organizer_id);

CREATE POLICY "Matches: update own"
  ON public.matches
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = organizer_id)
  WITH CHECK ((select auth.uid()) = organizer_id);

CREATE POLICY "Matches: delete own"
  ON public.matches
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = organizer_id);

DROP POLICY IF EXISTS "Participants: read all" ON public.match_participants;
DROP POLICY IF EXISTS "Participants: insert self" ON public.match_participants;
DROP POLICY IF EXISTS "Participants: organizer can update status" ON public.match_participants;
DROP POLICY IF EXISTS "Participants: self can only drop" ON public.match_participants;
DROP POLICY IF EXISTS "Participants: delete own" ON public.match_participants;

CREATE POLICY "Participants: read authenticated discoverable or related"
  ON public.match_participants
  FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_participants.match_id
        AND (
          m.status IN ('open', 'full')
          OR m.organizer_id = (select auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.match_participants mine
            WHERE mine.match_id = m.id
              AND mine.user_id = (select auth.uid())
          )
        )
    )
  );

CREATE POLICY "Participants: insert self"
  ON public.match_participants
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Participants: organizer can update status"
  ON public.match_participants
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_participants.match_id
        AND m.organizer_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_participants.match_id
        AND m.organizer_id = (select auth.uid())
    )
  );

CREATE POLICY "Participants: self can drop only"
  ON public.match_participants
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id AND status = 'dropped');

CREATE POLICY "Participants: delete own"
  ON public.match_participants
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Reviews: read all" ON public.match_reviews;
DROP POLICY IF EXISTS "Reviews: insert by organizer" ON public.match_reviews;
DROP POLICY IF EXISTS "Reviews: insert by attended player" ON public.match_reviews;

CREATE POLICY "Reviews: read related"
  ON public.match_reviews
  FOR SELECT
  TO authenticated
  USING (
    reviewer_id = (select auth.uid())
    OR reviewee_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_reviews.match_id
        AND m.organizer_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.match_participants mp
      WHERE mp.match_id = match_reviews.match_id
        AND mp.user_id = (select auth.uid())
        AND mp.status IN ('joined', 'approved')
    )
  );

CREATE POLICY "Reviews: insert by organizer"
  ON public.match_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = reviewer_id
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_reviews.match_id
        AND m.organizer_id = (select auth.uid())
        AND m.status = 'completed'
    )
  );

CREATE POLICY "Reviews: insert by attended player"
  ON public.match_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = reviewer_id
    AND reviewer_id <> reviewee_id
    AND match_reviews.attended = true
    AND level_rating IS NOT NULL
    AND attitude IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_reviews.match_id
        AND m.status = 'completed'
    )
    AND EXISTS (
      SELECT 1
      FROM public.match_participants reviewer
      WHERE reviewer.match_id = match_reviews.match_id
        AND reviewer.user_id = (select auth.uid())
        AND reviewer.status IN ('joined', 'approved')
        AND reviewer.attended = true
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.matches m
        WHERE m.id = match_reviews.match_id
          AND m.organizer_id = match_reviews.reviewee_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.match_participants reviewee
        WHERE reviewee.match_id = match_reviews.match_id
          AND reviewee.user_id = match_reviews.reviewee_id
          AND reviewee.status IN ('joined', 'approved')
          AND reviewee.attended = true
      )
    )
  );

DROP POLICY IF EXISTS "Users can view their own private data" ON public.user_private_data;
DROP POLICY IF EXISTS "Users can insert their own private data" ON public.user_private_data;
DROP POLICY IF EXISTS "Users can update their own private data" ON public.user_private_data;
DROP POLICY IF EXISTS "Organizers can view participant phones" ON public.user_private_data;
DROP POLICY IF EXISTS "Participants can view organizer phones" ON public.user_private_data;

CREATE POLICY "Users can view their own private data"
  ON public.user_private_data
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own private data"
  ON public.user_private_data
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own private data"
  ON public.user_private_data
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Organizers can view participant phones"
  ON public.user_private_data
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.match_participants mp
      JOIN public.matches m ON m.id = mp.match_id
      WHERE m.organizer_id = (select auth.uid())
        AND mp.user_id = user_private_data.user_id
        AND mp.status IN ('joined', 'approved')
    )
  );

CREATE POLICY "Participants can view organizer phones"
  ON public.user_private_data
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.match_participants mp ON mp.match_id = m.id
      WHERE mp.user_id = (select auth.uid())
        AND m.organizer_id = user_private_data.user_id
        AND mp.status IN ('joined', 'approved')
    )
  );

DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist;

DO $$
BEGIN
  IF to_regprocedure('public.increment_cancellations(uuid)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.increment_cancellations(uuid) FROM PUBLIC, anon, authenticated;
    DROP FUNCTION public.increment_cancellations(uuid);
  END IF;

  IF to_regprocedure('public.increment_organizer_cancellations(uuid)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.increment_organizer_cancellations(uuid) FROM PUBLIC, anon, authenticated;
    DROP FUNCTION public.increment_organizer_cancellations(uuid);
  END IF;

  IF to_regprocedure('public.email_exists(text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.email_exists(text) FROM PUBLIC, anon, authenticated;
    DROP FUNCTION public.email_exists(text);
  END IF;

  IF to_regprocedure('public.get_email_from_username(text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.get_email_from_username(text) FROM PUBLIC, anon, authenticated;
    DROP FUNCTION public.get_email_from_username(text);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_organizer_cancellations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    INSERT INTO public.user_account_private (user_id, cancellations_count)
    VALUES (NEW.organizer_id, 1)
    ON CONFLICT (user_id) DO UPDATE
      SET cancellations_count = public.user_account_private.cancellations_count + 1,
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_organizer_cancellations() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  user_phone text := NULLIF(NEW.raw_user_meta_data->>'phone', '');
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
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'birthday')::date, '2000-01-01'::date)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    birthday = EXCLUDED.birthday,
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

DO $$
BEGIN
  IF to_regprocedure('public.get_unread_count()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.get_unread_count() SET search_path TO public';
  END IF;
  IF to_regprocedure('public.get_user_chat_threads()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.get_user_chat_threads() SET search_path TO public';
  END IF;
END;
$$;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.users FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.matches FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.match_participants FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.match_reviews FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.user_private_data FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.user_account_private FROM anon;

UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg','image/png','image/webp']
WHERE id = 'avatars';

UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg','image/png','image/webp']
WHERE id = 'assets';

DROP POLICY IF EXISTS "anon upload assets" ON storage.objects;
DROP POLICY IF EXISTS "public read assets" ON storage.objects;
DROP POLICY IF EXISTS "Cualquiera puede ver avatares" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden subir su propio avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio avatar" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios pueden borrar su propio avatar" ON storage.objects;

CREATE POLICY "Assets: public read brand assets"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'assets');

CREATE POLICY "Avatars: public read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Avatars: authenticated upload own folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "Avatars: authenticated update own folder"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "Avatars: authenticated delete own folder"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

COMMIT;
