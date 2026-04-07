import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { MapPin, Plus } from "lucide-react";
import {
  calculateTransportRouteLine,
  createTransportRoute,
  fetchTransportBuses,
  fetchTransportDrivers,
  fetchTransportRoutes,
  type TransportBusDto,
  type TransportDriverDto,
  type TransportRouteDto,
} from "@transport/lib/transportApi";
import { RouteStopsBuilder, type RouteStopInput } from "@transport/components/RouteStopsBuilder";
import { MapPlaceholder } from "@transport/components/MapPlaceholder";

type RouteUsage = {
  drivers: TransportDriverDto[];
  buses: TransportBusDto[];
};

export default function TransportRoutesPage() {
  const [routes, setRoutes] = useState<TransportRouteDto[]>([]);
  const [buses, setBuses] = useState<TransportBusDto[]>([]);
  const [drivers, setDrivers] = useState<TransportDriverDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [r, b, d] = await Promise.all([fetchTransportRoutes(), fetchTransportBuses(), fetchTransportDrivers()]);
      setRoutes(r);
      setBuses(b);
      setDrivers(d);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load routes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const busById = useMemo(() => {
    const m = new Map<string, TransportBusDto>();
    for (const b of buses) m.set(b.id, b);
    return m;
  }, [buses]);

  const usageByRouteId = useMemo(() => {
    const m = new Map<string, RouteUsage>();
    const ensure = (routeId: string) => {
      const existing = m.get(routeId);
      if (existing) return existing;
      const next: RouteUsage = { drivers: [], buses: [] };
      m.set(routeId, next);
      return next;
    };

    for (const d of drivers) {
      const ids = Array.from(new Set([d.morningRouteId, d.eveningRouteId].filter(Boolean))) as string[];
      for (const routeId of ids) {
        const u = ensure(routeId);
        if (!u.drivers.some((x) => x.id === d.id)) {
          u.drivers.push(d);
        }
        if (d.busId) {
          const bus = busById.get(d.busId);
          if (bus && !u.buses.some((x) => x.id === bus.id)) {
            u.buses.push(bus);
          }
        }
      }
    }
    return m;
  }, [drivers, busById]);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [routeStops, setRouteStops] = useState<RouteStopInput[]>([]);
  const [routeLine, setRouteLine] = useState<[number, number][] | null>(null);
  const [routeMeta, setRouteMeta] = useState<{ distanceMeters: number | null; durationSeconds: number | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRouteLine(null);
    setRouteMeta(null);
    if (routeStops.length < 2) return;
    const stops = routeStops.map((s) => ({ lat: s.lat, lng: s.lng }));
    calculateTransportRouteLine(stops)
      .then((d) => {
        if (cancelled) return;
        setRouteLine(d.lineString || null);
        setRouteMeta({ distanceMeters: d.distanceMeters ?? null, durationSeconds: d.durationSeconds ?? null });
      })
      .catch(() => {
        if (!cancelled) {
          setRouteLine(null);
          setRouteMeta(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [routeStops]);

  const submitRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeName.trim()) {
      toast.error("Route name is required");
      return;
    }
    if (routeStops.length === 0) {
      toast.error("Add at least one stop (search and select a place)");
      return;
    }
    setSaving(true);
    try {
      await createTransportRoute({
        name: routeName.trim(),
        stops: routeStops.map((s) => ({ name: s.name, lat: s.lat, lng: s.lng })),
      });
      toast.success("Route created");
      setRouteName("");
      setRouteStops([]);
      setOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create route");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Routes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All routes, their assigned buses (via driver assignment), and routes not yet assigned to any driver.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) {
              setRouteName("");
              setRouteStops([]);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" />
              Add route
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <form onSubmit={submitRoute}>
              <DialogHeader>
                <DialogTitle>New route</DialogTitle>
                <DialogDescription>
                  Search places like Uber/Rapido, then add stops in morning order (1 → N). Evening uses the same stops in
                  reverse.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-4">
                <div className="grid gap-2">
                  <Label>Route name</Label>
                  <Input
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    placeholder="e.g. West zone — morning"
                    required
                  />
                </div>
                <RouteStopsBuilder stops={routeStops} onChange={setRouteStops} disabled={saving} />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Map preview</p>
                  <MapPlaceholder
                    stops={routeStops.map((s, i) => ({ id: String(i), name: s.name, lat: s.lat, lng: s.lng, order: i + 1 }))}
                    currentStopIndex={0}
                    routeLineString={routeLine ?? undefined}
                    minHeight={260}
                  />
                  {routeMeta ? (
                    <p className="text-xs text-muted-foreground">
                      Estimated:{" "}
                      {routeMeta.distanceMeters != null ? `${(routeMeta.distanceMeters / 1000).toFixed(1)} km` : "—"} ·{" "}
                      {routeMeta.durationSeconds != null ? `${Math.round(routeMeta.durationSeconds / 60)} min` : "—"}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Add at least 2 stops to see the road route line.</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save route"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loadError && (
        <p className="text-sm text-destructive">
          {loadError}. Ensure backend is running and `2026-04-08-transport_fleet.sql` is applied.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-emerald-600/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-700" />
              Total routes
            </CardTitle>
            <CardDescription>All routes in PostgreSQL</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{routes.length}</CardContent>
        </Card>
        <Card className="border-emerald-600/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Assigned to drivers</CardTitle>
            <CardDescription>Referenced by at least one driver</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {routes.filter((r) => (usageByRouteId.get(r.id)?.drivers.length ?? 0) > 0).length}
          </CardContent>
        </Card>
        <Card className="border-emerald-600/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Unassigned</CardTitle>
            <CardDescription>Not referenced by any driver yet</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {routes.filter((r) => (usageByRouteId.get(r.id)?.drivers.length ?? 0) === 0).length}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Route list</CardTitle>
          <CardDescription>
            “Bus assigned” is derived from drivers: if a driver uses this route and is assigned to a bus, that bus is
            shown here.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground py-6">Loading…</p>
          ) : routes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">No routes yet. Add one.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Buses</TableHead>
                  <TableHead>Drivers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((r) => {
                  const u = usageByRouteId.get(r.id);
                  const driverCount = u?.drivers.length ?? 0;
                  const busCount = u?.buses.length ?? 0;
                  const busesText = busCount
                    ? u!.buses.map((b) => b.name).join(", ")
                    : "—";
                  const driversText = driverCount
                    ? u!.drivers
                        .map((d) => d.fullName ?? d.email)
                        .filter(Boolean)
                        .join(", ")
                    : "—";

                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <Link className="hover:underline" to={`/transport/routes/${r.id}`}>
                          {r.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {driverCount === 0 ? (
                          <Badge variant="outline" className="border-amber-600/50 text-amber-800 dark:text-amber-300">
                            Unassigned
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-emerald-600/15 text-emerald-800 dark:text-emerald-300">
                            Assigned
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{busesText}</TableCell>
                      <TableCell className="text-muted-foreground">{driversText}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

