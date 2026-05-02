import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Heart, Award } from "lucide-react";
import { CreditBadge } from "@/components/CreditBadge";

const stats = [
  { label: "Earned this month", value: "42", icon: Sparkles, tone: "primary" },
  { label: "Tasks completed", value: "7", icon: TrendingUp, tone: "secondary" },
  { label: "Hours given", value: "9.5", icon: Heart, tone: "warm" },
  { label: "Streak", value: "3 wks", icon: Award, tone: "primary" },
];

const activity = [
  { date: "Today", title: "Sorted produce", org: "Lowcountry Food Bank", credits: 8 },
  { date: "Yesterday", title: "Packed hygiene kits", org: "Lowcountry Food Bank", credits: 5 },
  { date: "Mon", title: "Greeted neighbors", org: "Community Center", credits: 6 },
  { date: "Last week", title: "Shared your story", org: "ForgingPathways", credits: 3 },
];

const Progress = () => {
  return (
    <div className="px-5 pt-12 pb-6 safe-top">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-foreground">Your progress</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every step is part of the whole
        </p>
      </header>

      <motion.section
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-3xl gradient-hero p-6 mb-6 border border-border/50"
      >
        <p className="text-sm text-muted-foreground mb-1">Lifetime Pathway</p>
        <div className="flex items-end gap-3 mb-4">
          <span className="font-display text-5xl text-foreground font-semibold">128</span>
          <span className="text-base text-muted-foreground mb-2">credits earned</span>
        </div>
        <div className="h-2.5 bg-card rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "64%" }}
            transition={{ duration: 1, delay: 0.2 }}
            className="h-full gradient-primary rounded-full"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          72 more to reach <span className="font-semibold text-foreground">Bright Helper</span> status
        </p>
      </motion.section>

      <section className="grid grid-cols-2 gap-3 mb-8">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="rounded-2xl bg-card p-4 shadow-soft border border-border/50"
          >
            <s.icon className={`w-5 h-5 mb-2 ${s.tone === "primary" ? "text-primary" : s.tone === "secondary" ? "text-secondary-foreground" : "text-accent-glow"}`} />
            <p className="font-display text-2xl text-foreground font-semibold">{s.value}</p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </section>

      <section>
        <h2 className="font-display text-xl text-foreground mb-3">Recent activity</h2>
        <ul className="space-y-2.5">
          {activity.map((a, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="flex items-center gap-4 bg-card rounded-2xl p-4 shadow-soft border border-border/50"
            >
              <div className="w-11 h-11 rounded-full bg-primary-soft flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.date} · {a.org}</p>
              </div>
              <CreditBadge amount={a.credits} size="sm" />
            </motion.li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default Progress;
