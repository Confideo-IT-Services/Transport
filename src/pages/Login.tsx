import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await login(email, password);
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      navigate("/dashboard");
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Please check your credentials and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-lg shadow-primary/25 mb-4">
            <GraduationCap className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">AllPulse</h1>
          <p className="text-muted-foreground mt-2">School Management System</p>
        </div>

        {/* Login Card */}
        <div className="bg-card rounded-2xl shadow-soft border border-border p-8 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-foreground">Welcome Back</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to access your dashboard
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email / Mobile</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="text"
                  placeholder="admin@school.edu or teacher@school.edu"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-border" />
                <span className="text-muted-foreground">Remember me</span>
              </label>
              <a href="#" className="text-primary hover:underline">Forgot password?</a>
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {/* Demo Accounts */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-center text-muted-foreground mb-3">Demo Accounts</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail("admin@school.edu");
                  setPassword("demo123");
                }}
                className="text-xs p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                <span className="font-medium text-foreground">School Admin</span>
                <p className="text-muted-foreground">admin@school.edu</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("teacher@school.edu");
                  setPassword("demo123");
                }}
                className="text-xs p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              >
                <span className="font-medium text-foreground">Class Teacher</span>
                <p className="text-muted-foreground">teacher@school.edu</p>
              </button>
            </div>
          </div>

          {/* Super Admin Link */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate("/superadmin/login")}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Super Admin Login →
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          © 2024 AllPulse. All rights reserved.
        </p>
      </div>
    </div>
  );
}
