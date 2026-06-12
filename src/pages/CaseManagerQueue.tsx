import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, X, Loader2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreditBadge } from "@/components/CreditBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface PendingRow {
  id: string;
  user_id: string;
  task_id: string;
  status: string;
  verified: boolean;
  claimed_at: string;
  completed_at: string | null;
  participant_name: string | null;
  participant_email: string | null;
  task_title: string;
  credits: number;
}

const CaseManagerQueue = () => {
  const { user, isPartner, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isPartner) navigate("/home", { replace: true });
  }, [authLoading, isPartner, navigate]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("case_manager_id", user.id);
    const list = (profs as any[]) ?? [];
    if (list.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    const ids = list.map((p) => p.id);
    const profMap = new Map(list.map((p) => [p.id, p]));

    const { data: uts } = await supabase
      .from("user_tasks")
      .select("id, user_id, task_id, status, verified, claimed_at, completed_at")
      .in("user_id", ids)
      .eq("verified", false)
      .order("completed_at", { ascending: false, nullsFirst: false });

    const utRows = (uts as any[]) ?? [];
    const taskIds = Array.from(new Set(utRows.map((r) => r.task_id)));
    const tMap = new Map<string, any>();
    if (taskIds.length > 0) {
      const { data: ts } = await supabase
        .from("tasks")
        .select("id, title, pathway_credits, credits")
        .in("id", taskIds);
      (ts ?? []).forEach((t: any) => tMap.set(t.id, t));
    }

    setRows(
      utRows.map((r) => {
        const p = profMap.get(r.user_id);
        const t = tMap.get(r.task_id);
        return {
          ...r,
          participant_name: p?.full_name ?? null,
          participant_email: p?.email ?? null,
          task_title: t?.title ?? "Task",
          credits: t?.pathway_credits ?? t?.credits ?? 0,
        } as PendingRow;
      })
    );
    setLoading(false);
  };

  useEffect(() => {
    if (isPartner && user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPartner, user]);

  const pending = useMemo(
    () =>
      rows.filter(
        (r) => r.status === "pending_verification" || r.completed_at !== null
      ),
    [rows]
  );

  const approve = async (r: PendingRow) => {
    setBusy(r.id);
    const nowIso = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("user_tasks")
      .update({
        verified: true,
        status: "verified",
        completed_at: r.completed_at ?? nowIso,
        verification_method: "staff",
      })
      .eq("id", r.id);
    if (updErr) {
      setBusy(null);
      toast.error("Could not approve.");
      return;
    }
    const { error: txErr } = await supabase
      .from("pathway_credit_transactions")
      .insert({
        user_id: r.user_id,
        task_id: r.task_id,
        type: "earned_task",
        amount: r.credits,
        description: `Verified by case manager: ${r.task_title}`,
      });
    setBusy(null);
    if (txErr) {
      toast.error("Approved, but credit award failed.");
    } else {
      toast.success(`Approved · +${r.credits} credits`);
    }
    setRows((prev) => prev.filter((x) => x.id !== r.id));
  };

  const reject = async (r: PendingRow) => {
    if (!confirm("Reject this claim?")) return;
    setBusy(r.id);
    const { error } = await supabase
      .from("user_tasks")
      .update({ status: "rejected" })
      .eq("id", r.id);
    setBusy(null);
    if (error) return toast.error("Could not reject.");
    toast.success("Marked as rejected");
    setRows((prev) => prev.filter((x) => x.id !== r.id));
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="px-5 pt-10 pb-4 safe-top bg-card border-b border-border">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => navigate("/case-manager")}
            className="p-2 -ml-2 rounded-lg hover:bg-muted"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <ListChecks className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-display text-2xl text-foreground leading-tight">
              Verification queue
            </h1>
            <p className="text-xs text-muted-foreground">
              Review and approve completed tasks
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 pt-6">
        {loading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : pending.length === 0 ? (
          <div className="rounded-3xl bg-card p-8 text-center border border-border/50 text-muted-foreground">
            <p className="font-display text-xl text-foreground mb-1">
              Nothing to review
            </p>
            <p className="text-sm">You're all caught up.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((r, i) => (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className="rounded-3xl bg-card p-5 border border-border/50 shadow-soft"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      {r.participant_name || r.participant_email}
                    </p>
                    <h3 className="font-display text-lg text-foreground leading-snug">
                      {r.task_title}
                    </h3>
                  </div>
                  <CreditBadge amount={r.credits} size="sm" />
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  {r.completed_at
                    ? `Completed ${new Date(r.completed_at).toLocaleString()}`
                    : `Claimed ${new Date(r.claimed_at).toLocaleDateString()}`}
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => approve(r)}
                    disabled={busy === r.id}
                    className="flex-1"
                  >
                    {busy === r.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-1" /> Approve
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => reject(r)}
                    disabled={busy === r.id}
                    variant="outline"
                    className="flex-1"
                  >
                    <X className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CaseManagerQueue;
