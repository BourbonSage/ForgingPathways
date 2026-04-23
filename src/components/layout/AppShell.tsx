import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

export const AppShell = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 pb-24 max-w-md mx-auto w-full">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};
