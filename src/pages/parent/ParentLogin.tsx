import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function ParentLogin() {
  const navigate = useNavigate();
  const { login, user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) return;
    if (user.role === "parent") {
      navigate("/parent/dashboard", { replace: true });
    } else if (user.role === "superadmin") {
      navigate("/superadmin", { replace: true });
    } else if (user.role === "admin" || user.role === "teacher") {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone || phone.replace(/\D/g, '').length !== 10) {
      toast({
        title: "Invalid Phone",
        description: "Please enter a valid 10-digit phone number",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await login({ phone, role: "parent" });
      
      toast({
        title: "Welcome!",
        description: "You have successfully logged in.",
      });
      navigate("/parent/dashboard");
    } catch (error) {
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Phone number not found. Please contact the school.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || (isAuthenticated && user?.role === "parent")) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-lg mb-4">
            <GraduationCap className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">ConventPulse</h1>
          <p className="text-muted-foreground mt-2">Parent Portal</p>
        </div>

        <div className="bg-card rounded-2xl shadow-soft border border-border p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-foreground">Parent Login</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your phone number to access your child's information
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="9876543210"
                  className="pl-10"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the phone number registered with the school
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              size="lg" 
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Admin/Teacher Login →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
