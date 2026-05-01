alter table public.users
  add column if not exists bio text check (char_length(bio) <= 300);

notify pgrst, 'reload schema';
