import { useEffect } from "react";
import { motion } from "framer-motion";
import { Hourglass, LogOut, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const Pending = () => {
  const { signOut, user, roles, refreshRoles, isPending } = useAuth();
  const navigate = useNavigate();

  // Poll for role changes every 5s; redirect once approved
  useEffect(() => {
    if (!isPending) {
      navigate("/home", { replace: true });
      return;
    }
    const id = setInterval(() => { refreshRoles(); }, 5000);
    const onFocus = () => refreshRoles();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, [isPending, roles, refreshRoles, navigate]);

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
      <div className="flex flex-col gap-2 items-center">
        <Button onClick={() => refreshRoles()} className="gradient-primary">
          <RefreshCw className="w-4 h-4 mr-2" /> Check again
        </Button>
        <Button variant="ghost" onClick={signOut} className="text-muted-foreground">
          <LogOut className="w-4 h-4 mr-2" /> Sign out
        </Button>
      </div>
    </div>
  );
};

export default Pending;
