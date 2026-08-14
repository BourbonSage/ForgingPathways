-- Org helpers are only meaningful for a signed-in caller; remove anon access.
REVOKE ALL ON FUNCTION public.user_org_ids(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.is_org_member(uuid, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.user_org_role(uuid, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.has_org_role(uuid, uuid, public.org_role) FROM public, anon;
REVOKE ALL ON FUNCTION public.is_org_admin(uuid, uuid) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.user_org_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_org_role(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.org_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) TO authenticated, service_role;