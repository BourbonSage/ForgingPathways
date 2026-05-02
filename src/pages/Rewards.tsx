import { motion } from "framer-motion";
import { ShoppingBasket, Bus, Shirt, Coffee, Phone, Utensils } from "lucide-react";
import { CreditBadge } from "@/components/CreditBadge";
import { toast } from "sonner";

const rewards = [
  { id: "1", title: "Grocery box", desc: "Fresh produce & pantry staples", cost: 15, icon: ShoppingBasket, available: true },
  { id: "2", title: "Hot meal", desc: "From a partner restaurant", cost: 8, icon: Utensils, available: true },
  { id: "3", title: "Bus pass (1 wk)", desc: "Unlimited CARTA rides", cost: 20, icon: Bus, available: true },
  { id: "4", title: "Hygiene kit", desc: "Soap, toothbrush, essentials", cost: 6, icon: Coffee, available: true },
  { id: "5", title: "Phone minutes", desc: "30 days of prepaid talk & text", cost: 25, icon: Phone, available: false },
  { id: "6", title: "Clothing voucher", desc: "$30 at partner thrift stores", cost: 30, icon: Shirt, available: false },
];

const balance = 42;

const Rewards = () => {
  return (
    <div className="px-5 pt-12 pb-6 safe-top">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-foreground">Rewards</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Trade credits for what you need
        </p>
      </header>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl bg-card border border-border/50 p-5 mb-6 flex items-center justify-between shadow-soft"
      >
        <div>
          <p className="text-xs text-muted-foreground">Your balance</p>
          <p className="font-display text-3xl text-foreground font-semibold">
            {balance} <span className="text-base font-normal text-muted-foreground">PC</span>
          </p>
        </div>
        <div className="w-14 h-14 rounded-full gradient-warm flex items-center justify-center">
          <span className="text-2xl">✨</span>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        {rewards.map((r, i) => {
          const canAfford = balance >= r.cost && r.available;
          return (
            <motion.button
              key={r.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              whileTap={canAfford ? { scale: 0.97 } : {}}
              onClick={() => {
                if (!r.available) {
                  toast.info("Coming soon to your area.");
                } else if (!canAfford) {
                  toast.info(`You need ${r.cost - balance} more credits.`);
                } else {
                  toast.success(`Reserved! Pick up at the food bank.`);
                }
              }}
              className={`text-left rounded-3xl p-4 border transition-all ${
                canAfford
                  ? "bg-card border-border/50 shadow-soft hover:shadow-card"
                  : "bg-muted/50 border-border/30 opacity-70"
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
                canAfford ? "bg-primary-soft" : "bg-muted"
              }`}>
                <r.icon className={`w-6 h-6 ${canAfford ? "text-primary" : "text-muted-foreground"}`} strokeWidth={1.8} />
              </div>
              <p className="font-display text-base text-foreground leading-tight mb-1">
                {r.title}
              </p>
              <p className="text-xs text-muted-foreground leading-tight mb-3 line-clamp-2">
                {r.desc}
              </p>
              <CreditBadge amount={r.cost} size="sm" />
              {!r.available && (
                <p className="text-[10px] text-muted-foreground mt-2 font-medium uppercase tracking-wide">
                  Coming soon
                </p>
              )}
            </motion.button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center mt-8 px-6 leading-relaxed">
        All rewards are provided in partnership with Lowcountry Food Bank and local organizations.
      </p>
    </div>
  );
};

export default Rewards;
