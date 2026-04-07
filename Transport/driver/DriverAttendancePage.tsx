import { useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bus, RefreshCw } from "lucide-react";
import { getDriverSession, resolveDriverBusId } from "@transport/driverSession";
import { SeatBoardingGrid } from "@transport/components/SeatBoardingGrid";

export default function DriverAttendancePage() {
  const session = getDriverSession();
  const busId = session ? resolveDriverBusId(session) : undefined;
  const busLabel = session?.busName || (busId ? `Bus (${busId.slice(0, 8)}…)` : "");
  const capacity = session?.busCapacity ?? 30;
  const isRds = Boolean(session?.token);

  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const seats = useMemo(() => {
    if (!busId) return [];
    const boardedCount = isRds ? 0 : Math.max(1, Math.floor(capacity * 0.65));
    const out: { seatNumber: number; boarded: boolean; childName?: string }[] = [];
    for (let i = 1; i <= capacity; i++) {
      out.push({ seatNumber: i, boarded: i <= boardedCount });
    }
    return out;
  }, [busId, capacity, isRds, tick]);

  const boarded = seats.filter((s) => s.boarded).length;

  if (!busId) {
    return <p className="text-muted-foreground">No bus assigned.</p>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
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
            {isRds ? "(waiting for real RFID scans)" : "(RFID demo pattern)"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
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
    </div>
  );
}
