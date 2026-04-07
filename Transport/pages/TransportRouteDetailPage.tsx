import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { MapPlaceholder } from "@transport/components/MapPlaceholder";
import { RouteCheckpointTimeline } from "@transport/components/RouteCheckpointTimeline";
import { RouteStopsBuilder, type RouteStopInput } from "@transport/components/RouteStopsBuilder";
import {
  calculateTransportRouteLine,
  fetchTransportRoutesWithStops,
  patchTransportRoute,
  type TransportRouteWithStopsDto,
} from "@transport/lib/transportApi";
import type { RouteStop } from "@transport/types";

export default function TransportRouteDetailPage() {
  const { routeId } = useParams<{ routeId: string }>();
  const [routes, setRoutes] = useState<TransportRouteWithStopsDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [routeLine, setRouteLine] = useState<[number, number][] | null>(null);

  const refresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetchTransportRoutesWithStops();
      setRoutes(r);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load route");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const route = useMemo(() => routes.find((r) => r.id === routeId) ?? null, [routes, routeId]);
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
    setRouteLine(null);
    if (stops.length < 2) return;
    calculateTransportRouteLine(stops.map((s) => ({ lat: s.lat, lng: s.lng })))
      .then((d) => {
        if (!cancelled) setRouteLine(d.lineString || null);
      })
      .catch(() => {
        if (!cancelled) setRouteLine(null);
      });
    return () => {
      cancelled = true;
    };
  }, [stops]);

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editStops, setEditStops] = useState<RouteStopInput[]>([]);

  const openEdit = () => {
    if (!route) return;
    setEditName(route.name);
    setEditStops(
      (route.stops || []).map((s) => ({ name: s.name, lat: s.lat, lng: s.lng })),
    );
    setEditOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!route) return;
    if (!editName.trim()) {
      toast.error("Route name is required");
      return;
    }
    if (editStops.length === 0) {
      toast.error("Add at least one stop");
      return;
    }
    setSaving(true);
    try {
      await patchTransportRoute(route.id, {
        name: editName.trim(),
        stops: editStops.map((s) => ({ name: s.name, lat: s.lat, lng: s.lng })),
      });
      toast.success("Route updated");
      setEditOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update route");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (loadError) return <p className="text-destructive text-sm">{loadError}</p>;
  if (!route) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-muted-foreground mb-4">Route not found.</p>
        <Button asChild variant="outline">
          <Link to="/transport/routes">Back to routes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/transport/routes" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            All routes
          </Link>
        </Button>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" onClick={openEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Modify route
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <form onSubmit={submitEdit}>
              <DialogHeader>
                <DialogTitle>Edit route</DialogTitle>
                <DialogDescription>
                  Changing stops updates the DB and will reflect for any driver assigned to this route.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-4">
                <div className="grid gap-2">
                  <Label>Route name</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
                </div>
                <RouteStopsBuilder stops={editStops} onChange={setEditStops} disabled={saving} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{route.name}</h1>
        <p className="text-muted-foreground text-sm mt-1">Checkpoints + map preview for this route.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Checkpoints</CardTitle>
            <CardDescription>Order (morning). Evening uses the same list reversed.</CardDescription>
          </CardHeader>
          <CardContent>
            <RouteCheckpointTimeline stops={stops} currentStopIndex={0} busLabel="Route" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Map</CardTitle>
            <CardDescription>Road-following path (Amazon Location Routes) + stop markers.</CardDescription>
          </CardHeader>
          <CardContent>
            <MapPlaceholder stops={stops} currentStopIndex={0} routeLineString={routeLine ?? undefined} minHeight={320} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

