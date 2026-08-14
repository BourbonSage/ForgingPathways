-- ============================================================================
-- MULTI-ORGANIZATION SECURITY MODEL
-- ----------------------------------------------------------------------------
-- Tenancy boundary = public.organizations.id ("org").
--
-- Two independent role planes:
--   1. PLATFORM roles  -> public.user_roles (app_role: admin | partner |
--      participant | pending). 'admin' is the platform superuser and retains
--      cross-org visibility for system support. Checked via public.has_role().
--   2. ORG roles       -> public.org_memberships.role (org_role: org_admin |
--      org_super | case_manager | participant). Scoped to a single org.
--
-- Isolation rules enforced by RLS:
--   * A user may read an organization only if they hold an ACTIVE membership
--     in it (or are a platform admin).
--   * A user may read memberships only within orgs they themselves belong to.
--   * Only org_admin / org_super (of that same org) or a platform admin may
--     create, modify, or deactivate memberships -- and never for another org.
--   * There is no policy path that returns rows from an org the caller is not
--     a member of, so cross-org leakage is structurally impossible.
--
-- All membership lookups used inside policies go through SECURITY DEFINER
-- helpers to avoid infinite RLS recursion on org_memberships.
-- Soft-deleted users (profiles.deleted_at) are excluded from every helper.
-- ============================================================================

CREATE TYPE public.org_role AS ENUM ('org_admin', 'org_super', 'case_manager', 'participant');

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  status text NOT NULL DEFAULT 'active',
  contact_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organizations IS
  'Tenant root. Every membership and (eventually) every scoped record hangs off an org. Readable only by its own active members and platform admins.';

GRANT SELECT ON public.organizations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

CREATE TABLE public.org_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'participant',
  is_active boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

COMMENT ON TABLE public.org_memberships IS
  'Join of user -> organization with an org-scoped role. Soft-delete via deleted_at / is_active. A membership is the ONLY thing that grants a user visibility into an org.';
COMMENT ON COLUMN public.org_memberships.role IS
  'Org-scoped role, independent of platform user_roles. org_admin/org_super may manage memberships inside their own org only.';

CREATE INDEX idx_org_memberships_user ON public.org_memberships(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_org_memberships_org ON public.org_memberships(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_status ON public.organizations(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_memberships TO authenticated;
GRANT ALL ON public.org_memberships TO service_role;

CREATE TRIGGER organizations_set_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER org_memberships_set_updated_at BEFORE UPDATE ON public.org_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so RLS policies can call them without recursing
-- back into org_memberships. Each ignores soft-deleted users/memberships.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_org_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.org_id
  FROM public.org_memberships m
  JOIN public.profiles p ON p.id = m.user_id
  WHERE m.user_id = _user_id
    AND m.is_active
    AND m.deleted_at IS NULL
    AND p.deleted_at IS NULL
$$;
COMMENT ON FUNCTION public.user_org_ids(uuid) IS
  'All orgs a (non-deleted) user actively belongs to. Basis of every isolation check.';

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_org_ids(_user_id) o WHERE o = _org_id)
$$;
COMMENT ON FUNCTION public.is_org_member(uuid, uuid) IS
  'True when the user holds an active membership in the given org. Used by RLS to gate all org-scoped reads.';

CREATE OR REPLACE FUNCTION public.user_org_role(_user_id uuid, _org_id uuid)
RETURNS public.org_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.role
  FROM public.org_memberships m
  JOIN public.profiles p ON p.id = m.user_id
  WHERE m.user_id = _user_id
    AND m.org_id = _org_id
    AND m.is_active
    AND m.deleted_at IS NULL
    AND p.deleted_at IS NULL
  LIMIT 1
$$;
COMMENT ON FUNCTION public.user_org_role(uuid, uuid) IS
  'The user''s role inside one specific org, or NULL if they are not a member.';

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role public.org_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_org_role(_user_id, _org_id) = _role
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_org_role(_user_id, _org_id) IN ('org_admin', 'org_super')
$$;
COMMENT ON FUNCTION public.is_org_admin(uuid, uuid) IS
  'True for org_admin or org_super of THAT org only. Grants membership management inside the org; never across orgs.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view their organizations" ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins update their organization" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(auth.uid(), id) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_org_admin(auth.uid(), id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Platform admins create organizations" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Platform admins delete organizations" ON public.organizations
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own membership" ON public.org_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Members view memberships in their orgs" ON public.org_memberships
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins add members to their org" ON public.org_memberships
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(auth.uid(), org_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins update members in their org" ON public.org_memberships
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_org_admin(auth.uid(), org_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins remove members in their org" ON public.org_memberships
  FOR DELETE TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id) OR public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- Backfill: default org + migrate every existing (non-deleted) user.
-- Platform admin -> org_admin, partner -> case_manager, everything else ->
-- participant. Platform 'admin' keeps its cross-org powers via user_roles.
-- ---------------------------------------------------------------------------

INSERT INTO public.organizations (name, slug, status)
VALUES ('Lowcountry Food Bank', 'lowcountry-food-bank', 'active');

INSERT INTO public.org_memberships (org_id, user_id, role)
SELECT
  (SELECT id FROM public.organizations WHERE slug = 'lowcountry-food-bank'),
  p.id,
  CASE
    WHEN public.has_role(p.id, 'admin'::app_role)   THEN 'org_admin'::public.org_role
    WHEN public.has_role(p.id, 'partner'::app_role) THEN 'case_manager'::public.org_role
    ELSE 'participant'::public.org_role
  END
FROM public.profiles p
WHERE p.deleted_at IS NULL
ON CONFLICT (org_id, user_id) DO NOTHING;

-- Any assigned case_manager_id that lacks a profile row would break the
-- in-org invariant; ensure each referenced case manager is a member too.
INSERT INTO public.org_memberships (org_id, user_id, role)
SELECT DISTINCT
  (SELECT id FROM public.organizations WHERE slug = 'lowcountry-food-bank'),
  p.case_manager_id,
  'case_manager'::public.org_role
FROM public.profiles p
WHERE p.case_manager_id IS NOT NULL
  AND p.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM public.profiles cm WHERE cm.id = p.case_manager_id)
ON CONFLICT (org_id, user_id) DO NOTHING;