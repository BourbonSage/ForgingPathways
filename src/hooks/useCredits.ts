import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useCredits = () => {
  const { user } = useAuth();
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setCredits(0);
      setLoading(false);
      return;
    }
    // Read the canonical balance from the user's profile. The ledger
    // table is no longer broadcast over realtime (it contained sensitive
    // transaction history), so callers explicitly refresh after RPC
    // actions (redeem_reward, award_credits_for_verified_task).
    const { data } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .maybeSingle();
    setCredits(data?.credits ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { credits, loading, refresh };
};
