import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Bus, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  resolveDriverLogin,
  setDriverSessionPayload,
  isDriverAuthenticated,
  DRIVER_DEMO_ACCOUNTS,
} from "@transport/driverSession";
import { getTransportApiBase } from "@transport/lib/transportApi";
import type { DriverLoginResponse } from "@transport/lib/transportApi";

export default function DriverLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isDriverAuthenticated()) {
      navigate("/transport/driver", { replace: true });
    }
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const applyDemo = () => {
        const demoId = resolveDriverLogin(email, password);
        if (!demoId) {
          toast({
            title: "Login failed",
            description: "Invalid email or password.",
            variant: "destructive",
          });
          return;
        }
        const hit = DRIVER_DEMO_ACCOUNTS.find((a) => a.driverId === demoId);
        setDriverSessionPayload({
          driverId: demoId,
          mockDriverId: demoId,
          email: hit?.email,
          fullName: hit?.label.split("(")[0].trim(),
          busId: hit?.busId,
          routeId: hit?.routeId,
        });
        toast({
          title: "Welcome (demo)",
          description: "Using offline demo — API unreachable or server error.",
        });
        window.location.href = "/transport/driver";
      };

      let res: Response;
      try {
        res = await fetch(`${getTransportApiBase()}/transport/driver/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
      } catch {
        applyDemo();
        return;
      }

      const data = (await res.json().catch(() => ({}))) as DriverLoginResponse & { error?: string };

      if (res.ok && data.token && data.driver) {
        const d = data.driver;
        setDriverSessionPayload({
          driverId: d.id,
          token: data.token,
          email: d.email,
          fullName: d.fullName ?? undefined,
          busId: d.busId ?? undefined,
          busName: d.busName ?? undefined,
          busRegistrationNo: d.busRegistrationNo ?? undefined,
          busCapacity: d.busCapacity ?? undefined,
          morningRouteId: d.morningRouteId ?? undefined,
          eveningRouteId: d.eveningRouteId ?? undefined,
          routeId: d.morningRouteId ?? undefined,
        });
        toast({ title: "Welcome", description: "Signed in with your account." });
        window.location.href = "/transport/driver";
        return;
      }

      if (res.status === 401 || res.status === 400) {
        toast({
          title: "Login failed",
          description: data.error || "Invalid email or password.",
          variant: "destructive",
        });
        return;
      }

      applyDemo();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="flex flex-wrap gap-3 mb-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            School login
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link
            to="/transport/login"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Transport admin
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-600/15 text-amber-700 dark:text-amber-400 mb-4">
            <Bus className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Driver</h1>
          <p className="text-muted-foreground text-sm mt-1">Route, attendance, start / end tour</p>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="driver-email">Email</Label>
              <Input
                id="driver-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ramesh.driver@conventpulse.edu"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver-password">Password</Label>
              <div className="relative">
                <Input
                  id="driver-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  required
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
            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <div className="mt-4 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground/80">
              RDS drivers: use the email and password created in Transport → Drivers. If the API is down, demo accounts
              still work (password for all: Driver@123).
            </p>
            <ul className="list-disc list-inside space-y-0.5">
              {DRIVER_DEMO_ACCOUNTS.map((a) => (
                <li key={a.driverId}>
                  <code className="rounded bg-muted px-1">{a.email}</code> — {a.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
