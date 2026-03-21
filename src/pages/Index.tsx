import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

function homePathForRole(role: string | undefined): string {
  if (role === "superadmin") return "/superadmin";
  if (role === "parent") return "/parent/dashboard";
  if (role === "admin" || role === "teacher") return "/dashboard";
  return "/login";
}

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && user?.role) {
      navigate(homePathForRole(user.role), { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, [navigate, isAuthenticated, isLoading, user]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    </div>
  );
};

export default Index;
