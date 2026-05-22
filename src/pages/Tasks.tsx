import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock, Check, Loader2 } from "lucide-react";
import { CreditBadge } from "@/components/CreditBadge";
import { ClaimDialog } from "@/components/ClaimDialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  description: string;
  credits: number;
  location: string;
  duration: string;
  org: string;
}

const Tasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; title: string; credits: number }>({
    open: false,
    title: "",
    credits: 0,
  });

  useEffect(() => {
    const load = async () => {
      const [{ data: t }, { data: c }] = await Promise.all([
        supabase.from("tasks").select("*").eq("active", true).order("credits", { ascending: false }),
        user
          ? supabase.from("task_claims").select("task_id").eq("user_id", user.id)
          : Promise.resolve({ data: [] as any }),
      ]);
      setTasks((t as Task[]) ?? []);
      setClaimedIds(new Set(((c as any) ?? []).map((r: any) => r.task_id)));
      setLoading(false);
    };
    load();
  }, [user]);

  const handleClaim = async (task: Task) => {
    if (!user || claimedIds.has(task.id)) return;
    setClaiming(task.id);
    const { error } = await supabase
      .from("task_claims")
      .insert({ user_id: user.id, task_id: task.id });
    setClaiming(null);
    if (error) {
      toast.error("Couldn't claim — please try again.");
      return;
    }
    setClaimedIds((s) => new Set(s).add(task.id));
    toast.success(`Claimed! +${task.credits} Forge Credits`);
    setDialog({ open: true, title: task.title, credits: task.credits });
  };

  return (
    <div className="px-5 pt-4 pb-6">
      <header className="mb-5">
        <h1 className="font-display text-3xl text-foreground">Task board</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a shift at the Lowcountry Food Bank and earn Forge Credits
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-3xl bg-secondary p-8 text-center text-secondary-foreground">
          <p className="font-display text-xl mb-1">No tasks yet</p>
          <p className="text-sm opacity-70">Check back soon.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task, i) => {
            const claimed = claimedIds.has(task.id);
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
                      {task.org}
                    </p>
                    <h2 className="font-display text-lg text-foreground leading-snug">{task.title}</h2>
                  </div>
                  <CreditBadge amount={task.credits} size="sm" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  {task.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> {task.location}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> {task.duration}
                  </span>
                </div>
                <Button
                  onClick={() => handleClaim(task)}
                  disabled={claimed || claiming === task.id}
                  className="w-full"
                  variant={claimed ? "secondary" : "default"}
                >
                  {claiming === task.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : claimed ? (
                    <>
                      <Check className="w-4 h-4" /> Claimed
                    </>
                  ) : (
                    "Claim"
                  )}
                </Button>
              </motion.li>
            );
          })}
        </ul>
      )}

      <ClaimDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        taskTitle={dialog.title}
        credits={dialog.credits}
      />
    </div>
  );
};

export default Tasks;
