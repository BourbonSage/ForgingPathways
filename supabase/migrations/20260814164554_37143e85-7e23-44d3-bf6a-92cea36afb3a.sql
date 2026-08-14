-- Trigger-only function: never called directly by clients.
REVOKE ALL ON FUNCTION public.profiles_validate_case_manager() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profiles_validate_case_manager() TO service_role;