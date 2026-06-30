REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, uuid, jsonb) TO authenticated, service_role;