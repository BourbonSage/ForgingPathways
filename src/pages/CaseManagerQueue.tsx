import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, X, Loader2, ListChecks, Eye, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  verification_method: string | null;
  notes: string | null;
  participant_name: string | null;
  participant_email: string | null;
  task_title: string;
  task_description: string | null;
  credits: number;
}

const CaseManagerQueue = () => {
  const { user, isPartner, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reviewRow, setReviewRow] = useState<PendingRow | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  useEffect(() => {
    if (!authLoading && !isPartner) navigate("/home", { replace: true });
  }, [authLoading, isPartner, navigate]);

  const load = useCallback(async () => {
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
      .select(
        "id, user_id, task_id, status, verified, claimed_at, completed_at, verification_method, notes"
      )
      .in("user_id", ids)
      .eq("verified", false)
      .order("completed_at", { ascending: false, nullsFirst: false });

    const utRows = (uts as any[]) ?? [];
    const taskIds = Array.from(new Set(utRows.map((r) => r.task_id)));
    const tMap = new Map<string, any>();
    if (taskIds.length > 0) {
      const { data: ts } = await supabase
        .from("tasks")
        .select("id, title, description, pathway_credits, credits")
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
          task_description: t?.description ?? null,
          credits: t?.pathway_credits ?? t?.credits ?? 0,
        } as PendingRow;
      })
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (isPartner && user) load();
  }, [isPartner, user, load]);

  // Realtime: refetch when any user_tasks row changes (RLS scopes to overseen participants).
  useEffect(() => {
    if (!isPartner || !user) return;
    const channel = supabase
      .channel(`cm-queue-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_tasks" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isPartner, user, load]);

  const pending = useMemo(
    () =>
      rows.filter(
        (r) => r.status === "pending_verification" || r.completed_at !== null
      ),
    [rows]
  );

  const openReview = (r: PendingRow) => {
    setReviewRow(r);
    setReviewNotes(r.notes ?? "");
  };

  const closeReview = () => {
    setReviewRow(null);
    setReviewNotes("");
  };

  const approve = async (r: PendingRow) => {
    setBusy(r.id);
    const nowIso = new Date().toISOString();
    const noteToSave = reviewRow?.id === r.id ? reviewNotes : r.notes;
    const { error: updErr } = await supabase
      .from("user_tasks")
      .update({
        verified: true,
        status: "verified",
        completed_at: r.completed_at ?? nowIso,
        verification_method: r.verification_method ?? "staff",
        notes: noteToSave,
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
    closeReview();
    setRows((prev) => prev.filter((x) => x.id !== r.id));
  };

  const reject = async (r: PendingRow) => {
    if (!confirm("Reject this claim?")) return;
    setBusy(r.id);
    const noteToSave = reviewRow?.id === r.id ? reviewNotes : r.notes;
    const { error } = await supabase
      .from("user_tasks")
      .update({ status: "rejected", notes: noteToSave })
      .eq("id", r.id);
    setBusy(null);
    if (error) return toast.error("Could not reject.");
    toast.success("Marked as rejected");
    closeReview();
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
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
                  <span>
                    {r.completed_at
                      ? `Submitted ${new Date(r.completed_at).toLocaleString()}`
                      : `Claimed ${new Date(r.claimed_at).toLocaleDateString()}`}
                  </span>
                  {r.verification_method && (
                    <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] uppercase tracking-wide">
                      {r.verification_method}
                    </span>
                  )}
                </div>
                {r.notes && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-xl p-3 mb-3">
                    <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{r.notes}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() => openReview(r)}
                    variant="outline"
                    className="flex-1"
                  >
                    <Eye className="w-4 h-4 mr-1" /> Review
                  </Button>
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
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!reviewRow} onOpenChange={(o) => !o && closeReview()}>
        <DialogContent className="max-w-md rounded-3xl">
          {reviewRow && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">
                  {reviewRow.task_title}
                </DialogTitle>
                <DialogDescription>
                  {reviewRow.participant_name || reviewRow.participant_email}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                {reviewRow.task_description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {reviewRow.task_description}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-muted-foreground mb-0.5">Credits</p>
                    <p className="font-semibold text-foreground">
                      {reviewRow.credits}
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-muted-foreground mb-0.5">Method</p>
                    <p className="font-semibold text-foreground capitalize">
                      {reviewRow.verification_method ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3 col-span-2">
                    <p className="text-muted-foreground mb-0.5">Submitted</p>
                    <p className="font-semibold text-foreground">
                      {reviewRow.completed_at
                        ? new Date(reviewRow.completed_at).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Review notes (optional)
                  </label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add a note for this participant…"
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="outline"
                  onClick={() => reject(reviewRow)}
                  disabled={busy === reviewRow.id}
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-1" /> Reject
                </Button>
                <Button
                  onClick={() => approve(reviewRow)}
                  disabled={busy === reviewRow.id}
                  className="flex-1"
                >
                  {busy === reviewRow.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1" /> Approve
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CaseManagerQueue;
