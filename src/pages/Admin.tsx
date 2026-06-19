import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Copy, ShieldCheck, Loader2, ArrowLeft, Search, UserCog } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { toast } from "sonner";

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  case_manager_id: string | null;
  created_at: string;
}
interface RoleRow { id: string; user_id: string; role: AppRole; }
interface Passcode { id: string; code: string; email: string | null; intended_role: AppRole; used_at: string | null; expires_at: string; }

const UNASSIGNED = "__none__";

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [allRoles, setAllRoles] = useState<RoleRow[]>([]);
  const [passcodes, setPasscodes] = useState<Passcode[]>([]);
  const [busy, setBusy] = useState(false);
  const [newCodeEmail, setNewCodeEmail] = useState("");
  const [newCodeRole, setNewCodeRole] = useState<AppRole>("participant");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/home", { replace: true });
  }, [isAdmin, loading, navigate]);

  const load = async () => {
    const [{ data: profiles }, { data: roles }, { data: codes }] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, case_manager_id, created_at").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("id, user_id, role"),
      supabase.from("one_time_passcodes").select("*").order("created_at", { ascending: false }),
    ]);
    if (profiles) setUsers(profiles as UserRow[]);
    if (roles) setAllRoles(roles as RoleRow[]);
    if (codes) setPasscodes(codes as Passcode[]);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const userRoles = (id: string) => allRoles.filter((r) => r.user_id === id).map((r) => r.role);

  const partners = useMemo(() => {
    const partnerIds = new Set(allRoles.filter((r) => r.role === "partner" || r.role === "admin").map((r) => r.user_id));
    return users.filter((u) => partnerIds.has(u.id));
  }, [users, allRoles]);

  const partnerLabel = (id: string | null) => {
    if (!id) return "Unassigned";
    const p = users.find((u) => u.id === id);
    if (!p) return id.slice(0, 8);
    return p.full_name || p.email || id.slice(0, 8);
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
    );
  }, [users, search]);

  const setRole = async (userId: string, role: AppRole) => {
    setBusy(true);
    const existing = allRoles.filter((r) => r.user_id === userId);
    const hasRole = existing.some((r) => r.role === role);
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

  const assignCaseManager = async (participantId: string, value: string) => {
    const newCm = value === UNASSIGNED ? null : value;
    const participant = users.find((u) => u.id === participantId);
    const oldCm = participant?.case_manager_id ?? null;
    if (oldCm === newCm) return;

    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ case_manager_id: newCm })
      .eq("id", participantId);

    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }

    const { error: logErr } = await supabase.rpc("log_admin_action", {
      p_action: "assign_case_manager",
      p_target_user_id: participantId,
      p_details: {
        old_case_manager_id: oldCm,
        new_case_manager_id: newCm,
        old_case_manager_label: partnerLabel(oldCm),
        new_case_manager_label: partnerLabel(newCm),
        participant_email: participant?.email ?? null,
      },
    });
    if (logErr) console.warn("audit log failed", logErr);

    await load();
    setBusy(false);
    toast.success("Case manager updated");
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

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="px-5 pt-10 pb-4 safe-top bg-card border-b border-border">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <button onClick={() => navigate("/home")} className="p-2 -ml-2 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <ShieldCheck className="w-6 h-6 text-primary" />
          <div>
            <h1 className="font-display text-2xl text-foreground leading-tight">Admin</h1>
            <p className="text-xs text-muted-foreground">Manage roles, case managers & access</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 pt-6 space-y-8">
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
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h2 className="font-display text-xl">Users ({filteredUsers.length}{search ? ` / ${users.length}` : ""})</h2>
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email"
                className="pl-9"
              />
            </div>
          </div>

          <ul className="space-y-3">
            {filteredUsers.map((u) => {
              const rs = userRoles(u.id);
              const current = rs.includes("admin") ? "admin" : rs.includes("partner") ? "partner" : rs.includes("participant") ? "participant" : "pending";
              const isParticipant = rs.includes("participant");
              return (
                <li key={u.id} className="bg-muted/40 rounded-xl p-3 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{u.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      <p className="text-[10px] uppercase tracking-wide text-primary mt-0.5">{rs.join(", ") || "no role"}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Joined {new Date(u.created_at).toLocaleDateString()}</p>
                    </div>
                    <Select value={current} onValueChange={(v) => setRole(u.id, v as AppRole)} disabled={busy}>
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
                  </div>

                  {isParticipant && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                      <UserCog className="w-4 h-4 text-muted-foreground shrink-0" />
                      <Label className="text-xs text-muted-foreground shrink-0">Case manager:</Label>
                      <Select
                        value={u.case_manager_id ?? UNASSIGNED}
                        onValueChange={(v) => assignCaseManager(u.id, v)}
                        disabled={busy}
                      >
                        <SelectTrigger className="flex-1 h-8 text-xs">
                          <SelectValue>{partnerLabel(u.case_manager_id)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                          {partners.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.full_name || p.email || p.id.slice(0, 8)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </li>
              );
            })}
            {filteredUsers.length === 0 && (
              <li className="text-center text-sm text-muted-foreground py-6">No users match your search.</li>
            )}
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
