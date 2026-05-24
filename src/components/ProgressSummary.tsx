import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Flame } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { useProgressStats } from "@/hooks/useProgressStats";

const motivational = (streak: number, week: number) => {
  if (streak >= 5) return "You're on fire — keep blazing the trail.";
  if (streak >= 2) return "Momentum is building. One more step today.";
  if (week > 0) return "Great start this week. Stack another small win.";
  return "Every journey begins with one step. Claim a task today.";
};

export const ProgressSummary = () => {
  const { credits } = useCredits();
  const { completedThisWeek, streak } = useProgressStats();

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mb-8"
    >
      <h2 className="font-display text-xl text-foreground mb-3">My progress</h2>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="rounded-2xl bg-card p-4 shadow-soft border border-border/50">
          <Sparkles className="w-5 h-5 mb-2 text-primary" />
          <p className="font-display text-2xl text-foreground font-semibold leading-none">{credits}</p>
          <p className="text-xs text-muted-foreground leading-tight mt-1">Forge Credits</p>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-soft border border-border/50">
          <TrendingUp className="w-5 h-5 mb-2 text-secondary-foreground" />
          <p className="font-display text-2xl text-foreground font-semibold leading-none">{completedThisWeek}</p>
          <p className="text-xs text-muted-foreground leading-tight mt-1">Tasks this week</p>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-soft border border-border/50">
          <Flame className="w-5 h-5 mb-2 text-accent-glow" />
          <p className="font-display text-2xl text-foreground font-semibold leading-none">
            {streak}{streak > 0 && " 🔥"}
          </p>
          <p className="text-xs text-muted-foreground leading-tight mt-1">
            {streak === 1 ? "day streak" : "day streak"}
          </p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground italic px-1">
        {motivational(streak, completedThisWeek)}
      </p>
    </motion.section>
  );
};
