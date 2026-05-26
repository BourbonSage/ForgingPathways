import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Award, Loader2 } from "lucide-react";
import { CreditBadge } from "@/components/CreditBadge";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";

interface ClaimRow {
  claimed_at: string;
  task: { title: string; partner: string; org: string; pathway_credits: number | null; credits: number } | null;
}

// Monday-start week
const startOfWeek = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
};

const weekKey = (d: Date) => startOfWeek(d).toISOString().slice(0, 10);

const computeStreak = (dates: Date[]) => {
  if (dates.length === 0) return 0;
  const weeks = new Set(dates.map((d) => weekKey(d)));
  let streak = 0;
  let cursor = startOfWeek(new Date());
  while (weeks.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
};

const formatDay = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

const Progress = () => {
  const { user } = useAuth();
  const { credits } = useCredits();
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: uts } = await supabase
        .from("user_tasks")
        .select("task_id, claimed_at")
        .eq("user_id", user.id)
        .order("claimed_at", { ascending: false });
      const rows = (uts as any[]) ?? [];
      const taskIds = Array.from(new Set(rows.map((r) => r.task_id)));
      let tasksMap = new Map<string, any>();
      if (taskIds.length > 0) {
        const { data: ts } = await supabase
          .from("tasks")
          .select("id, title, partner, org, pathway_credits, credits")
          .in("id", taskIds);
        (ts ?? []).forEach((t: any) => tasksMap.set(t.id, t));
      }
      setClaims(
        rows.map((r) => ({
          claimed_at: r.claimed_at,
          task: tasksMap.get(r.task_id) ?? null,
        }))
      );
      setLoading(false);
    })();
  }, [user]);

  const weekStart = startOfWeek(new Date());
  const completedThisWeek = claims.filter(
    (c) => new Date(c.claimed_at) >= weekStart
  ).length;
  const streak = computeStreak(claims.map((c) => new Date(c.claimed_at)));

  return (
    <div className="px-5 pt-4 pb-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-foreground">Your progress</h1>
        <p className="text-sm text-muted-foreground mt-1">Every step is part of the whole</p>
      </header>

      <motion.section
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-3xl gradient-hero p-6 mb-6 border border-border/50"
      >
        <p className="text-sm text-muted-foreground mb-1">Total credits earned</p>
        <div className="flex items-end gap-3">
          <span className="font-display text-5xl text-foreground font-semibold">{credits}</span>
          <span className="text-base text-muted-foreground mb-2">Forge Credits</span>
        </div>
      </motion.section>

      <section className="grid grid-cols-3 gap-3 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-card p-4 shadow-soft border border-border/50"
        >
          <Sparkles className="w-5 h-5 mb-2 text-primary" />
          <p className="font-display text-2xl text-foreground font-semibold">{credits}</p>
          <p className="text-xs text-muted-foreground leading-tight mt-0.5">Total credits</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl bg-card p-4 shadow-soft border border-border/50"
        >
          <TrendingUp className="w-5 h-5 mb-2 text-secondary-foreground" />
          <p className="font-display text-2xl text-foreground font-semibold">{completedThisWeek}</p>
          <p className="text-xs text-muted-foreground leading-tight mt-0.5">Tasks this week</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-card p-4 shadow-soft border border-border/50"
        >
          <Award className="w-5 h-5 mb-2 text-accent-glow" />
          <p className="font-display text-2xl text-foreground font-semibold">
            {streak} {streak === 1 ? "wk" : "wks"}
          </p>
          <p className="text-xs text-muted-foreground leading-tight mt-0.5">Streak</p>
        </motion.div>
      </section>

      <section>
        <h2 className="font-display text-xl text-foreground mb-3">Recent activity</h2>
        {loading ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : claims.length === 0 ? (
          <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground border border-border/50">
            No tasks claimed yet. Head to the Task Board to get started.
          </div>
        ) : (
          <ul className="space-y-2.5">
            {claims.slice(0, 5).map((a, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                className="flex items-center gap-4 bg-card rounded-2xl p-4 shadow-soft border border-border/50"
              >
                <div className="w-11 h-11 rounded-full bg-primary-soft flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">
                    {a.task?.title ?? "Task"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDay(a.claimed_at)} · {a.task?.partner ?? a.task?.org ?? ""}
                  </p>
                </div>
                <CreditBadge amount={a.task?.pathway_credits ?? a.task?.credits ?? 0} size="sm" />
              </motion.li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default Progress;
