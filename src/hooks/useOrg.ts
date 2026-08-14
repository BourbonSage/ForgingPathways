import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type OrgRole = "org_admin" | "org_super" | "case_manager" | "participant";

export interface OrgMembership {
  orgId: string;
  orgName: string;
  role: OrgRole;
}

/**
 * Loads the current user's active organization memberships.
 * RLS lets a user read only their own membership rows, so this can never
 * expose another organization.
 */
export const useOrg = () => {
  const { user, loading: authLoading } = useAuth();
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setMemberships([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("org_memberships")
        .select("org_id, role, organizations ( name )")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .is("deleted_at", null);
      if (cancelled) return;
      setMemberships(
        ((data as any[]) ?? []).map((m) => ({
          orgId: m.org_id as string,
          orgName: (m.organizations?.name as string) ?? "Organization",
          role: m.role as OrgRole,
        }))
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const adminOrgs = memberships.filter(
    (m) => m.role === "org_admin" || m.role === "org_super"
  );

  return {
    memberships,
    adminOrgs,
    isOrgAdmin: adminOrgs.length > 0,
    primaryOrg: memberships[0] ?? null,
    loading: loading || authLoading,
  };
};
