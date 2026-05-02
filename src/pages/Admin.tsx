import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Copy, ShieldCheck, Loader2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { toast } from "sonner";

interface UserRow { id: string; email: string | null; full_name: string | null; }
interface RoleRow { id: string; user_id: string; role: AppRole; }
interface Passcode { id: string; code: string; email: string | null; intended_role: AppRole; used_at: string | null; expires_at: string; }

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [allRoles, setAllRoles] = useState<RoleRow[]>([]);
  const [passcodes, setPasscodes] = useState<Passcode[]>([]);
  const [busy, setBusy] = useState(false);
  const [newCodeEmail, setNewCodeEmail] = useState("");
  const [newCodeRole, setNewCodeRole] = useState<AppRole>("participant");

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/home", { replace: true });
  }, [isAdmin, loading, navigate]);

  const load = async () => {
    const [{ data: profiles }, { data: roles }, { data: codes }] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("id, user_id, role"),
      supabase.from("one_time_passcodes").select("*").order("created_at", { ascending: false }),
    ]);
    if (profiles) setUsers(profiles as UserRow[]);
    if (roles) setAllRoles(roles as RoleRow[]);
    if (codes) setPasscodes(codes as Passcode[]);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const setRole = async (userId: string, role: AppRole) => {
    setBusy(true);
    // remove pending; add new role if not present
    const existing = allRoles.filter((r) => r.user_id === userId);
    const hasRole = existing.some((r) => r.role === role);
    // delete pending and other non-target if switching
    const toDelete = existing.filter((r) => r.role !== role);
    for (const r of toDelete) {
      await supabase.from("user_roles").delete().eq("id", r.id);
    }
    if (!hasRole) {
      await supabase.from("user_roles").insert({ user_id: userId, role });
    }
    await load();
    setBusy(false);
    toast.success(`Role updated to ${role}`);
  };

  const revokeUser = async (userId: string) => {
    if (!confirm("Revoke all access for this user?")) return;
    setBusy(true);
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await load();
    setBusy(false);
    toast.success("Access revoked");
  };

  const generateCode = async () => {
    setBusy(true);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const { error } = await supabase.from("one_time_passcodes").insert({
      code,
      email: newCodeEmail || null,
      intended_role: newCodeRole,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setNewCodeEmail("");
    await load();
    toast.success(`Code generated: ${code}`);
  };

  const copyCode = (c: string) => {
    navigator.clipboard.writeText(c);
    toast.success("Copied");
  };

  const deleteCode = async (id: string) => {
    await supabase.from("one_time_passcodes").delete().eq("id", id);
    await load();
  };

  const userRoles = (id: string) => allRoles.filter((r) => r.user_id === id).map((r) => r.role);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="px-5 pt-10 pb-4 safe-top bg-card border-b border-border">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button onClick={() => navigate("/home")} className="p-2 -ml-2 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <ShieldCheck className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-display text-2xl text-foreground leading-tight">Admin</h1>
            <p className="text-xs text-muted-foreground">Manage roles & access</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 pt-6 space-y-8">
        {/* Generate passcode */}
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-3xl p-5 border border-border shadow-soft">
          <h2 className="font-display text-xl mb-3">Generate one-time passcode</h2>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label>Email (optional)</Label>
              <Input value={newCodeEmail} onChange={(e) => setNewCodeEmail(e.target.value)} placeholder="staff@example.com" />
            </div>
            <div>
              <Label>Role on use</Label>
              <Select value={newCodeRole} onValueChange={(v) => setNewCodeRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="participant">Participant</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generateCode} disabled={busy} className="gradient-primary">
              <Plus className="w-4 h-4 mr-1" /> Generate code
            </Button>
          </div>

          {passcodes.length > 0 && (
            <ul className="mt-5 space-y-2">
              {passcodes.map((p) => (
                <li key={p.id} className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
                  <span className="font-mono text-lg font-semibold tracking-wider">{p.code}</span>
                  <div className="flex-1 text-xs text-muted-foreground min-w-0">
                    <p className="truncate">{p.email || "any email"} · {p.intended_role}</p>
                    <p>{p.used_at ? `used ${new Date(p.used_at).toLocaleDateString()}` : `expires ${new Date(p.expires_at).toLocaleDateString()}`}</p>
                  </div>
                  <button onClick={() => copyCode(p.code)} className="p-2 hover:bg-card rounded-lg"><Copy className="w-4 h-4" /></button>
                  <button onClick={() => deleteCode(p.id)} className="p-2 hover:bg-card rounded-lg text-destructive"><Trash2 className="w-4 h-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        {/* Users */}
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-3xl p-5 border border-border shadow-soft">
          <h2 className="font-display text-xl mb-3">Users ({users.length})</h2>
          <ul className="space-y-2">
            {users.map((u) => {
              const rs = userRoles(u.id);
              const current = rs.includes("admin") ? "admin" : rs.includes("partner") ? "partner" : rs.includes("participant") ? "participant" : "pending";
              return (
                <li key={u.id} className="flex items-center gap-3 bg-muted/40 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{u.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    <p className="text-[10px] uppercase tracking-wide text-primary mt-0.5">{rs.join(", ") || "no role"}</p>
                  </div>
                  <Select value={current} onValueChange={(v) => setRole(u.id, v as AppRole)}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="participant">Participant</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <button onClick={() => revokeUser(u.id)} className="p-2 hover:bg-card rounded-lg text-destructive" title="Revoke all access">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </motion.section>

        <div className="text-center">
          <Logo maxWidth={120} />
        </div>
      </div>
    </div>
  );
};

export default Admin;
