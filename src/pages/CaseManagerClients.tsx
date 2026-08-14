import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Users, ChevronRight } from "lucide-react";
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

interface ClientRow {
  client_id: string;
  full_name: string | null;
  email: string | null;
  credits: number;
  claims: number;
  verifications: number;
  pending_verifications: number;
  credits_moved: number;
  last_activity: string | null;
}

const WINDOWS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const CaseManagerClients = () => {
  const { managerId } = useParams<{ managerId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [params, setParams] = useSearchParams();
  const days = params.get("days") ?? "30";

  const [manager, setManager] = useState<{ full_name: string | null; email: string | null } | null>(
    null
  );
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!managerId) return;
    setLoading(true);
    setError(null);
    const [{ data: prof }, { data, error: err }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", managerId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase.rpc("get_case_manager_clients", {
        p_manager_id: managerId,
        p_days: Number(days),
      }),
    ]);
    setManager((prof as any) ?? null);
    if (err) {
      setError(
        err.message.includes("not_authorized")
          ? "You are not allowed to view this case manager’s clients."
          : err.message
      );
      setRows([]);
    } else {
      setRows(((data as any) ?? []) as ClientRow[]);
    }
    setLoading(false);
  }, [managerId, days]);

  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user, load]);

  if (authLoading) {
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
          <Users className="w-6 h-6 text-primary" />
          <div className="min-w-0">
            <h1 className="font-display text-2xl text-foreground leading-tight truncate">
              {manager?.full_name || manager?.email || "Case manager"}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              Assigned clients & activity
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 pt-6 space-y-6">
        <Select
          value={days}
          onValueChange={(v) => setParams({ days: v }, { replace: true })}
        >
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

        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-3xl p-5 border border-border shadow-soft"
        >
          <h2 className="font-display text-xl mb-3">Clients ({rows.length})</h2>

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
              No clients assigned to this case manager yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((c) => (
                <li key={c.client_id}>
                  <button
                    onClick={() =>
                      navigate(`/case-manager/participant/${c.client_id}`)
                    }
                    className="w-full text-left flex items-center gap-3 bg-muted/40 hover:bg-muted rounded-xl p-3 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {c.full_name || c.email || "Participant"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {c.email}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                        <span>
                          <strong className="text-foreground">{c.claims}</strong> claims
                        </span>
                        <span>
                          <strong className="text-foreground">{c.verifications}</strong>{" "}
                          verified
                        </span>
                        <span>
                          <strong className="text-foreground">
                            {c.pending_verifications}
                          </strong>{" "}
                          pending
                        </span>
                        <span>
                          <strong className="text-foreground">{c.credits_moved}</strong>{" "}
                          credits moved
                        </span>
                        <span>
                          last activity:{" "}
                          {c.last_activity
                            ? new Date(c.last_activity).toLocaleDateString()
                            : "—"}
                        </span>
                      </div>
                    </div>
                    <CreditBadge amount={c.credits ?? 0} size="sm" />
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => navigate("/org/workload")}>
            Back to workload
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CaseManagerClients;
