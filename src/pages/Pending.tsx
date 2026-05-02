import { motion } from "framer-motion";
import { Hourglass, LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const Pending = () => {
  const { signOut, user } = useAuth();
  return (
    <div className="min-h-screen gradient-hero px-6 py-12 flex flex-col items-center justify-center text-center safe-top">
      <Logo maxWidth={180} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center shadow-glow my-8"
      >
        <Hourglass className="w-9 h-9 text-primary-foreground" />
      </motion.div>
      <h1 className="font-display text-3xl text-foreground mb-3">You're on the list</h1>
      <p className="text-base text-muted-foreground max-w-sm leading-relaxed mb-2">
        Thanks for joining ForgingPathways. An admin will review your account shortly and grant you access.
      </p>
      <p className="text-xs text-muted-foreground mb-8">{user?.email}</p>
      <Button variant="ghost" onClick={signOut} className="text-muted-foreground">
        <LogOut className="w-4 h-4 mr-2" /> Sign out
      </Button>
    </div>
  );
};

export default Pending;
