-- =====================================================================
-- Organization workload / load-balancing reporting functions.
--
-- Isolation model:
--   * Platform admins (public.user_roles role = 'admin') keep global
--     support visibility.
--   * Organization admins/supers (org_memberships.role in
--     ('org_admin','org_super')) see only their own organization.
--   * Case managers see only their own assigned, same-org clients.
--   * Soft-deleted profiles / inactive memberships are always excluded.
--
-- "Active" for a client in the window = at least one task claim, one
-- task completion/verification, or one credit ledger movement whose
-- timestamp falls inside the window.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_org_workload(
  p_org_id uuid,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  case_manager_id uuid,
  full_name text,
  email text,
  org_role public.org_role,
  total_clients integer,
  active_clients integer,
  pending_verifications integer,
  credits_earned integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cutoff timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'org_required';
  END IF;
  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.is_org_admin(v_uid, p_org_id)
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_cutoff := now() - make_interval(days => GREATEST(COALESCE(p_days, 30), 1));

  RETURN QUERY
  WITH managers AS (
    SELECT m.user_id AS id, m.role
    FROM public.org_memberships m
    JOIN public.profiles p ON p.id = m.user_id AND p.deleted_at IS NULL
    WHERE m.org_id = p_org_id
      AND m.is_active
      AND m.deleted_at IS NULL
      AND m.role IN ('case_manager', 'org_admin', 'org_super')
  ),
  clients AS (
    SELECT c.id, c.case_manager_id
    FROM public.profiles c
    JOIN public.org_memberships cm
      ON cm.user_id = c.id
     AND cm.org_id = p_org_id
     AND cm.is_active
     AND cm.deleted_at IS NULL
    WHERE c.deleted_at IS NULL
      AND c.case_manager_id IN (SELECT id FROM managers)
  )
  SELECT
    mg.id,
    pr.full_name,
    pr.email,
    mg.role,
    COUNT(cl.id)::integer,
    COUNT(cl.id) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM public.user_tasks ut
        WHERE ut.user_id = cl.id
          AND (ut.claimed_at >= v_cutoff OR ut.completed_at >= v_cutoff)
      )
      OR EXISTS (
        SELECT 1 FROM public.pathway_credit_transactions tx
        WHERE tx.user_id = cl.id AND tx.created_at >= v_cutoff
      )
    )::integer,
    COALESCE((
      SELECT COUNT(*) FROM public.user_tasks ut2
      WHERE ut2.user_id IN (SELECT id FROM clients c2 WHERE c2.case_manager_id = mg.id)
        AND ut2.status = 'pending_verification'::user_task_status
    ), 0)::integer,
    COALESCE((
      SELECT SUM(tx2.amount) FROM public.pathway_credit_transactions tx2
      WHERE tx2.user_id IN (SELECT id FROM clients c3 WHERE c3.case_manager_id = mg.id)
        AND tx2.created_at >= v_cutoff
        AND tx2.amount > 0
    ), 0)::integer
  FROM managers mg
  JOIN public.profiles pr ON pr.id = mg.id
  LEFT JOIN clients cl ON cl.case_manager_id = mg.id
  GROUP BY mg.id, pr.full_name, pr.email, mg.role
  ORDER BY pr.full_name NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.get_org_workload(uuid, integer) IS
  'Per-case-manager workload rollup for one organization. Callable only by platform admins or org_admin/org_super of that org. Excludes soft-deleted profiles and inactive memberships; never crosses org boundaries.';

CREATE OR REPLACE FUNCTION public.get_case_manager_clients(
  p_manager_id uuid,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  client_id uuid,
  full_name text,
  email text,
  credits integer,
  claims integer,
  verifications integer,
  pending_verifications integer,
  credits_moved integer,
  last_activity timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cutoff timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_manager_id IS NULL THEN
    RAISE EXCEPTION 'manager_required';
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR v_uid = p_manager_id
    OR EXISTS (
      SELECT 1
      FROM public.org_memberships viewer
      JOIN public.org_memberships mgr
        ON mgr.org_id = viewer.org_id
       AND mgr.user_id = p_manager_id
       AND mgr.is_active AND mgr.deleted_at IS NULL
      WHERE viewer.user_id = v_uid
        AND viewer.is_active AND viewer.deleted_at IS NULL
        AND viewer.role IN ('org_admin', 'org_super')
    )
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_cutoff := now() - make_interval(days => GREATEST(COALESCE(p_days, 30), 1));

  RETURN QUERY
  SELECT
    c.id,
    c.full_name,
    c.email,
    COALESCE(c.credits, 0)::integer,
    COALESCE((
      SELECT COUNT(*) FROM public.user_tasks ut
      WHERE ut.user_id = c.id AND ut.claimed_at >= v_cutoff
    ), 0)::integer,
    COALESCE((
      SELECT COUNT(*) FROM public.user_tasks ut
      WHERE ut.user_id = c.id
        AND ut.status = 'verified'::user_task_status
        AND COALESCE(ut.completed_at, ut.claimed_at) >= v_cutoff
    ), 0)::integer,
    COALESCE((
      SELECT COUNT(*) FROM public.user_tasks ut
      WHERE ut.user_id = c.id AND ut.status = 'pending_verification'::user_task_status
    ), 0)::integer,
    COALESCE((
      SELECT SUM(ABS(tx.amount)) FROM public.pathway_credit_transactions tx
      WHERE tx.user_id = c.id AND tx.created_at >= v_cutoff
    ), 0)::integer,
    GREATEST(
      (SELECT MAX(GREATEST(ut.claimed_at, COALESCE(ut.completed_at, ut.claimed_at)))
         FROM public.user_tasks ut WHERE ut.user_id = c.id),
      (SELECT MAX(tx.created_at)
         FROM public.pathway_credit_transactions tx WHERE tx.user_id = c.id)
    )
  FROM public.profiles c
  WHERE c.case_manager_id = p_manager_id
    AND c.deleted_at IS NULL
    AND public.shares_org_with(p_manager_id, c.id)
  ORDER BY c.full_name NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.get_case_manager_clients(uuid, integer) IS
  'Per-client activity breakdown for one case manager. Callable by platform admins, the case manager themselves, or org_admin/org_super sharing an active organization with that manager. Requires manager and client to share an org; excludes soft-deleted profiles.';

REVOKE ALL ON FUNCTION public.get_org_workload(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_case_manager_clients(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_workload(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_case_manager_clients(uuid, integer) TO authenticated, service_role;