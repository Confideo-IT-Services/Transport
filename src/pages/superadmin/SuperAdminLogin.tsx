import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const { login, user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated as superadmin
  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role === 'superadmin') {
      navigate("/superadmin", { replace: true });
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  // Show loading while checking authentication or redirecting
  if (isLoading || (isAuthenticated && user?.role === 'superadmin')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await login({ email, password, role: "superadmin" });
      toast({
        title: "Welcome, Super Admin!",
        description: "You have successfully logged in.",
      });
      // Full page navigation so app loads with token/user in localStorage; avoids any React state race
      window.location.href = "/superadmin";
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Please check your credentials and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Back Button */}
        <button
          onClick={() => navigate("/login")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to School Login
        </button>

        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-600 shadow-lg shadow-purple-600/25 mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">ConventPulse</h1>
          <p className="text-muted-foreground mt-2">Platform Administration</p>
        </div>

        {/* Login Card */}
        <div className="bg-card rounded-2xl shadow-soft border border-border p-8 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center gap-2 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20 mb-6">
            <Shield className="w-5 h-5 text-purple-600" />
            <span className="text-sm text-muted-foreground">Super Admin Access Only</span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="superadmin@conventpulse.com"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700" size="lg" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign In as Super Admin"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
