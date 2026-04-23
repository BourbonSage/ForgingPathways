import { useState } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { MapPin, Clock, Check, X } from "lucide-react";
import { CreditBadge } from "@/components/CreditBadge";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  org: string;
  location: string;
  duration: string;
  credits: number;
  description: string;
  color: string;
}

const initialTasks: Task[] = [
  {
    id: "1",
    title: "Sort fresh produce",
    org: "Lowcountry Food Bank",
    location: "North Charleston",
    duration: "2 hours",
    credits: 8,
    description: "Help sort donated fruits and vegetables into family boxes. No experience needed — friendly team will guide you.",
    color: "gradient-primary",
  },
  {
    id: "2",
    title: "Pack hygiene kits",
    org: "Lowcountry Food Bank",
    location: "North Charleston",
    duration: "1 hour",
    credits: 5,
    description: "Assemble small bags of soap, toothpaste, and other essentials for distribution.",
    color: "gradient-warm",
  },
  {
    id: "3",
    title: "Greet & welcome neighbors",
    org: "Community Center",
    location: "North Charleston",
    duration: "1.5 hours",
    credits: 6,
    description: "Welcome visitors with a smile, point them to resources, and help them feel at home.",
    color: "gradient-primary",
  },
  {
    id: "4",
    title: "Share your story",
    org: "Harmony Haven",
    location: "Anywhere",
    duration: "20 min",
    credits: 3,
    description: "Your voice matters. Share what's working — and what isn't — to help us improve.",
    color: "gradient-warm",
  },
];

const Tasks = () => {
  const [tasks, setTasks] = useState(initialTasks);

  const handleAction = (action: "accept" | "skip") => {
    if (tasks.length === 0) return;
    const [current, ...rest] = tasks;
    if (action === "accept") {
      toast.success(`Saved! You'll earn ${current.credits} HC.`);
    }
    setTasks(rest);
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 100) handleAction("accept");
    else if (info.offset.x < -100) handleAction("skip");
  };

  return (
    <div className="px-5 pt-12 pb-6 safe-top">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-foreground">Task board</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Swipe right to accept, left to skip
        </p>
      </header>

      <div className="relative h-[440px] mb-6">
        <AnimatePresence>
          {tasks.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 rounded-3xl bg-secondary"
            >
              <p className="font-display text-2xl text-secondary-foreground mb-2">
                You're all caught up
              </p>
              <p className="text-sm text-secondary-foreground/70">
                New opportunities arrive every morning. Thank you for showing up.
              </p>
            </motion.div>
          ) : (
            tasks
              .slice(0, 3)
              .reverse()
              .map((task, idx, arr) => {
                const isTop = idx === arr.length - 1;
                const offset = arr.length - 1 - idx;
                return (
                  <motion.div
                    key={task.id}
                    drag={isTop ? "x" : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    onDragEnd={handleDragEnd}
                    initial={{ scale: 0.9, y: 30, opacity: 0 }}
                    animate={{
                      scale: 1 - offset * 0.04,
                      y: offset * -10,
                      opacity: 1,
                    }}
                    exit={{ x: 300, opacity: 0, transition: { duration: 0.3 } }}
                    whileDrag={{ scale: 1.02 }}
                    className="absolute inset-0 rounded-3xl bg-card shadow-card p-6 flex flex-col cursor-grab active:cursor-grabbing border border-border/50"
                    style={{ zIndex: idx }}
                  >
                    <div className={`w-full h-32 rounded-2xl ${task.color} mb-5 flex items-center justify-center`}>
                      <CreditBadge amount={task.credits} size="lg" className="bg-card/90 backdrop-blur-sm" />
                    </div>

                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      {task.org}
                    </p>
                    <h2 className="font-display text-2xl text-foreground leading-tight mb-3">
                      {task.title}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
                      {task.description}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" /> {task.location}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> {task.duration}
                      </span>
                    </div>
                  </motion.div>
                );
              })
          )}
        </AnimatePresence>
      </div>

      {tasks.length > 0 && (
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => handleAction("skip")}
            className="w-16 h-16 rounded-full bg-card shadow-card border border-border flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
            aria-label="Skip"
          >
            <X className="w-7 h-7 text-muted-foreground" strokeWidth={2.2} />
          </button>
          <button
            onClick={() => handleAction("accept")}
            className="w-20 h-20 rounded-full gradient-primary shadow-glow flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
            aria-label="Accept"
          >
            <Check className="w-9 h-9 text-primary-foreground" strokeWidth={2.4} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Tasks;
