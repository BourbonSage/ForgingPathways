-- =====================================================================
-- Org isolation hardening.
--
-- Two role planes exist:
--   * platform plane  : public.user_roles  ('admin' = support/global)
--   * organization    : public.org_memberships (org_admin/org_super/
--                       case_manager/participant)
-- Everything below scopes non-platform-admin visibility to the caller's
-- own active org memberships.
-- =====================================================================

-- Do the two users share at least one organization where both memberships
-- are active (and neither profile is soft-deleted)?
CREATE OR REPLACE FUNCTION public.shares_org_with(_user_a uuid, _user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships ma
    JOIN public.org_memberships mb ON mb.org_id = ma.org_id
    JOIN public.profiles pa ON pa.id = ma.user_id AND pa.deleted_at IS NULL
    JOIN public.profiles pb ON pb.id = mb.user_id AND pb.deleted_at IS NULL
    WHERE ma.user_id = _user_a
      AND mb.user_id = _user_b
      AND ma.is_active AND ma.deleted_at IS NULL
      AND mb.is_active AND mb.deleted_at IS NULL
  )
$$;

COMMENT ON FUNCTION public.shares_org_with(uuid, uuid) IS
'SECURITY DEFINER. True only when both users hold an active, non-deleted
membership in the SAME organization and neither profile is soft-deleted.
Building block for org isolation in RLS policies.';

-- Case-manager relationship, now org-scoped.
CREATE OR REPLACE FUNCTION public.is_case_manager_of(_manager_id uuid, _participant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.org_memberships mp
      ON mp.user_id = p.id
     AND mp.is_active AND mp.deleted_at IS NULL
    JOIN public.org_memberships mm
      ON mm.org_id = mp.org_id
     AND mm.user_id = _manager_id
     AND mm.is_active AND mm.deleted_at IS NULL
     AND mm.role IN ('case_manager', 'org_super', 'org_admin')
    JOIN public.profiles pm
      ON pm.id = _manager_id AND pm.deleted_at IS NULL
    WHERE p.id = _participant_id
      AND p.deleted_at IS NULL
      AND p.case_manager_id = _manager_id
  )
$$;

COMMENT ON FUNCTION public.is_case_manager_of(uuid, uuid) IS
'SECURITY DEFINER. True only when ALL hold:
 (1) profiles.case_manager_id points at the manager,
 (2) manager and participant share an organization via active
     org_memberships,
 (3) the manager has case_manager/org_super/org_admin role in THAT org,
 (4) neither profile is soft-deleted.
Cross-organization case management is impossible through this helper.';

-- ---------------------------------------------------------------------
-- profiles: staff visibility is org-scoped; platform admin keeps global
-- read for support.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Partners view all profiles" ON public.profiles;

CREATE POLICY "Staff view profiles in their orgs"
ON public.profiles FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    (
      public.has_role(auth.uid(), 'partner'::app_role)
      OR public.is_org_admin(auth.uid(), NULL)
      OR public.has_org_role(auth.uid(), NULL, 'case_manager'::org_role)
    )
    AND public.shares_org_with(auth.uid(), id)
  )
);

COMMENT ON POLICY "Staff view profiles in their orgs" ON public.profiles IS
'Platform admins see all profiles (support). Org staff (partner role, org
admins/supers, case managers) see only profiles sharing one of their active
organizations. Everyone else falls back to the own-profile policy.';

-- Case managers may only update participants they manage (already
-- org-scoped through is_case_manager_of), and org admins their own org.
DROP POLICY IF EXISTS "Case managers update assigned profiles" ON public.profiles;

CREATE POLICY "Case managers update assigned profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (
  public.is_case_manager_of(auth.uid(), id)
  OR (public.is_org_admin(auth.uid(), NULL) AND public.shares_org_with(auth.uid(), id))
)
WITH CHECK (
  public.is_case_manager_of(auth.uid(), id)
  OR (public.is_org_admin(auth.uid(), NULL) AND public.shares_org_with(auth.uid(), id))
);

COMMENT ON POLICY "Case managers update assigned profiles" ON public.profiles IS
'Org-scoped: a case manager may edit only participants assigned to them
inside a shared organization; org admins may edit members of their own org.
Privileged columns remain gated by profiles_guard_privileged_columns.';

-- ---------------------------------------------------------------------
-- Assignment validation: case_manager_id must stay inside one org.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profiles_validate_case_manager()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mgr_deleted timestamptz;
BEGIN
  IF NEW.case_manager_id IS NULL
     OR NEW.case_manager_id IS NOT DISTINCT FROM OLD.case_manager_id THEN
    RETURN NEW;
  END IF;

  IF NEW.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'cannot assign a case manager to a removed account';
  END IF;

  SELECT deleted_at INTO v_mgr_deleted
    FROM public.profiles WHERE id = NEW.case_manager_id;
  IF NOT FOUND OR v_mgr_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'case manager account does not exist or has been removed';
  END IF;

  IF NOT public.shares_org_with(NEW.case_manager_id, NEW.id) THEN
    RAISE EXCEPTION 'case manager and participant must belong to the same organization';
  END IF;

  IF NOT (
    public.has_org_role(NEW.case_manager_id, NULL, 'case_manager'::org_role)
    OR public.is_org_admin(NEW.case_manager_id, NULL)
  ) THEN
    RAISE EXCEPTION 'assigned user does not hold a case manager role in that organization';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.profiles_validate_case_manager() IS
'SECURITY DEFINER trigger. Rejects any case_manager_id assignment where the
parties do not share an active organization, either account is soft-deleted,
or the manager lacks a case_manager/org_super/org_admin role there.';

DROP TRIGGER IF EXISTS profiles_validate_case_manager ON public.profiles;
CREATE TRIGGER profiles_validate_case_manager
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_validate_case_manager();

-- ---------------------------------------------------------------------
-- Activity tables: partner-facing policies already route through
-- is_case_manager_of, which is now org-scoped. Re-document them.
-- ---------------------------------------------------------------------
COMMENT ON POLICY "Partners view overseen user_tasks" ON public.user_tasks IS
'Org-scoped via is_case_manager_of: partners see tasks only for participants
they manage inside a shared organization.';
COMMENT ON POLICY "Partners update overseen user_tasks" ON public.user_tasks IS
'Org-scoped via is_case_manager_of.';
COMMENT ON POLICY "Partners assign user_tasks" ON public.user_tasks IS
'Org-scoped via is_case_manager_of; assigned_by must be the acting partner.';
COMMENT ON POLICY "Partners view overseen claims" ON public.task_claims IS
'Org-scoped via is_case_manager_of.';
COMMENT ON POLICY "Partners update overseen claims" ON public.task_claims IS
'Org-scoped via is_case_manager_of.';
COMMENT ON POLICY "Partners view overseen credit tx" ON public.pathway_credit_transactions IS
'Org-scoped via is_case_manager_of.';

REVOKE ALL ON FUNCTION public.shares_org_with(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.shares_org_with(uuid, uuid) TO authenticated, service_role;