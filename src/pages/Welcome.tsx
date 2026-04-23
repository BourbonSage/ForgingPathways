import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Heart, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const Welcome = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col gradient-hero px-6 pt-16 pb-10 safe-top">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="flex-1 flex flex-col items-center justify-center text-center"
      >
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.1, type: "spring", bounce: 0.4 }}
          className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center shadow-glow mb-8"
        >
          <Sparkles className="w-11 h-11 text-primary-foreground" strokeWidth={1.6} />
        </motion.div>

        <h1 className="font-display text-5xl leading-[1.05] text-foreground mb-4">
          Welcome to <br />
          <span className="italic text-primary">Harmony Haven</span>
        </h1>

        <p className="text-base text-muted-foreground max-w-xs leading-relaxed mb-10">
          A community where small contributions become real change. Earn credits, build dignity, share the harvest.
        </p>

        <div className="grid grid-cols-1 gap-3 w-full max-w-sm mb-10">
          <Feature icon={Sparkles} title="Earn Harmony Credits" desc="Help out, gain credits — at the food bank and beyond." />
          <Feature icon={Heart} title="Redeem essentials" desc="Trade credits for groceries, hygiene, transit." />
          <Feature icon={Shield} title="Private & dignified" desc="Your story stays yours. Always." />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="space-y-3"
      >
        <Button
          size="lg"
          onClick={() => navigate("/home")}
          className="w-full h-14 text-base font-semibold rounded-2xl gradient-primary shadow-glow hover:shadow-card transition-all"
        >
          Get started
        </Button>
        <button
          onClick={() => navigate("/home")}
          className="w-full text-sm text-muted-foreground py-2 hover:text-foreground transition-colors"
        >
          I already have an account
        </button>
      </motion.div>
    </div>
  );
};

const Feature = ({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) => (
  <div className="flex items-start gap-4 bg-card/70 backdrop-blur-sm rounded-2xl p-4 text-left shadow-soft">
    <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center flex-shrink-0">
      <Icon className="w-5 h-5 text-primary" strokeWidth={2} />
    </div>
    <div>
      <p className="font-semibold text-sm text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{desc}</p>
    </div>
  </div>
);

export default Welcome;
