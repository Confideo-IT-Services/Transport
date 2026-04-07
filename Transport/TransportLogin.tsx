import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Bus, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  validateTransportCredentials,
  setTransportSession,
  isTransportAuthenticated,
  TRANSPORT_DEMO_EMAIL,
  TRANSPORT_DEMO_PASSWORD,
} from "@transport/transportSession";

export default function TransportLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isTransportAuthenticated()) {
      navigate("/transport", { replace: true });
    }
  }, [navigate]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (!validateTransportCredentials(email, password)) {
        toast({
          title: "Login failed",
          description: "Invalid email or password.",
          variant: "destructive",
        });
        return;
      }
      setTransportSession();
      toast({ title: "Welcome", description: "Transport admin console ready." });
      window.location.href = "/transport";
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to school login
        </Link>

        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 mb-4">
            <Bus className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Transport admin</h1>
          <p className="text-muted-foreground text-sm mt-1">ConventPulse — school bus operations</p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transport-email">Email</Label>
              <Input
                id="transport-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={TRANSPORT_DEMO_EMAIL}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transport-password">Password</Label>
              <div className="relative">
                <Input
                  id="transport-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground p-1"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            Demo:{" "}
            <code className="rounded bg-muted px-1 py-0.5">{TRANSPORT_DEMO_EMAIL}</code> /{" "}
            <code className="rounded bg-muted px-1 py-0.5">{TRANSPORT_DEMO_PASSWORD}</code>
          </p>
          <p className="text-xs text-center mt-3">
            <Link to="/transport/driver/login" className="text-primary underline hover:text-primary/90">
              Driver login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
