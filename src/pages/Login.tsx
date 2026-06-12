import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, KeyRound, Lock, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { clearStoredInviteCode, readStoredInviteCode, sanitizeInviteCode, writeStoredInviteCode } from "@/lib/invite-code";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  useEffect(() => {
    setInviteCode(readStoredInviteCode());
  }, []);

  const syncInviteCode = (value: string) => {
    const next = sanitizeInviteCode(value);
    setInviteCode(next);
    writeStoredInviteCode(next);
  };

  const redeemInviteCode = async (code: string) => {
    if (code.length !== 6) return true;
    const { data, error } = await supabase.rpc("redeem_passcode", { _code: code });
    if (error) {
      toast.error(error.message);
      return false;
    }
    const result = data as { ok?: boolean; error?: string; role?: string } | null;
    if (!result?.ok) {
      toast.error(result?.error === "invalid_or_expired" ? "Invite code is invalid, expired, or not for this email." : "Could not apply invite code.");
      return false;
    }
    clearStoredInviteCode();
    setInviteCode("");
    toast.success(`Invite applied: ${result.role}`);
    return true;
  };

  const redirectAfterAuth = () => navigate("/welcome", { replace: true });

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Enter your email");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/welcome` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email for the magic link.");
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Enter your email");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setOtpSent(true);
    toast.success("6-digit code sent to your email.");
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    const applied = await redeemInviteCode(inviteCode);
    setLoading(false);
    if (!applied) return;
    toast.success("Welcome!");
    redirectAfterAuth();
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Enter email and password");
    setLoading(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/welcome`,
          data: { full_name: fullName, phone, city },
        },
      });
      if (error) {
        setLoading(false);
        return toast.error(error.message);
      }
      if (!data.session) {
        setLoading(false);
        toast.success("Account created. Check your email to confirm, then sign in.");
        return;
      }
      const applied = await redeemInviteCode(inviteCode);
      setLoading(false);
      if (!applied) return;
      toast.success("Account created — you're in.");
      redirectAfterAuth();
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoading(false);
        return toast.error(error.message);
      }
      const applied = await redeemInviteCode(inviteCode);
      setLoading(false);
      if (!applied) return;
      toast.success("Welcome back.");
      redirectAfterAuth();
    }
  };

  return (
    <div className="min-h-screen gradient-hero px-5 pt-12 pb-8 safe-top flex flex-col">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center mb-6"
      >
        <Logo maxWidth={220} />
        <p className="font-display italic text-base text-foreground/80 mt-3 text-center max-w-xs leading-snug">
          Forge your path forward. <br />
          <span className="not-italic font-semibold text-primary">Earn. Build. Advance.</span>
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-3xl shadow-card border border-border/50 p-5 max-w-md w-full mx-auto flex-1 flex flex-col"
      >
        <Tabs defaultValue="password" className="flex flex-col flex-1">
          <TabsList className="grid grid-cols-3 mb-5">
            <TabsTrigger value="password"><Lock className="w-3.5 h-3.5 mr-1.5" />Password</TabsTrigger>
            <TabsTrigger value="otp"><KeyRound className="w-3.5 h-3.5 mr-1.5" />Code</TabsTrigger>
            <TabsTrigger value="magic"><Mail className="w-3.5 h-3.5 mr-1.5" />Magic</TabsTrigger>
          </TabsList>

          <TabsContent value="password" className="space-y-4 mt-0">
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`flex-1 py-1.5 rounded-lg font-medium transition ${mode === "signin" ? "bg-primary-soft text-primary" : "text-muted-foreground"}`}
              >Sign in</button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 py-1.5 rounded-lg font-medium transition ${mode === "signup" ? "bg-primary-soft text-primary" : "text-muted-foreground"}`}
              >Create account</button>
            </div>
            <form onSubmit={handlePassword} className="space-y-3">
              <div>
                <Label htmlFor="invite-code">Invite code</Label>
                <Input
                  id="invite-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="123456"
                  value={inviteCode}
                  onChange={(e) => syncInviteCode(e.target.value)}
                  className="font-mono tracking-[0.3em] text-center"
                />
              </div>
              {mode === "signup" && (
                <>
                  <div>
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={100} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
                    </div>
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={50} />
                    </div>
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="email-pw">Email</Label>
                <Input id="email-pw" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="pw">Password</Label>
                <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl gradient-primary">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "signup" ? "Create account" : "Sign in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="otp" className="space-y-3 mt-0">
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-3">
                <p className="text-sm text-muted-foreground">We'll email you a 6-digit code.</p>
                <div>
                  <Label htmlFor="invite-code-otp">Invite code</Label>
                  <Input
                    id="invite-code-otp"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="123456"
                    value={inviteCode}
                    onChange={(e) => syncInviteCode(e.target.value)}
                    className="font-mono tracking-[0.3em] text-center"
                  />
                </div>
                <div>
                  <Label htmlFor="email-otp">Email</Label>
                  <Input id="email-otp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl gradient-primary">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send code"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to {email}.</p>
                <div>
                  <Label htmlFor="otp">Code</Label>
                  <Input id="otp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} required />
                </div>
                <Button type="submit" disabled={loading || otp.length !== 6} className="w-full h-11 rounded-xl gradient-primary">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & sign in"}
                </Button>
                <button type="button" onClick={() => { setOtpSent(false); setOtp(""); }} className="text-xs text-muted-foreground w-full text-center">
                  Use a different email
                </button>
              </form>
            )}
          </TabsContent>

          <TabsContent value="magic" className="space-y-3 mt-0">
            <form onSubmit={handleMagicLink} className="space-y-3">
              <p className="text-sm text-muted-foreground">We'll email you a one-time link to sign in.</p>
              <div>
                <Label htmlFor="invite-code-magic">Invite code</Label>
                <Input
                  id="invite-code-magic"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="123456"
                  value={inviteCode}
                  onChange={(e) => syncInviteCode(e.target.value)}
                  className="font-mono tracking-[0.3em] text-center"
                />
              </div>
              <div>
                <Label htmlFor="email-magic">Email</Label>
                <Input id="email-magic" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl gradient-primary">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send magic link"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="text-[11px] text-muted-foreground text-center mt-5 leading-relaxed">
          By continuing you agree to our community guidelines. <br />
          Your story stays yours. Always.
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
