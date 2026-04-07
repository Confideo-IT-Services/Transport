import { Link, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bus, MapPin, Navigation } from "lucide-react";
import { MapPlaceholder } from "@transport/components/MapPlaceholder";
import { RouteCheckpointTimeline } from "@transport/components/RouteCheckpointTimeline";
import { useEffect, useMemo, useState } from "react";
import {
  calculateTransportRouteLine,
  fetchTransportBuses,
  fetchTransportDrivers,
  fetchTrackerPosition,
  fetchTransportRoutesWithStops,
  type TransportBusDto,
  type TransportDriverDto,
  type TransportRouteWithStopsDto,
} from "@transport/lib/transportApi";
import type { RouteStop } from "@transport/types";

export default function TransportBusDetailPage() {
  const { busId } = useParams<{ busId: string }>();
  const [buses, setBuses] = useState<TransportBusDto[]>([]);
  const [drivers, setDrivers] = useState<TransportDriverDto[]>([]);
  const [routes, setRoutes] = useState<TransportRouteWithStopsDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [livePos, setLivePos] = useState<{ lng: number; lat: number; sampleTime?: string | null } | null>(null);
  const [routeLine, setRouteLine] = useState<[number, number][]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([fetchTransportBuses(), fetchTransportDrivers(), fetchTransportRoutesWithStops()])
      .then(([b, d, r]) => {
        if (cancelled) return;
        setBuses(b);
        setDrivers(d);
        setRoutes(r);
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

  useEffect(() => {
    if (!busId) return;
    let cancelled = false;
    setLivePos(null);

    const tick = async () => {
      try {
        const p = await fetchTrackerPosition(busId);
        if (cancelled) return;
        setLivePos({ lng: p.lng, lat: p.lat, sampleTime: p.sampleTime });
      } catch {
        // No position yet / tracker not configured — keep silent (UI still works with route line).
        if (!cancelled) setLivePos(null);
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [busId]);

  const bus = useMemo(() => buses.find((b) => b.id === busId), [buses, busId]);
  const driver = useMemo(() => drivers.find((d) => d.busId === busId), [drivers, busId]);
  const route = useMemo(() => {
    const routeId = driver?.morningRouteId || driver?.eveningRouteId || null;
    if (!routeId) return null;
    return routes.find((r) => r.id === routeId) ?? null;
  }, [routes, driver]);

  const stops: RouteStop[] = useMemo(() => {
    const s = route?.stops || [];
    return s.map((it, i) => ({
      id: it.id,
      name: it.name,
      lat: it.lat,
      lng: it.lng,
      order: it.sequenceOrder ?? i + 1,
    }));
  }, [route]);

  useEffect(() => {
    let cancelled = false;
    setRouteLine([]);
    if (!stops || stops.length < 2) return;

    const points = stops.map((s) => ({ lat: s.lat, lng: s.lng }));
    calculateTransportRouteLine(points)
      .then((out) => {
        if (cancelled) return;
        setRouteLine(out.lineString || []);
      })
      .catch(() => {
        if (!cancelled) setRouteLine([]);
      });

    return () => {
      cancelled = true;
    };
  }, [stops]);

  const currentStopIndex = 0;
  const current = stops[currentStopIndex];
  const pickup = stops.length ? stops[0] : null;
  const drop = stops.length ? stops[stops.length - 1] : null;

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
          <Link to="/transport/buses">Back to buses</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/transport/buses" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            All buses
          </Link>
        </Button>
        <Badge variant="outline" className="font-mono">
          {bus.registrationNo ?? ""}
        </Badge>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700">
            <Bus className="h-6 w-6" />
          </span>
          {bus.name}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Route progress shows checkpoints already covered vs still upcoming. Map sits below for when location service is
          wired in.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Driver</CardTitle>
            <CardDescription>Assigned to this bus and route</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-semibold text-lg">{driver?.fullName ?? driver?.email ?? "Unassigned"}</p>
            <p className="text-muted-foreground">{driver?.phone ?? "—"}</p>
            <p className="font-mono text-xs pt-2">License {driver?.licenseNo ?? "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Route summary</CardTitle>
            <CardDescription>{route?.name ?? "Unknown route"}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex gap-2 items-start">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <span className="text-muted-foreground">Pickup · </span>
                {pickup?.name ?? "—"}
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <Navigation className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <span className="text-muted-foreground">Drop · </span>
                {drop?.name ?? "—"}
              </div>
            </div>
            {current && (
              <p className="text-xs pt-2 text-muted-foreground">
                Latest checkpoint focus: <span className="text-foreground font-medium">{current.name}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">View route &amp; live position</CardTitle>
          <CardDescription>
            Metro-style progress: stops already served, the bus position, and stops still to come.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <RouteCheckpointTimeline
            stops={stops}
            currentStopIndex={currentStopIndex}
            busLabel={bus.name}
          />

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Map</p>
            <MapPlaceholder
              stops={stops}
              currentStopIndex={currentStopIndex}
              routeLineString={routeLine.length >= 2 ? routeLine : undefined}
              livePosition={
                livePos
                  ? { lng: livePos.lng, lat: livePos.lat, label: livePos.sampleTime ? `Live · ${livePos.sampleTime}` : "Live" }
                  : null
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
