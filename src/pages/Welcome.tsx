import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Hammer, TrendingUp, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

const Welcome = () => {
  const navigate = useNavigate();
  const { user, isPending, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
    if (!loading && user && isPending) navigate("/pending", { replace: true });
  }, [user, isPending, loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col gradient-hero px-6 pt-10 pb-10 safe-top">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="flex-1 flex flex-col items-center justify-center text-center"
      >
        <Logo maxWidth={200} />

        <h1 className="font-display text-4xl leading-[1.05] text-foreground mt-6 mb-3">
          Welcome to <br />
          <span className="italic text-primary">ForgingPathways</span>
        </h1>

        <p className="font-display italic text-base text-foreground/80 max-w-xs leading-relaxed mb-2">
          Forge your path forward.
        </p>
        <p className="text-sm font-semibold text-primary mb-10">
          Earn. Build. Advance.
        </p>

        <div className="grid grid-cols-1 gap-3 w-full max-w-sm">
          <Feature icon={Hammer} title="Earn credits" desc="Help out at Lowcountry Food Bank and partner sites." />
          <Feature icon={TrendingUp} title="Build & advance" desc="Trade credits for groceries, transit, and essentials." />
          <Feature icon={Shield} title="Private & dignified" desc="Your story stays yours. Always." />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <Button
          size="lg"
          onClick={() => navigate("/home")}
          className="w-full h-14 text-base font-semibold rounded-2xl gradient-primary shadow-glow hover:shadow-card transition-all"
        >
          Enter the app
        </Button>
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
