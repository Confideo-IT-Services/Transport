import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { UnifiedSidebar } from "./UnifiedSidebar";
import { UnifiedHeader } from "./UnifiedHeader";
import { useAuth } from "@/contexts/AuthContext";

interface UnifiedLayoutProps {
  children: ReactNode;
  role?: "admin" | "teacher" | "parent";
}

export function UnifiedLayout({ children, role }: UnifiedLayoutProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

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
    // Redirect to appropriate login page based on role
    const loginPath = role === "parent" ? "/parent/login" : "/login";
    return <Navigate to={loginPath} replace />;
  }

  // Verify user role matches expected role
  if (role && user?.role !== role) {
    // Redirect to appropriate dashboard
    if (user?.role === "parent") {
      return <Navigate to="/parent/dashboard" replace />;
    } else if (user?.role === "admin" || user?.role === "teacher") {
      return <Navigate to="/dashboard" replace />;
    }
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
