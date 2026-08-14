-- Null-safety: user_org_role() returns NULL when the viewer has no active
-- membership in the target org, which made `role IN (...)` evaluate to NULL
-- and silently skip the authorization RAISE. Coalesce to false so a missing
-- membership is always a hard denial.

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(public.user_org_role(_user_id, _org_id) IN ('org_admin', 'org_super'), false)
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role org_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(public.user_org_role(_user_id, _org_id) = _role, false)
$$;

REVOKE ALL ON FUNCTION public.is_org_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_org_role(uuid, uuid, org_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, org_role) TO authenticated, service_role;