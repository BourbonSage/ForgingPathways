import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreditBadgeProps {
  amount: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const CreditBadge = ({ amount, size = "md", className }: CreditBadgeProps) => {
  const sizes = {
    sm: "px-2.5 py-1 text-xs gap-1",
    md: "px-3 py-1.5 text-sm gap-1.5",
    lg: "px-4 py-2 text-base gap-2",
  };
  const iconSizes = { sm: "w-3 h-3", md: "w-3.5 h-3.5", lg: "w-4 h-4" };

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold rounded-full bg-accent text-accent-foreground",
        sizes[size],
        className
      )}
    >
      <Sparkles className={cn("text-accent-glow fill-accent-glow", iconSizes[size])} />
      {amount} PC
    </span>
  );
};
