import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  requireRole?: AppRole;
}

export const ProtectedRoute = ({ requireRole }: ProtectedRouteProps) => {
  const { user, loading, roles, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  if (requireRole && !isAdmin && !roles.includes(requireRole)) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
};
