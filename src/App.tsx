import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Welcome from "./pages/Welcome";
import Pending from "./pages/Pending";
import Home from "./pages/Home";
import Tasks from "./pages/Tasks";
import Progress from "./pages/Progress";
import Rewards from "./pages/Rewards";
import Admin from "./pages/Admin";
import CaseManager from "./pages/CaseManager";
import CaseManagerQueue from "./pages/CaseManagerQueue";
import ParticipantDetail from "./pages/ParticipantDetail";
import OrgWorkload from "./pages/OrgWorkload";
import CaseManagerClients from "./pages/CaseManagerClients";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/pending" element={<Pending />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/case-manager" element={<CaseManager />} />
              <Route path="/case-manager/queue" element={<CaseManagerQueue />} />
              <Route path="/case-manager/participant/:id" element={<ParticipantDetail />} />
              <Route path="/org/workload" element={<OrgWorkload />} />
              <Route path="/org/case-manager/:managerId" element={<CaseManagerClients />} />
              <Route element={<AppShell />}>
                <Route path="/home" element={<Home />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/progress" element={<Progress />} />
                <Route path="/rewards" element={<Rewards />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
