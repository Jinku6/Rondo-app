BEGIN;

ALTER POLICY "Avatars: authenticated upload own folder"
ON storage.objects
TO public;

COMMIT;
