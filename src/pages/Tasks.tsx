import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock, Loader2, CheckCircle2 } from "lucide-react";
import { CreditBadge } from "@/components/CreditBadge";
import { ClaimDialog } from "@/components/ClaimDialog";
import { VerifyDialog } from "@/components/VerifyDialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  description: string;
  credits: number;
  pathway_credits: number | null;
  location: string;
  duration: string;
  est_hours: number | null;
  org: string;
  partner: string;
}

interface UserTask {
  id: string;
  task_id: string;
  verified: boolean;
  completed_at: string | null;
}

const creditsFor = (t: Task) => t.pathway_credits ?? t.credits ?? 0;
const durationLabel = (t: Task) =>
  t.est_hours ? `${t.est_hours} hr${t.est_hours === 1 ? "" : "s"}` : t.duration;

const Tasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userTasks, setUserTasks] = useState<UserTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimDialog, setClaimDialog] = useState<{ open: boolean; title: string; credits: number }>({
    open: false,
    title: "",
    credits: 0,
  });
  const [verifyDialog, setVerifyDialog] = useState<{
    open: boolean;
    userTaskId: string | null;
    taskId: string | null;
    title: string;
    credits: number;
  }>({ open: false, userTaskId: null, taskId: null, title: "", credits: 0 });

  useEffect(() => {
    const load = async () => {
      const [{ data: t }, { data: ut }] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("active", true)
          .eq("partner", "Lowcountry Food Bank")
          .order("pathway_credits", { ascending: false, nullsFirst: false }),
        user
          ? supabase
              .from("user_tasks")
              .select("id, task_id, verified, completed_at")
              .eq("user_id", user.id)
          : Promise.resolve({ data: [] as any }),
      ]);
      setTasks((t as Task[]) ?? []);
      setUserTasks(((ut as any) ?? []) as UserTask[]);
      setLoading(false);
    };
    load();
  }, [user]);

  const utByTask = useMemo(() => {
    const m = new Map<string, UserTask>();
    userTasks.forEach((c) => m.set(c.task_id, c));
    return m;
  }, [userTasks]);

  const myTasks = useMemo(
    () =>
      userTasks
        .map((c) => ({ claim: c, task: tasks.find((t) => t.id === c.task_id) }))
        .filter((x) => x.task) as { claim: UserTask; task: Task }[],
    [userTasks, tasks]
  );

  const availableTasks = useMemo(
    () => tasks.filter((t) => !utByTask.has(t.id)),
    [tasks, utByTask]
  );

  const handleClaim = async (task: Task) => {
    if (!user || utByTask.has(task.id)) return;
    setClaiming(task.id);
    const { data, error } = await supabase
      .from("user_tasks")
      .insert({ user_id: user.id, task_id: task.id })
      .select("id, task_id, verified, completed_at")
      .single();
    setClaiming(null);
    if (error || !data) {
      toast.error("Couldn't claim — please try again.");
      return;
    }
    setUserTasks((prev) => [...prev, data as UserTask]);
    toast.success("Task added to My Tasks");
    setClaimDialog({ open: true, title: task.title, credits: creditsFor(task) });
  };

  const handleVerify = async (method: "qr" | "photo" | "staff") => {
    if (!verifyDialog.userTaskId || !verifyDialog.taskId || !user) return;
    const nowIso = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from("user_tasks")
      .update({
        completed_at: nowIso,
        verification_method: method,
        status: "pending_verification",
      })
      .eq("id", verifyDialog.userTaskId);
    if (updateErr) {
      toast.error("Submission failed — please try again.");
      throw updateErr;
    }

    setUserTasks((prev) =>
      prev.map((c) =>
        c.id === verifyDialog.userTaskId
          ? { ...c, completed_at: nowIso }
          : c
      )
    );
    toast.success("Submitted for case manager review");
  };

  return (
    <div className="px-5 pt-4 pb-6">
      <header className="mb-5">
        <h1 className="font-display text-3xl text-foreground">Task board</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a shift, complete it, and earn Pathway Credits
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <>
          {myTasks.length > 0 && (
            <section className="mb-8">
              <h2 className="font-display text-xl text-foreground mb-3">My tasks</h2>
              <ul className="space-y-3">
                {myTasks.map(({ claim, task }) => {
                  const verified = claim.verified;
                  const awaiting = !verified && !!claim.completed_at;
                  const credits = creditsFor(task);
                  const pillClass = verified
                    ? "bg-primary/15 text-primary"
                    : awaiting
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-accent/20 text-accent-foreground";
                  const pillLabel = verified
                    ? "Completed"
                    : awaiting
                    ? "Awaiting review"
                    : "In progress";
                  return (
                    <li
                      key={claim.id}
                      className="rounded-3xl bg-card shadow-card p-5 border border-border/50"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <span
                            className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full mb-1.5 ${pillClass}`}
                          >
                            {pillLabel}
                          </span>
                          <h3 className="font-display text-lg text-foreground leading-snug">
                            {task.title}
                          </h3>
                        </div>
                        <CreditBadge amount={credits} size="sm" />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" /> {task.location}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> {durationLabel(task)}
                        </span>
                      </div>
                      {verified ? (
                        <Button disabled variant="secondary" className="w-full">
                          <CheckCircle2 className="w-4 h-4" /> Completed
                        </Button>
                      ) : awaiting ? (
                        <Button disabled variant="secondary" className="w-full">
                          Awaiting case manager review
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          onClick={() =>
                            setVerifyDialog({
                              open: true,
                              userTaskId: claim.id,
                              taskId: task.id,
                              title: task.title,
                              credits,
                            })
                          }
                        >
                          Mark as Completed
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section>
            <h2 className="font-display text-xl text-foreground mb-3">Available</h2>
            {availableTasks.length === 0 ? (
              <div className="rounded-3xl bg-secondary p-8 text-center text-secondary-foreground">
                <p className="font-display text-xl mb-1">All caught up</p>
                <p className="text-sm opacity-70">You've claimed every open task.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {availableTasks.map((task, i) => {
                  const credits = creditsFor(task);
                  return (
                    <motion.li
                      key={task.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.3) }}
                      className="rounded-3xl bg-card shadow-card p-5 border border-border/50"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            {task.partner || task.org}
                          </p>
                          <h3 className="font-display text-lg text-foreground leading-snug">
                            {task.title}
                          </h3>
                        </div>
                        <CreditBadge amount={credits} size="sm" />
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                        {task.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" /> {task.location}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> {durationLabel(task)}
                        </span>
                      </div>
                      <Button
                        onClick={() => handleClaim(task)}
                        disabled={claiming === task.id}
                        className="w-full"
                      >
                        {claiming === task.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Claim"
                        )}
                      </Button>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      <ClaimDialog
        open={claimDialog.open}
        onOpenChange={(open) => setClaimDialog((d) => ({ ...d, open }))}
        taskTitle={claimDialog.title}
        credits={claimDialog.credits}
      />

      <VerifyDialog
        open={verifyDialog.open}
        onOpenChange={(open) => setVerifyDialog((d) => ({ ...d, open }))}
        taskTitle={verifyDialog.title}
        credits={verifyDialog.credits}
        onVerified={handleVerify}
      />
    </div>
  );
};

export default Tasks;
