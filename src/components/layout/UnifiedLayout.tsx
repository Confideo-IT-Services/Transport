import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { UnifiedSidebar } from "./UnifiedSidebar";
import { UnifiedHeader } from "./UnifiedHeader";
import { useAuth } from "@/contexts/AuthContext";

interface UnifiedLayoutProps {
  children: ReactNode;
}

export function UnifiedLayout({ children }: UnifiedLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // Wait for authentication check to complete before redirecting
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

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
