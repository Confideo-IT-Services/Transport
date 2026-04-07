import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bus, ChevronRight, ScanLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchTransportBuses, fetchTransportDrivers, type TransportBusDto, type TransportDriverDto } from "@transport/lib/transportApi";
import { fetchBusAttendance } from "@transport/lib/transportApi";

export default function TransportAttendancePage() {
  const [buses, setBuses] = useState<TransportBusDto[]>([]);
  const [drivers, setDrivers] = useState<TransportDriverDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [boardedByBusId, setBoardedByBusId] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([fetchTransportBuses(), fetchTransportDrivers()])
      .then(([b, d]) => {
        if (cancelled) return;
        setBuses(b);
        setDrivers(d);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load buses");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll boarded counts (RFID) every 5s
  useEffect(() => {
    if (buses.length === 0) return;
    let cancelled = false;
    const run = async () => {
      try {
        const entries = await Promise.all(
          buses.map(async (b) => {
            try {
              const a = await fetchBusAttendance(b.id, "morning");
              return [b.id, a.boarded.length] as const;
            } catch {
              return [b.id, 0] as const;
            }
          }),
        );
        if (cancelled) return;
        const m: Record<string, number> = {};
        for (const [id, c] of entries) m[id] = c;
        setBoardedByBusId(m);
      } catch {
        // ignore
      }
    };
    run();
    const t = window.setInterval(run, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [buses]);

  const driverByBusId = useMemo(() => {
    const m = new Map<string, TransportDriverDto>();
    for (const d of drivers) {
      if (d.busId) m.set(d.busId, d);
    }
    return m;
  }, [drivers]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <ScanLine className="h-7 w-7 text-emerald-600" />
          Attendance (RFID)
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Per bus: driver and capacity. RFID scan events will populate counts when integrated.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loadError && (
          <p className="text-sm text-destructive">
            {loadError}. Ensure backend is running and `2026-04-08-transport_fleet.sql` is applied.
          </p>
        )}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : buses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No buses yet.</p>
        ) : (
          buses.map((b) => {
            const driver = driverByBusId.get(b.id);
            const boarded = boardedByBusId[b.id] ?? 0;
            const cap = b.capacity ?? 0;
            const empty = Math.max(0, cap - boarded);

          return (
            <Card key={b.id} className="border-emerald-600/10">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-emerald-600/10 p-2 text-emerald-700 dark:text-emerald-400">
                      <Bus className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{b.name}</CardTitle>
                      <CardDescription>{driver?.fullName ?? driver?.email ?? "Driver"}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="secondary" className="bg-emerald-600/15 text-emerald-800 dark:text-emerald-300">
                    {boarded} onboard
                  </Badge>
                  <Badge variant="outline" className="border-red-200 text-red-700 dark:text-red-400">
                    {empty} not scanned
                  </Badge>
                  <span className="text-muted-foreground">of {cap} seats</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Waiting for real RFID scan events (no demo counts on DB buses).
                </p>
                <Button variant="secondary" className="w-full justify-between" asChild>
                  <Link to={`/transport/attendance/${b.id}`}>
                    Seat view
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
          })
        )}
      </div>
    </div>
  );
}
