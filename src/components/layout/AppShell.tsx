import { Outlet, Link } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { ShieldCheck, LogOut } from "lucide-react";
import { Navigate } from "react-router-dom";

export const AppShell = () => {
  const { user, loading, isPending, isAdmin, signOut } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (isPending) return <Navigate to="/pending" replace />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-5 pt-5 pb-2 safe-top max-w-md mx-auto w-full flex items-center justify-between">
        <Link to="/home" className="flex items-center">
          <Logo maxWidth={130} />
        </Link>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <Link to="/admin" className="p-2 rounded-lg hover:bg-muted text-primary" title="Admin">
              <ShieldCheck className="w-5 h-5" />
            </Link>
          )}
          <button onClick={signOut} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" title="Sign out">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>
      <main className="flex-1 pb-24 max-w-md mx-auto w-full">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};
