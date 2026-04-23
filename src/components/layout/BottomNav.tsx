import { NavLink } from "react-router-dom";
import { Home, Sparkles, TrendingUp, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/tasks", label: "Tasks", icon: Sparkles },
  { to: "/progress", label: "Progress", icon: TrendingUp },
  { to: "/rewards", label: "Rewards", icon: Gift },
];

export const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg safe-bottom">
      <div className="max-w-md mx-auto px-2 pt-2">
        <ul className="flex items-stretch justify-around">
          {items.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-2xl transition-all duration-300",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={cn(
                        "flex items-center justify-center w-12 h-8 rounded-full transition-all duration-300",
                        isActive && "bg-primary-soft"
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-5 h-5 transition-transform",
                          isActive && "scale-110"
                        )}
                        strokeWidth={isActive ? 2.4 : 1.8}
                      />
                    </div>
                    <span className="text-[11px] font-medium">{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};
