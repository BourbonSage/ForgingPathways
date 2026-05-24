import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, Calendar } from "lucide-react";
import { CreditBadge } from "@/components/CreditBadge";
import { ProgressSummary } from "@/components/ProgressSummary";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";


const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { credits } = useCredits();
  const [name, setName] = useState("Friend");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.full_name) setName(data.full_name.split(" ")[0]);
      });
  }, [user]);

  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="px-5 pt-4 pb-6">
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <p className="text-sm text-muted-foreground">Hello,</p>
          <h1 className="font-display text-3xl text-foreground">{name}</h1>
        </div>
        <div className="w-11 h-11 rounded-full gradient-warm flex items-center justify-center font-display font-semibold text-accent-foreground">
          {initial}
        </div>
      </motion.header>

      <motion.section
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="rounded-3xl gradient-primary p-6 text-primary-foreground shadow-glow mb-8 relative overflow-hidden"
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-primary-foreground/10" />
        <div className="absolute top-12 -right-4 w-20 h-20 rounded-full bg-primary-foreground/5" />

        <p className="text-sm opacity-90 mb-1 relative">Your balance</p>
        <div className="flex items-baseline gap-2 mb-5 relative">
          <span className="font-display text-5xl font-semibold">{credits}</span>
          <span className="text-lg opacity-90">Pathway Credits</span>
        </div>
        <button
          onClick={() => navigate("/rewards")}
          className="inline-flex items-center gap-1.5 text-sm font-medium bg-primary-foreground/15 backdrop-blur-sm rounded-full px-4 py-2 hover:bg-primary-foreground/25 transition-colors relative"
        >
          Redeem credits <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </motion.section>

      <ProgressSummary />

      <motion.section

        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl text-foreground">Today's opportunities</h2>
          <button onClick={() => navigate("/tasks")} className="text-sm text-primary font-medium">
            See all
          </button>
        </div>

        <button
          onClick={() => navigate("/tasks")}
          className="block w-full text-left rounded-3xl bg-card shadow-card p-5 border border-border/50 hover:shadow-glow transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-semibold text-primary bg-primary-soft px-2.5 py-1 rounded-full">Featured</span>
            <CreditBadge amount={8} size="sm" />
          </div>
          <h3 className="font-display text-lg text-foreground mb-2 leading-snug">
            Help sort produce at Lowcountry Food Bank
          </h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> North Charleston</span>
            <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> Today, 2pm</span>
          </div>
        </button>
      </motion.section>

      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h2 className="font-display text-xl text-foreground mb-3">A note for today</h2>
        <div className="rounded-3xl bg-secondary p-5 text-secondary-foreground">
          <p className="font-display italic text-base leading-relaxed">
            "Forge your path forward — one step, one act, one day at a time."
          </p>
          <p className="text-xs mt-2 opacity-70">— The ForgingPathways team</p>
        </div>
      </motion.section>
    </div>
  );
};

export default Home;
