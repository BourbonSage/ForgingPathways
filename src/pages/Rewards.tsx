import { useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBasket, Bus, Shirt, Coffee, Utensils, GraduationCap, Loader2 } from "lucide-react";
import { CreditBadge } from "@/components/CreditBadge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Reward = {
  key: string;
  title: string;
  desc: string;
  cost: number;
  icon: typeof ShoppingBasket;
  tier: 1 | 2 | 3;
};

const REWARDS: Reward[] = [
  // Tier 1 — Essentials
  { key: "meal", title: "Hot meal", desc: "From a partner restaurant", cost: 8, icon: Utensils, tier: 1 },
  { key: "hygiene", title: "Hygiene kit", desc: "Soap, toothbrush, essentials", cost: 6, icon: Coffee, tier: 1 },
  { key: "grocery", title: "Grocery box", desc: "Fresh produce & pantry staples", cost: 15, icon: ShoppingBasket, tier: 1 },
  // Tier 2 — Mobility
  { key: "bus_pass", title: "Bus pass (1 wk)", desc: "Unlimited CARTA rides", cost: 20, icon: Bus, tier: 2 },
  // Tier 3 — Pathways
  { key: "interview_outfit", title: "Interview outfit", desc: "Professional clothing voucher", cost: 45, icon: Shirt, tier: 3 },
  { key: "workshop", title: "Skills workshop", desc: "Seat at a partner training session", cost: 50, icon: GraduationCap, tier: 3 },
];

const TIER_META = {
  1: { label: "Tier 1 · Essentials", desc: "Immediate needs" },
  2: { label: "Tier 2 · Mobility", desc: "Getting where you need to go" },
  3: { label: "Tier 3 · Pathways", desc: "Building your future" },
} as const;

const Rewards = () => {
  const { user } = useAuth();
  const { credits, refresh } = useCredits();
  const [pending, setPending] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Reward | null>(null);

  const redeem = async (r: Reward) => {
    if (!user) return;
    if (credits < r.cost) {
      toast.info(`You need ${r.cost - credits} more credits.`);
      return;
    }
    setPending(r.key);
    // Server-validated redemption — participants cannot insert ledger rows directly.
    const { error } = await supabase.rpc("redeem_reward", {
      p_cost: r.cost,
      p_title: r.title,
    });
    setPending(null);
    if (error) {
      const msg = (error.message || "").toLowerCase();
      toast.error(
        msg.includes("insufficient")
          ? "Not enough credits."
          : "Could not redeem. Try again."
      );
      return;
    }
    await refresh();
    setConfirmed(r);
  };

  const tiers: Array<1 | 2 | 3> = [1, 2, 3];

  return (
    <div className="px-5 pt-4 pb-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-foreground">Rewards</h1>
        <p className="text-sm text-muted-foreground mt-1">Trade Forge Credits for what you need</p>
      </header>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-card border border-border/50 p-5 mb-6 flex items-center justify-between shadow-soft"
      >
        <div>
          <p className="text-xs text-muted-foreground">Your balance</p>
          <p className="font-display text-3xl text-foreground font-semibold">
            {credits} <span className="text-base font-normal text-muted-foreground">FC</span>
          </p>
        </div>
        <div className="w-14 h-14 rounded-full gradient-warm flex items-center justify-center">
          <span className="text-2xl">✨</span>
        </div>
      </motion.div>

      {tiers.map((tier) => {
        const items = REWARDS.filter((r) => r.tier === tier);
        return (
          <section key={tier} className="mb-7">
            <div className="mb-3 px-1">
              <h2 className="font-display text-lg text-foreground">{TIER_META[tier].label}</h2>
              <p className="text-xs text-muted-foreground">{TIER_META[tier].desc}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {items.map((r, i) => {
                const canAfford = credits >= r.cost;
                const isPending = pending === r.key;
                return (
                  <motion.div
                    key={r.key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * i }}
                    className={`rounded-3xl p-4 border transition-all flex flex-col ${
                      canAfford ? "bg-card border-border/50 shadow-soft" : "bg-muted/50 border-border/30"
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
                      canAfford ? "bg-primary-soft" : "bg-muted"
                    }`}>
                      <r.icon className={`w-6 h-6 ${canAfford ? "text-primary" : "text-muted-foreground"}`} strokeWidth={1.8} />
                    </div>
                    <p className="font-display text-base text-foreground leading-tight mb-1">{r.title}</p>
                    <p className="text-xs text-muted-foreground leading-tight mb-3 line-clamp-2 flex-1">{r.desc}</p>
                    <div className="flex items-center justify-between gap-2 mt-auto">
                      <CreditBadge amount={r.cost} size="sm" />
                      <Button
                        size="sm"
                        disabled={!canAfford || isPending}
                        onClick={() => redeem(r)}
                        className="h-8 px-3 text-xs"
                      >
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Redeem"}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        );
      })}

      <p className="text-xs text-muted-foreground text-center mt-4 px-6 leading-relaxed">
        All rewards are provided in partnership with Lowcountry Food Bank and local organizations.
      </p>

      <Dialog open={!!confirmed} onOpenChange={(o) => !o && setConfirmed(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Redeemed! 🎉</DialogTitle>
            <DialogDescription className="pt-1">
              <span className="font-semibold text-foreground">{confirmed?.title}</span> is reserved for you.
              Pick it up at the Lowcountry Food Bank front desk and show this screen.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl bg-primary-soft p-4 text-center my-2">
            <p className="text-xs text-muted-foreground">Spent</p>
            <p className="font-display text-2xl text-primary font-semibold">{confirmed?.cost} FC</p>
            <p className="text-xs text-muted-foreground mt-1">New balance: {credits} FC</p>
          </div>
          <Button onClick={() => setConfirmed(null)}>Done</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Rewards;
