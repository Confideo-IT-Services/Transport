import { Navigate } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Chatbot } from "@/components/chat/Chatbot";

const LOADING_UI = (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

export default function SuperAdminChatbot() {
  const { user, isLoading, logout } = useAuth();

  if (!isLoading && user?.role !== "superadmin") {
    return <Navigate to="/superadmin/login" replace />;
  }

  if (isLoading) return LOADING_UI;

  return (
    <DashboardLayout
      role="superadmin"
      userName={user?.name || "Platform Admin"}
      onLogout={logout}
    >
      <Chatbot title="School Chatbot (Platform Admin Scope)" />
    </DashboardLayout>
  );
}

