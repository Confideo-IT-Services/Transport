import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { UnifiedSidebar } from "./UnifiedSidebar";
import { UnifiedHeader } from "./UnifiedHeader";
import { useAuth } from "@/contexts/AuthContext";

interface UnifiedLayoutProps {
  children: ReactNode;
}

export function UnifiedLayout({ children }: UnifiedLayoutProps) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <UnifiedSidebar />
      <div className="pl-64">
        <UnifiedHeader />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
