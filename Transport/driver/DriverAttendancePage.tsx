import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bus, RefreshCw, CheckCircle2 } from "lucide-react";
import { getDriverJwt, getDriverSession, resolveDriverBusId } from "@transport/driverSession";
import { SeatBoardingGrid } from "@transport/components/SeatBoardingGrid";
import { fetchDriverAssignedChildren, type DriverAssignedChildDto } from "@transport/lib/transportApi";
import { toast } from "sonner";

export default function DriverAttendancePage() {
  const session = getDriverSession();
  const busId = session ? resolveDriverBusId(session) : undefined;
  const busLabel = session?.busName || (busId ? `Bus (${busId.slice(0, 8)}…)` : "");
  const capacity = session?.busCapacity ?? 30;
  const jwt = session?.token ? getDriverJwt() : null;

  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const [tripType, setTripType] = useState<"morning" | "evening">("morning");
  const [children, setChildren] = useState<DriverAssignedChildDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jwt) return;
    let cancelled = false;
    setLoading(true);
    fetchDriverAssignedChildren(jwt, tripType)
      .then((out) => {
        if (cancelled) return;
        setChildren(out.children || []);
      })
      .catch((e) => {
        if (cancelled) return;
        setChildren([]);
        toast.error(e instanceof Error ? e.message : "Failed to load assigned children");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const t = window.setInterval(() => {
      fetchDriverAssignedChildren(jwt, tripType)
        .then((out) => {
          if (!cancelled) setChildren(out.children || []);
        })
        .catch(() => {
          // keep last known view
        });
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [jwt, tripType, tick]);

  const seats = useMemo(() => {
    if (!busId) return [];
    const boardedCount = children.filter((c) => c.onboarded).length;
    const out: { seatNumber: number; boarded: boolean; childName?: string }[] = [];
    for (let i = 1; i <= capacity; i++) {
      out.push({ seatNumber: i, boarded: i <= boardedCount });
    }
    return out;
  }, [busId, capacity, children]);

  const boarded = seats.filter((s) => s.boarded).length;

  if (!busId) {
    return <p className="text-muted-foreground">No bus assigned.</p>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tripType === "morning" ? "default" : "outline"}
          onClick={() => setTripType("morning")}
        >
          Morning
        </Button>
        <Button
          type="button"
          variant={tripType === "evening" ? "default" : "outline"}
          onClick={() => setTripType("evening")}
        >
          Evening
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600/10 text-amber-800">
              <Bus className="h-6 w-6" />
            </span>
            Attendance
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {busLabel} · {boarded} onboard of {capacity} seats{" "}
            {jwt ? "(live RFID scans)" : "(demo / offline)"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seat layout</CardTitle>
          <CardDescription>Green = RFID onboarded · Red = vacant / not yet scanned</CardDescription>
        </CardHeader>
        <CardContent>
          <SeatBoardingGrid seats={seats} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assigned children</CardTitle>
          <CardDescription>
            Shows each child assigned to this bus. Verified = RFID scanned onboarded for this {tripType} trip today.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {children.length === 0 ? (
            <p className="text-sm text-muted-foreground">No children assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {children.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.childName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Parent: {c.parentEmail}
                      {c.address ? ` · ${c.address}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {c.onboarded ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        Verified
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not scanned</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
