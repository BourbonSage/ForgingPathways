import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Hourglass, LogOut, RefreshCw, KeyRound, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { clearStoredInviteCode, readStoredInviteCode, sanitizeInviteCode, writeStoredInviteCode } from "@/lib/invite-code";

const Pending = () => {
  const { signOut, user, roles, refreshRoles, isPending } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const attemptedAutoRedeem = useRef(false);

  useEffect(() => {
    setCode(readStoredInviteCode());
  }, []);

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

  const syncCode = (value: string) => {
    const next = sanitizeInviteCode(value);
    setCode(next);
    writeStoredInviteCode(next);
  };

  const redeem = async (value = code, silent = false) => {
    if (value.length !== 6) {
      if (!silent) toast.error("Enter your 6-digit code");
      return false;
    }
    setRedeeming(true);
    const { data, error } = await supabase.rpc("redeem_passcode", { _code: value });
    setRedeeming(false);
    if (error) {
      if (!silent) toast.error(error.message);
      return false;
    }
    const res = data as { ok: boolean; error?: string; role?: string };
    if (!res?.ok) {
      if (!silent) {
        toast.error(res?.error === "invalid_or_expired" ? "Code is invalid, expired, or not for this email." : "Could not redeem code.");
      }
      return false;
    }
    clearStoredInviteCode();
    setCode("");
    toast.success(`You're in as ${res.role}.`);
    await refreshRoles();
    navigate("/home", { replace: true });
    return true;
  };

  useEffect(() => {
    if (!isPending || attemptedAutoRedeem.current || code.length !== 6) return;
    attemptedAutoRedeem.current = true;
    void redeem(code, true);
  }, [code, isPending]);

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
      <p className="text-xs text-muted-foreground mb-6">{user?.email}</p>

      <div className="bg-card border border-border rounded-2xl p-4 max-w-sm w-full mb-6 shadow-soft">
        <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-foreground">
          <KeyRound className="w-4 h-4 text-primary" /> Have an invite code?
        </div>
        <p className="text-xs text-muted-foreground mb-3 text-left">
          Skip the wait — enter the 6-digit code your admin gave you.
        </p>
        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => syncCode(e.target.value)}
            className="font-mono tracking-widest text-center text-lg"
          />
          <Button onClick={redeem} disabled={redeeming || code.length !== 6} className="gradient-primary">
            {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : "Redeem"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 items-center">
        <Button onClick={() => refreshRoles()} variant="outline">
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
