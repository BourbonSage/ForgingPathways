import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const startOfWeek = (d: Date) => {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // Mon-start
  x.setDate(x.getDate() - day);
  return x;
};

const computeDayStreak = (dates: Date[]) => {
  if (dates.length === 0) return 0;
  const days = new Set(dates.map((d) => startOfDay(d).toISOString().slice(0, 10)));
  let streak = 0;
  const cursor = startOfDay(new Date());
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(cursor.toISOString().slice(0, 10))) return 0;
  }
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

export const useProgressStats = () => {
  const { user } = useAuth();
  const [completedThisWeek, setCompletedThisWeek] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_tasks")
      .select("completed_at, verified")
      .eq("user_id", user.id)
      .eq("verified", true)
      .order("completed_at", { ascending: false })
      .then(({ data }) => {
        const dates = (data ?? [])
          .map((r: any) => (r.completed_at ? new Date(r.completed_at) : null))
          .filter((d): d is Date => !!d);
        const ws = startOfWeek(new Date());
        setCompletedThisWeek(dates.filter((d) => d >= ws).length);
        setStreak(computeDayStreak(dates));
        setLoading(false);
      });
  }, [user]);

  return { completedThisWeek, streak, loading };
};
