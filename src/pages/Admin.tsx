import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Copy, ShieldCheck, Loader2, ArrowLeft, Search, UserCog, ScrollText, RefreshCw, Pencil, KeyRound, Check, UserX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { toast } from "sonner";

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  housing_goals: string | null;
  skills: string[] | null;
  case_manager_id: string | null;
  created_at: string;
  deleted_at: string | null;
}

interface EditForm {
  full_name: string;
  phone: string;
  city: string;
  housing_goals: string;
  skills: string;
}

interface RoleRow { id: string; user_id: string; role: AppRole; }
interface Passcode { id: string; code: string; email: string | null; intended_role: AppRole; used_at: string | null; expires_at: string; }
interface AuditEntry {
  id: string;
  created_at: string;
  actor_id: string | null;
  action: string;
  target_user_id: string | null;
  details: Record<string, any> | null;
}

const UNASSIGNED = "__none__";

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [allRoles, setAllRoles] = useState<RoleRow[]>([]);
  const [passcodes, setPasscodes] = useState<Passcode[]>([]);
  const [busy, setBusy] = useState(false);
  const [newCodeEmail, setNewCodeEmail] = useState("");
  const [newCodeRole, setNewCodeRole] = useState<AppRole>("participant");
  const [search, setSearch] = useState("");
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditAction, setAuditAction] = useState("");
  const [auditActor, setAuditActor] = useState<string>("__all__");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/home", { replace: true });
  }, [isAdmin, loading, navigate]);

  const loadAudit = async () => {
    setAuditLoading(true);
    const { data, error } = await supabase
      .from("admin_audit_log")
      .select("id, created_at, actor_id, action, target_user_id, details")
      .order("created_at", { ascending: false })
      .limit(500);
    setAuditLoading(false);
    if (error) { toast.error(error.message); return; }
    setAuditLog((data ?? []) as AuditEntry[]);
  };

  const load = async () => {
    const profilesQuery = supabase
      .from("profiles")
      .select("id, email, full_name, phone, city, housing_goals, skills, case_manager_id, created_at, deleted_at")
      .order("created_at", { ascending: false });
    const [{ data: profiles }, { data: roles }, { data: codes }] = await Promise.all([
      showDeleted ? profilesQuery : profilesQuery.is("deleted_at", null),
      supabase.from("user_roles").select("id, user_id, role"),
      supabase.from("one_time_passcodes").select("*").order("created_at", { ascending: false }),
    ]);
    if (profiles) setUsers(profiles as UserRow[]);
    if (roles) setAllRoles(roles as RoleRow[]);
    if (codes) setPasscodes(codes as Passcode[]);
    await loadAudit();
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, showDeleted]);

  const userRoles = (id: string) => allRoles.filter((r) => r.user_id === id).map((r) => r.role);

  const partners = useMemo(() => {
    // Only active (non-deleted) partners/admins can be assigned as case managers.
    const partnerIds = new Set(allRoles.filter((r) => r.role === "partner" || r.role === "admin").map((r) => r.user_id));
    return users.filter((u) => partnerIds.has(u.id) && !u.deleted_at);
  }, [users, allRoles]);

  const partnerLabel = (id: string | null) => {
    if (!id) return "Unassigned";
    const p = users.find((u) => u.id === id);
    if (!p) return id.slice(0, 8);
    return p.full_name || p.email || id.slice(0, 8);
  };



  const userLabel = (id: string | null) => {
    if (!id) return "—";
    const u = users.find((x) => x.id === id);
    if (!u) return id.slice(0, 8);
    return u.full_name || u.email || id.slice(0, 8);
  };

  const actorOptions = useMemo(() => {
    const ids = Array.from(new Set(auditLog.map((a) => a.actor_id).filter(Boolean))) as string[];
    return ids.map((id) => ({ id, label: userLabel(id) }));
  }, [auditLog, users]);

  const filteredAudit = useMemo(() => {
    const q = auditAction.trim().toLowerCase();
    const from = auditFrom ? new Date(auditFrom).getTime() : null;
    const to = auditTo ? new Date(auditTo).getTime() + 24 * 60 * 60 * 1000 : null;
    return auditLog.filter((a) => {
      if (q && !a.action.toLowerCase().includes(q)) return false;
      if (auditActor !== "__all__" && a.actor_id !== auditActor) return false;
      const t = new Date(a.created_at).getTime();
      if (from && t < from) return false;
      if (to && t > to) return false;
      return true;
    });
  }, [auditLog, auditAction, auditActor, auditFrom, auditTo]);

  const formatDetails = (d: Record<string, any> | null) => {
    if (!d || Object.keys(d).length === 0) return null;
    const entries = Object.entries(d);
    // Surface common old/new value pairings first
    const priority = ["old_value", "new_value", "old_case_manager_label", "new_case_manager_label", "old_role", "new_role"];
    entries.sort((a, b) => {
      const ai = priority.indexOf(a[0]);
      const bi = priority.indexOf(b[0]);
      if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return entries;
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
    // Guard: never (re)assign on a deleted participant or to a deleted partner.
    if (participant?.deleted_at) {
      toast.error("This account is removed and cannot be assigned a case manager.");
      return;
    }
    if (newCm) {
      const partner = users.find((u) => u.id === newCm);
      if (!partner || partner.deleted_at) {
        toast.error("Selected partner is unavailable.");
        return;
      }
    }
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

  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ full_name: "", phone: "", city: "", housing_goals: "", skills: "" });
  const [editSaving, setEditSaving] = useState(false);

  const editProfileSchema = z.object({
    full_name: z.string().trim().max(120, "Name must be 120 characters or fewer"),
    phone: z.string().trim().max(40, "Phone must be 40 characters or fewer"),
    city: z.string().trim().max(120, "City must be 120 characters or fewer"),
    housing_goals: z.string().trim().max(2000, "Housing goals must be 2000 characters or fewer"),
    skills: z.string().trim().max(500, "Skills must be 500 characters or fewer"),
  });

  const openEdit = (u: UserRow) => {
    setEditingUser(u);
    setEditForm({
      full_name: u.full_name ?? "",
      phone: u.phone ?? "",
      city: u.city ?? "",
      housing_goals: u.housing_goals ?? "",
      skills: (u.skills ?? []).join(", "),
    });
  };

  const saveEdit = async () => {
    if (!editingUser || !isAdmin) return;
    const parsed = editProfileSchema.safeParse(editForm);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const v = parsed.data;
    const newValues = {
      full_name: v.full_name || null,
      phone: v.phone || null,
      city: v.city || null,
      housing_goals: v.housing_goals || null,
      skills: v.skills ? v.skills.split(",").map((s) => s.trim()).filter(Boolean) : null,
    };
    const oldValues = {
      full_name: editingUser.full_name,
      phone: editingUser.phone,
      city: editingUser.city,
      housing_goals: editingUser.housing_goals,
      skills: editingUser.skills,
    };
    const changed = (Object.keys(newValues) as (keyof typeof newValues)[]).some(
      (k) => JSON.stringify(newValues[k]) !== JSON.stringify(oldValues[k]),
    );
    if (!changed) {
      toast.info("No changes to save");
      setEditingUser(null);
      return;
    }

    setEditSaving(true);
    const { error } = await supabase.from("profiles").update(newValues).eq("id", editingUser.id);
    if (error) {
      setEditSaving(false);
      toast.error(error.message);
      return;
    }

    const { error: logErr } = await supabase.rpc("log_admin_action", {
      p_action: "edit_profile",
      p_target_user_id: editingUser.id,
      p_details: {
        old_values: oldValues,
        new_values: newValues,
        target_email: editingUser.email,
      } as any,
    });
    if (logErr) console.warn("audit log failed", logErr);

    setEditSaving(false);
    setEditingUser(null);
    await load();
    toast.success("Profile updated");
  };

  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [resetMode, setResetMode] = useState<"generate" | "custom">("generate");
  const [resetCustomPassword, setResetCustomPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetResultPassword, setResetResultPassword] = useState<string | null>(null);
  const [resetCopied, setResetCopied] = useState(false);

  const openReset = (u: UserRow) => {
    if (currentUser && u.id === currentUser.id) {
      toast.error("Use the standard password change flow to reset your own password.");
      return;
    }
    setResetUser(u);
    setResetMode("generate");
    setResetCustomPassword("");
    setResetResultPassword(null);
    setResetCopied(false);
  };

  const submitReset = async () => {
    if (!resetUser) return;
    if (resetMode === "custom") {
      if (resetCustomPassword.length < 12) {
        toast.error("Password must be at least 12 characters");
        return;
      }
      if (resetCustomPassword.length > 128) {
        toast.error("Password must be at most 128 characters");
        return;
      }
    }
    setResetBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-reset-password", {
      body: {
        user_id: resetUser.id,
        ...(resetMode === "custom" ? { new_password: resetCustomPassword } : {}),
      },
    });
    setResetBusy(false);
    if (error) {
      toast.error(error.message || "Reset failed");
      return;
    }
    if (data?.error) {
      toast.error(data.message || data.error);
      return;
    }
    toast.success("Password reset");
    if (data?.generated && data?.password) {
      setResetResultPassword(data.password as string);
    } else {
      setResetUser(null);
    }
    await loadAudit();
  };

  const copyResetPassword = async () => {
    if (!resetResultPassword) return;
    await navigator.clipboard.writeText(resetResultPassword);
    setResetCopied(true);
    toast.success("Copied");
    setTimeout(() => setResetCopied(false), 1500);
  };



  const revokeUser = async (userId: string) => {
    if (!confirm("Revoke all access for this user?")) return;
    setBusy(true);
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await load();
    setBusy(false);
    toast.success("Access revoked");
  };

  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const adminCount = useMemo(
    () => new Set(allRoles.filter((r) => r.role === "admin").map((r) => r.user_id)).size,
    [allRoles],
  );

  const canRemove = (u: UserRow) => {
    if (u.deleted_at) return false;
    if (currentUser && u.id === currentUser.id) return false;
    const rs = userRoles(u.id);
    if (rs.includes("admin") && adminCount <= 1) return false;
    return true;
  };

  const removeReason = (u: UserRow) => {
    if (u.deleted_at) return "Account is already removed.";
    if (currentUser && u.id === currentUser.id) return "You cannot remove your own account.";
    const rs = userRoles(u.id);
    if (rs.includes("admin") && adminCount <= 1) return "Cannot remove the last remaining admin.";
    return "Remove account";
  };

  const confirmDelete = async () => {
    if (!deleteUser) return;
    setDeleteBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: { user_id: deleteUser.id },
    });
    setDeleteBusy(false);
    if (error) { toast.error(error.message || "Removal failed"); return; }
    if (data?.error) { toast.error(data.message || data.error); return; }
    toast.success("Account removed");
    setDeleteUser(null);
    await load();
  };


  const generateSecureCode = () => {
    // crypto.getRandomValues() provides cryptographically secure randomness
    // unlike Math.random(), which is predictable and unsuitable for passcodes.
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return (arr[0] % 900000 + 100000).toString();
  };

  const generateCode = async () => {
    setBusy(true);
    const code = generateSecureCode();
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
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <Switch checked={showDeleted} onCheckedChange={setShowDeleted} />
                Show deleted
              </label>
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
          </div>


          <ul className="space-y-3">
            {filteredUsers.map((u) => {
              const rs = userRoles(u.id);
              const current = rs.includes("admin") ? "admin" : rs.includes("partner") ? "partner" : rs.includes("participant") ? "participant" : "pending";
              const isParticipant = rs.includes("participant");
              const isDeleted = !!u.deleted_at;
              const isSelf = currentUser?.id === u.id;
              return (
                <li key={u.id} className={`rounded-xl p-3 space-y-3 ${isDeleted ? "bg-muted/20 opacity-60" : "bg-muted/40"}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm truncate ${isDeleted ? "line-through" : ""}`}>{u.full_name || "—"}</p>
                      <p className={`text-xs text-muted-foreground truncate ${isDeleted ? "line-through" : ""}`}>{u.email}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-[10px] uppercase tracking-wide text-primary">{rs.join(", ") || "no role"}</p>
                        {isDeleted && (
                          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-semibold">
                            Deleted
                          </span>
                        )}
                        {isSelf && (
                          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Joined {new Date(u.created_at).toLocaleDateString()}
                        {isDeleted && u.deleted_at ? ` · Removed ${new Date(u.deleted_at).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <Select value={current} onValueChange={(v) => setRole(u.id, v as AppRole)} disabled={busy || isDeleted}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="participant">Participant</SelectItem>
                        <SelectItem value="partner">Partner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => openEdit(u)}
                      className="p-2 hover:bg-card rounded-lg disabled:opacity-40"
                      title={isDeleted ? "Account is removed" : "Edit profile"}
                      disabled={isDeleted}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openReset(u)}
                      className="p-2 hover:bg-card rounded-lg disabled:opacity-40"
                      title={
                        isDeleted
                          ? "Account is removed"
                          : isSelf
                            ? "You cannot reset your own password here — use the standard password change flow"
                            : "Reset password"
                      }
                      disabled={isSelf || isDeleted}
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => revokeUser(u.id)}
                      className="p-2 hover:bg-card rounded-lg text-destructive disabled:opacity-40"
                      title={isDeleted ? "Account is removed" : "Revoke all access"}
                      disabled={isDeleted}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteUser(u)}
                      className="p-2 hover:bg-card rounded-lg text-destructive disabled:opacity-40"
                      title={removeReason(u)}
                      disabled={!canRemove(u)}
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  </div>


                  {isParticipant && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                      <UserCog className="w-4 h-4 text-muted-foreground shrink-0" />
                      <Label className="text-xs text-muted-foreground shrink-0">Case manager:</Label>
                      <Select
                        value={u.case_manager_id ?? UNASSIGNED}
                        onValueChange={(v) => assignCaseManager(u.id, v)}
                        disabled={busy || isDeleted}
                      >
                        <SelectTrigger className="flex-1 h-8 text-xs">
                          <SelectValue>{partnerLabel(u.case_manager_id)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                          {partnersFor(u.id).map((p) => (
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

        {/* Audit Log */}
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-3xl p-5 border border-border shadow-soft">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-primary" />
              <h2 className="font-display text-xl">Audit Log ({filteredAudit.length}{filteredAudit.length !== auditLog.length ? ` / ${auditLog.length}` : ""})</h2>
            </div>
            <Button variant="outline" size="sm" onClick={loadAudit} disabled={auditLoading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${auditLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div>
              <Label className="text-xs">Action</Label>
              <Input value={auditAction} onChange={(e) => setAuditAction(e.target.value)} placeholder="e.g. assign_case_manager" />
            </div>
            <div>
              <Label className="text-xs">Actor</Label>
              <Select value={auditActor} onValueChange={setAuditActor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All actors</SelectItem>
                  {actorOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={auditTo} onChange={(e) => setAuditTo(e.target.value)} />
            </div>
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAudit.map((a) => {
                  const entries = formatDetails(a.details);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">{userLabel(a.actor_id)}</TableCell>
                      <TableCell className="text-xs">
                        <span className="font-mono px-2 py-0.5 rounded bg-muted">{a.action}</span>
                      </TableCell>
                      <TableCell className="text-xs">{userLabel(a.target_user_id)}</TableCell>
                      <TableCell className="text-xs">
                        {entries ? (
                          <ul className="space-y-0.5">
                            {entries.map(([k, v]) => (
                              <li key={k} className="leading-snug">
                                <span className="text-muted-foreground">{k}:</span>{" "}
                                <span className="font-mono break-all">
                                  {typeof v === "string" ? v : JSON.stringify(v)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredAudit.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                      {auditLog.length === 0 ? "No audit entries yet." : "No entries match your filters."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </motion.section>



        <div className="text-center">
          <Logo maxWidth={120} />
        </div>
      </div>

      <Dialog open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription className="truncate">
              {editingUser?.email || editingUser?.full_name || "User"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Full name</Label>
              <Input
                value={editForm.full_name}
                maxLength={120}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={editForm.phone}
                maxLength={40}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>City</Label>
              <Input
                value={editForm.city}
                maxLength={120}
                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
              />
            </div>
            <div>
              <Label>Skills (comma separated)</Label>
              <Input
                value={editForm.skills}
                maxLength={500}
                onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })}
                placeholder="carpentry, welding, ..."
              />
            </div>
            <div>
              <Label>Housing goals</Label>
              <Textarea
                value={editForm.housing_goals}
                maxLength={2000}
                rows={3}
                onChange={(e) => setEditForm({ ...editForm, housing_goals: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={editSaving} className="gradient-primary">
              {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!resetUser}
        onOpenChange={(o) => {
          if (!o) {
            setResetUser(null);
            setResetResultPassword(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription className="truncate">
              {resetUser?.email || resetUser?.full_name || "User"}
            </DialogDescription>
          </DialogHeader>

          {resetResultPassword ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Password reset successfully. Share this with the user securely — it will not be shown again.
              </p>
              <div className="flex items-center gap-2 bg-muted rounded-xl p-3">
                <span className="font-mono text-sm break-all flex-1">{resetResultPassword}</span>
                <button onClick={copyResetPassword} className="p-2 rounded-lg hover:bg-card shrink-0" title="Copy">
                  {resetCopied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setResetUser(null);
                    setResetResultPassword(null);
                  }}
                  className="gradient-primary"
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={resetMode === "generate" ? "default" : "outline"}
                  className={resetMode === "generate" ? "gradient-primary flex-1" : "flex-1"}
                  onClick={() => setResetMode("generate")}
                >
                  Generate secure password
                </Button>
                <Button
                  type="button"
                  variant={resetMode === "custom" ? "default" : "outline"}
                  className={resetMode === "custom" ? "gradient-primary flex-1" : "flex-1"}
                  onClick={() => setResetMode("custom")}
                >
                  Set custom password
                </Button>
              </div>

              {resetMode === "custom" && (
                <div>
                  <Label>New password</Label>
                  <Input
                    type="text"
                    value={resetCustomPassword}
                    maxLength={128}
                    onChange={(e) => setResetCustomPassword(e.target.value)}
                    placeholder="At least 12 characters"
                  />
                </div>
              )}

              <div className="text-xs text-muted-foreground space-y-1 rounded-lg bg-muted/60 p-3">
                <p>This will immediately replace the user's current password.</p>
                <p>Their existing sessions will be invalidated and they will be signed out on their next request.</p>
                <p>The action is recorded in the audit log.</p>
              </div>


              <DialogFooter>
                <Button variant="outline" onClick={() => setResetUser(null)} disabled={resetBusy}>
                  Cancel
                </Button>
                <Button onClick={submitReset} disabled={resetBusy} className="gradient-primary">
                  {resetBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset password"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteUser} onOpenChange={(o) => !o && !deleteBusy && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this account?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  You are about to remove{" "}
                  <span className="font-semibold text-foreground">
                    {deleteUser?.full_name || "—"}
                  </span>
                  {deleteUser?.email ? (
                    <> (<span className="font-mono text-foreground">{deleteUser.email}</span>)</>
                  ) : null}
                  .
                </p>
                <p>
                  This is a soft delete: the account is hidden, the user is blocked from
                  signing in, and their data is retained for audit. In practice this action
                  is <span className="font-semibold text-destructive">irreversible</span> from
                  this admin UI — re-enabling the account requires direct database access.
                </p>
                <p>The action is recorded in the audit log.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleteBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Remove account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>


  );
};

export default Admin;
