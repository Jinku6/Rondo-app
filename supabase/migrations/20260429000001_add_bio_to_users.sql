alter table users
  add column if not exists bio text check (char_length(bio) <= 300);
