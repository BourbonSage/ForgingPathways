import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  TrendingUp,
  Award,
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditBadge } from "@/components/CreditBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  credits: number;
  case_manager_id: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string;
  partner: string;
  org: string;
  location: string;
  duration: string;
  est_hours: number | null;
  pathway_credits: number | null;
  credits: number;
}

interface UserTask {
  id: string;
  user_id: string;
  task_id: string;
  status: string;
  verified: boolean;
  claimed_at: string;
  completed_at: string | null;
  assigned_by: string | null;
}

const creditsFor = (t: Task) => t.pathway_credits ?? t.credits ?? 0;

const startOfWeek = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
};

const statusPill = (ut: UserTask) => {
  if (ut.verified) return { label: "Verified", cls: "bg-primary/15 text-primary" };
  if (ut.status === "rejected") return { label: "Rejected", cls: "bg-destructive/15 text-destructive" };
  if (ut.status === "pending_verification" || ut.completed_at)
    return { label: "Pending review", cls: "bg-accent/20 text-accent-foreground" };
  if (ut.assigned_by) return { label: "Assigned", cls: "bg-secondary text-secondary-foreground" };
  return { label: "Claimed", cls: "bg-muted text-muted-foreground" };
};

const ParticipantDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isPartner, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [userTasks, setUserTasks] = useState<UserTask[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignOpen, setAssignOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isPartner) navigate("/home", { replace: true });
  }, [authLoading, isPartner, navigate]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: p }, { data: ut }, { data: t }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, phone, city, credits, case_manager_id")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("user_tasks")
        .select(
          "id, user_id, task_id, status, verified, claimed_at, completed_at, assigned_by"
        )
        .eq("user_id", id)
        .order("claimed_at", { ascending: false }),
      supabase
        .from("tasks")
        .select(
          "id, title, description, partner, org, location, duration, est_hours, pathway_credits, credits"
        )
        .eq("active", true)
        .order("pathway_credits", { ascending: false, nullsFirst: false }),
    ]);
    setProfile((p as Profile) ?? null);
    setUserTasks(((ut as any) ?? []) as UserTask[]);
    setTasks(((t as any) ?? []) as Task[]);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (isPartner && id) load();
  }, [isPartner, id, load]);

  const taskById = useMemo(() => {
    const m = new Map<string, Task>();
    tasks.forEach((t) => m.set(t.id, t));
    return m;
  }, [tasks]);

  const stats = useMemo(() => {
    const ws = startOfWeek(new Date());
    const verified = userTasks.filter((u) => u.verified);
    const completedThisWeek = verified.filter(
      (u) => u.completed_at && new Date(u.completed_at) >= ws
    ).length;
    const pending = userTasks.filter(
      (u) => !u.verified && (u.status === "pending_verification" || u.completed_at)
    ).length;
    return { completed: verified.length, completedThisWeek, pending };
  }, [userTasks]);

  const claimedIds = useMemo(
    () => new Set(userTasks.filter((u) => !u.verified && u.status !== "rejected").map((u) => u.task_id)),
    [userTasks]
  );

  const availableTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks
      .filter((t) => !claimedIds.has(t.id))
      .filter(
        (t) =>
          !q ||
          t.title.toLowerCase().includes(q) ||
          (t.partner || "").toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q)
      );
  }, [tasks, claimedIds, search]);

  const assign = async (task: Task) => {
    if (!user || !profile) return;
    setAssigning(task.id);
    const { data, error } = await supabase
      .from("user_tasks")
      .insert({
        user_id: profile.id,
        task_id: task.id,
        assigned_by: user.id,
        assigned_at: new Date().toISOString(),
        status: "claimed",
      })
      .select(
        "id, user_id, task_id, status, verified, claimed_at, completed_at, assigned_by"
      )
      .single();
    setAssigning(null);
    if (error || !data) {
      toast.error(error?.message || "Could not assign task");
      return;
    }
    setUserTasks((prev) => [data as UserTask, ...prev]);
    toast.success(`Assigned “${task.title}”`);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Participant not found.</p>
        <Button onClick={() => navigate("/case-manager")}>Back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="px-5 pt-10 pb-4 safe-top bg-card border-b border-border">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => navigate("/case-manager")}
            className="p-2 -ml-2 rounded-lg hover:bg-muted"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl text-foreground leading-tight truncate">
              {profile.full_name || "—"}
            </h1>
            <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
          </div>
          <CreditBadge amount={profile.credits ?? 0} size="sm" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 pt-6 space-y-6">
        {/* Profile */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl gradient-hero p-5 border border-border/50"
        >
          <p className="text-xs text-muted-foreground mb-1">Total Forge Credits</p>
          <div className="flex items-end gap-3 mb-4">
            <span className="font-display text-4xl text-foreground font-semibold">
              {profile.credits ?? 0}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {profile.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {profile.email}
              </span>
            )}
            {profile.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> {profile.phone}
              </span>
            )}
            {profile.city && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> {profile.city}
              </span>
            )}
          </div>
        </motion.section>

        {/* Stats */}
        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-card p-4 shadow-soft border border-border/50">
            <Award className="w-5 h-5 mb-2 text-primary" />
            <p className="font-display text-2xl font-semibold">{stats.completed}</p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">
              Completed
            </p>
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-soft border border-border/50">
            <TrendingUp className="w-5 h-5 mb-2 text-secondary-foreground" />
            <p className="font-display text-2xl font-semibold">
              {stats.completedThisWeek}
            </p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">
              This week
            </p>
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-soft border border-border/50">
            <ClipboardList className="w-5 h-5 mb-2 text-accent-glow" />
            <p className="font-display text-2xl font-semibold">{stats.pending}</p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">
              Pending review
            </p>
          </div>
        </section>

        {/* Task history */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-3xl p-5 border border-border shadow-soft"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl">Task history</h2>
            <Button size="sm" onClick={() => setAssignOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Assign
            </Button>
          </div>

          {userTasks.length === 0 ? (
            <div className="rounded-2xl bg-muted/40 p-6 text-center text-sm text-muted-foreground">
              No tasks yet. Assign one to get started.
            </div>
          ) : (
            <ul className="space-y-2">
              {userTasks.map((ut) => {
                const task = taskById.get(ut.task_id);
                const pill = statusPill(ut);
                const stamp = ut.completed_at ?? ut.claimed_at;
                return (
                  <li
                    key={ut.id}
                    className="flex items-start gap-3 bg-muted/40 rounded-xl p-3"
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        ut.verified ? "bg-primary-soft" : "bg-card"
                      }`}
                    >
                      {ut.verified ? (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span
                          className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${pill.cls}`}
                        >
                          {pill.label}
                        </span>
                        {ut.assigned_by && (
                          <span className="text-[10px] text-muted-foreground">
                            assigned
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-sm text-foreground truncate">
                        {task?.title ?? "Task"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(stamp).toLocaleDateString()}{" "}
                        {task ? `· ${task.partner || task.org}` : ""}
                      </p>
                    </div>
                    {task && (
                      <CreditBadge amount={creditsFor(task)} size="sm" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </motion.section>
      </div>

      {/* Assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Assign a task
            </DialogTitle>
            <DialogDescription>
              Pick a task to assign to{" "}
              <span className="text-foreground font-medium">
                {profile.full_name || profile.email}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="pl-9"
            />
          </div>

          <div className="max-h-[55vh] overflow-y-auto -mx-2 px-2">
            {availableTasks.length === 0 ? (
              <div className="rounded-2xl bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                No matching tasks available.
              </div>
            ) : (
              <ul className="space-y-2">
                {availableTasks.map((task) => (
                  <li
                    key={task.id}
                    className="rounded-2xl border border-border/60 p-3 flex items-start gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <CreditBadge amount={creditsFor(task)} size="sm" />
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
                          {task.partner || task.org}
                        </p>
                      </div>
                      <p className="font-semibold text-sm truncate">
                        {task.title}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {task.location}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />{" "}
                          {task.est_hours
                            ? `${task.est_hours} hr`
                            : task.duration}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => assign(task)}
                      disabled={assigning === task.id}
                    >
                      {assigning === task.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Assign"
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ParticipantDetail;
