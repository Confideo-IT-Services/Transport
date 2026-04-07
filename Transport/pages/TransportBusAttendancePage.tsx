import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Bus } from "lucide-react";
import { SeatBoardingGrid } from "@transport/components/SeatBoardingGrid";
import { useEffect, useMemo, useState } from "react";
import { fetchBusAttendance, fetchTransportBuses, fetchTransportDrivers, type TransportBusDto, type TransportDriverDto } from "@transport/lib/transportApi";

export default function TransportBusAttendancePage() {
  const { busId } = useParams<{ busId: string }>();
  const [buses, setBuses] = useState<TransportBusDto[]>([]);
  const [drivers, setDrivers] = useState<TransportDriverDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [boardedCount, setBoardedCount] = useState(0);

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
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load bus");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bus = useMemo(() => buses.find((b) => b.id === busId), [buses, busId]);
  const driver = useMemo(() => drivers.find((d) => d.busId === busId), [drivers, busId]);

  const capacity = bus?.capacity ?? 0;
  const seats = useMemo(() => {
    const out: { seatNumber: number; boarded: boolean; childName?: string }[] = [];
    for (let i = 1; i <= capacity; i++) out.push({ seatNumber: i, boarded: false });
    return out;
  }, [capacity]);
  const boarded = boardedCount;

  useEffect(() => {
    if (!busId) return;
    let cancelled = false;
    const run = async () => {
      try {
        const a = await fetchBusAttendance(busId, "morning");
        if (!cancelled) setBoardedCount(a.boarded.length);
      } catch {
        if (!cancelled) setBoardedCount(0);
      }
    };
    run();
    const t = window.setInterval(run, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [busId]);

  if (loading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (loadError) {
    return <p className="text-destructive text-sm">{loadError}</p>;
  }

  if (!bus) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-muted-foreground mb-4">Bus not found.</p>
        <Button asChild variant="outline">
          <Link to="/transport/attendance">Back to attendance</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/transport/attendance" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          All buses
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
            <Bus className="h-6 w-6" />
          </span>
          {bus.name} — seat board
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Driver: <span className="text-foreground font-medium">{driver?.fullName ?? driver?.email ?? "—"}</span> ·{" "}
          {boarded} of {capacity} seats scanned (waiting for real RFID events).
        </p>
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
