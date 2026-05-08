GRANT SELECT, INSERT, UPDATE ON TABLE public.user_account_private TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.users FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.matches FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.match_participants FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.match_reviews FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.user_private_data FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.user_account_private FROM anon;
