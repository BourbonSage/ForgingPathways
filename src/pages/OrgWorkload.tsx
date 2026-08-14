import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Users,
  Activity,
  ClipboardCheck,
  Building2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreditBadge } from "@/components/CreditBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";

interface WorkloadRow {
  case_manager_id: string;
  full_name: string | null;
  email: string | null;
  org_role: string;
  total_clients: number;
  active_clients: number;
  pending_verifications: number;
  credits_earned: number;
}

const WINDOWS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const OrgWorkload = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const { adminOrgs, isOrgAdmin, loading: orgLoading } = useOrg();

  const [orgOptions, setOrgOptions] = useState<{ id: string; name: string }[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [days, setDays] = useState("30");
  const [rows, setRows] = useState<WorkloadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allowed = isAdmin || isOrgAdmin;

  useEffect(() => {
    if (!authLoading && !orgLoading && !allowed) {
      navigate("/home", { replace: true });
    }
  }, [authLoading, orgLoading, allowed, navigate]);

  // Build the list of organizations the viewer may inspect.
  useEffect(() => {
    if (orgLoading || authLoading || !allowed) return;
    (async () => {
      if (isAdmin) {
        const { data } = await supabase
          .from("organizations")
          .select("id, name")
          .order("name");
        const opts = ((data as any[]) ?? []).map((o) => ({ id: o.id, name: o.name }));
        setOrgOptions(opts);
        setOrgId((cur) => cur ?? opts[0]?.id ?? null);
      } else {
        const opts = adminOrgs.map((o) => ({ id: o.orgId, name: o.orgName }));
        setOrgOptions(opts);
        setOrgId((cur) => cur ?? opts[0]?.id ?? null);
      }
    })();
  }, [isAdmin, adminOrgs, orgLoading, authLoading, allowed]);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("get_org_workload", {
      p_org_id: orgId,
      p_days: Number(days),
    });
    if (err) {
      setError(err.message);
      setRows([]);
    } else {
      setRows(((data as any) ?? []) as WorkloadRow[]);
    }
    setLoading(false);
  }, [orgId, days]);

  useEffect(() => {
    if (orgId) load();
  }, [orgId, days, load]);

  const totals = useMemo(
    () => ({
      managers: rows.length,
      clients: rows.reduce((s, r) => s + (r.total_clients ?? 0), 0),
      active: rows.reduce((s, r) => s + (r.active_clients ?? 0), 0),
      pending: rows.reduce((s, r) => s + (r.pending_verifications ?? 0), 0),
    }),
    [rows]
  );

  if (authLoading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="px-5 pt-10 pb-4 safe-top bg-card border-b border-border">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-lg hover:bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Building2 className="w-6 h-6 text-primary" />
          <div className="min-w-0">
            <h1 className="font-display text-2xl text-foreground leading-tight">
              Workload
            </h1>
            <p className="text-xs text-muted-foreground">
              Case manager load across your organization
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 pt-6 space-y-6">
        {/* Filters */}
        <section className="flex flex-wrap gap-3">
          {orgOptions.length > 1 && (
            <Select value={orgId ?? undefined} onValueChange={setOrgId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Organization" />
              </SelectTrigger>
              <SelectContent>
                {orgOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((w) => (
                <SelectItem key={w.value} value={w.value}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {/* Totals */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Users, label: "Case managers", value: totals.managers },
            { icon: Users, label: "Clients", value: totals.clients },
            { icon: Activity, label: "Active", value: totals.active },
            { icon: ClipboardCheck, label: "Pending review", value: totals.pending },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl bg-card p-4 shadow-soft border border-border/50"
            >
              <s.icon className="w-5 h-5 mb-2 text-primary" />
              <p className="font-display text-2xl text-foreground font-semibold">
                {s.value}
              </p>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                {s.label}
              </p>
            </motion.div>
          ))}
        </section>

        {/* Table */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-3xl p-5 border border-border shadow-soft"
        >
          <h2 className="font-display text-xl mb-3">Case managers</h2>

          {loading ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-destructive/10 p-5 text-sm text-destructive">
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl bg-muted/40 p-6 text-center text-sm text-muted-foreground">
              No case managers in this organization yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.case_manager_id}>
                  <button
                    onClick={() =>
                      navigate(`/org/case-manager/${r.case_manager_id}?days=${days}`)
                    }
                    className="w-full text-left flex items-center gap-3 bg-muted/40 hover:bg-muted rounded-xl p-3 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {r.full_name || r.email || "Case manager"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {r.email}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                        <span>
                          <strong className="text-foreground">{r.total_clients}</strong>{" "}
                          clients
                        </span>
                        <span>
                          <strong className="text-foreground">{r.active_clients}</strong>{" "}
                          active
                        </span>
                        <span>
                          <strong className="text-foreground">
                            {r.pending_verifications}
                          </strong>{" "}
                          pending
                        </span>
                      </div>
                    </div>
                    <CreditBadge amount={r.credits_earned ?? 0} size="sm" />
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        <p className="text-[11px] text-muted-foreground text-center">
          “Active” = at least one claim, verification, or credit movement in the
          selected window. Removed accounts are excluded.
        </p>

        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => navigate("/home")}>
            Back to app
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrgWorkload;
