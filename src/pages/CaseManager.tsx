import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, ClipboardCheck, CheckCircle2, Loader2, ArrowLeft, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreditBadge } from "@/components/CreditBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ParticipantRow {
  id: string;
  full_name: string | null;
  email: string | null;
  credits: number;
}

interface UserTaskRow {
  id: string;
  user_id: string;
  task_id: string;
  status: string;
  verified: boolean;
  claimed_at: string;
  completed_at: string | null;
}

const startOfWeek = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
};

const CaseManager = () => {
  const { user, isPartner, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [tasks, setTasks] = useState<UserTaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isPartner) navigate("/home", { replace: true });
  }, [authLoading, isPartner, navigate]);

  useEffect(() => {
    if (!user || !isPartner) return;
    (async () => {
      setLoading(true);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email, credits")
        .eq("case_manager_id", user.id)
        .order("full_name", { ascending: true });
      const list = (profs as ParticipantRow[]) ?? [];
      setParticipants(list);

      if (list.length > 0) {
        const ids = list.map((p) => p.id);
        const { data: uts } = await supabase
          .from("user_tasks")
          .select("id, user_id, task_id, status, verified, claimed_at, completed_at")
          .in("user_id", ids)
          .order("claimed_at", { ascending: false });
        setTasks(((uts as any) ?? []) as UserTaskRow[]);
      } else {
        setTasks([]);
      }
      setLoading(false);
    })();
  }, [user, isPartner]);

  const weekStart = startOfWeek(new Date());

  const stats = useMemo(() => {
    const completedThisWeek = tasks.filter(
      (t) => t.verified && t.completed_at && new Date(t.completed_at) >= weekStart
    ).length;
    const pending = tasks.filter(
      (t) => !t.verified && (t.status === "pending_verification" || t.completed_at !== null)
    ).length;
    return {
      participants: participants.length,
      completedThisWeek,
      pending,
    };
  }, [participants, tasks]);

  const byParticipant = useMemo(() => {
    const m = new Map<string, { completed: number; last: string | null }>();
    participants.forEach((p) => m.set(p.id, { completed: 0, last: null }));
    tasks.forEach((t) => {
      const entry = m.get(t.user_id);
      if (!entry) return;
      if (t.verified) entry.completed++;
      const stamp = t.completed_at ?? t.claimed_at;
      if (stamp && (!entry.last || stamp > entry.last)) entry.last = stamp;
    });
    return m;
  }, [participants, tasks]);

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
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => navigate("/home")}
            className="p-2 -ml-2 rounded-lg hover:bg-muted"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Users className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-display text-2xl text-foreground leading-tight">
              Case Manager
            </h1>
            <p className="text-xs text-muted-foreground">
              Your cohort & verification queue
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 pt-6 space-y-6">
        {/* Quick stats */}
        <section className="grid grid-cols-3 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-card p-4 shadow-soft border border-border/50"
          >
            <Users className="w-5 h-5 mb-2 text-primary" />
            <p className="font-display text-2xl text-foreground font-semibold">
              {stats.participants}
            </p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">
              Participants
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-2xl bg-card p-4 shadow-soft border border-border/50"
          >
            <CheckCircle2 className="w-5 h-5 mb-2 text-secondary-foreground" />
            <p className="font-display text-2xl text-foreground font-semibold">
              {stats.completedThisWeek}
            </p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">
              Done this week
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-card p-4 shadow-soft border border-border/50"
          >
            <ClipboardCheck className="w-5 h-5 mb-2 text-accent-glow" />
            <p className="font-display text-2xl text-foreground font-semibold">
              {stats.pending}
            </p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">
              Pending review
            </p>
          </motion.div>
        </section>

        {/* Verification queue CTA */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl gradient-hero p-5 border border-border/50 flex items-center justify-between gap-4"
        >
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Verification queue
            </p>
            <p className="font-display text-xl text-foreground leading-tight">
              {stats.pending} claim{stats.pending === 1 ? "" : "s"} awaiting review
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link to="/case-manager/queue">
              <ListChecks className="w-4 h-4 mr-1" /> Open
            </Link>
          </Button>
        </motion.section>

        {/* Participants */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-3xl p-5 border border-border shadow-soft"
        >
          <h2 className="font-display text-xl mb-3">
            Your participants ({participants.length})
          </h2>

          {loading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : participants.length === 0 ? (
            <div className="rounded-2xl bg-muted/40 p-6 text-center text-sm text-muted-foreground">
              No participants linked yet. An admin can link participants to you
              by setting their case manager.
            </div>
          ) : (
            <ul className="space-y-2">
              {participants.map((p) => {
                const stat = byParticipant.get(p.id) ?? {
                  completed: 0,
                  last: null,
                };
                return (
                  <li
                    key={p.id}
                    onClick={() => navigate(`/case-manager/participant/${p.id}`)}
                    className="flex items-center gap-3 bg-muted/40 rounded-xl p-3 cursor-pointer hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {p.full_name || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.email}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {stat.completed} task{stat.completed === 1 ? "" : "s"}{" "}
                        completed
                        {stat.last
                          ? ` · last ${new Date(stat.last).toLocaleDateString()}`
                          : " · no activity yet"}
                      </p>
                    </div>
                    <CreditBadge amount={p.credits ?? 0} size="sm" />
                  </li>
                );
              })}
            </ul>
          )}
        </motion.section>
      </div>
    </div>
  );
};

export default CaseManager;
