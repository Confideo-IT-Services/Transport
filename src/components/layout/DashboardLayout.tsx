import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "admin" | "teacher";
  userName: string;
  onLogout: () => void;
}

export function DashboardLayout({ children, role, userName, onLogout }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar role={role} onLogout={onLogout} />
      <div className="pl-64">
        <Header userName={userName} userRole={role} onLogout={onLogout} />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
