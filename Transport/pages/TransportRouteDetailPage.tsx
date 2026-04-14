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
import { ArrowLeft, CheckCircle2, Circle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { MapPlaceholder } from "@transport/components/MapPlaceholder";
import { RouteCheckpointTimeline } from "@transport/components/RouteCheckpointTimeline";
import { RouteStopsBuilder, type RouteStopInput } from "@transport/components/RouteStopsBuilder";
import {
  calculateTransportRouteLine,
  deleteTransportRoute,
  fetchRouteStopChildren,
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
  const [stopChildren, setStopChildren] = useState<
    Array<{
      id: string;
      name: string;
      sequenceOrder: number;
      lat: number;
      lng: number;
      children: Array<{
        id: string;
        childName: string;
        rfidTagUid: string | null;
        onboarded: boolean;
        lastScannedAt: string | null;
      }>;
    }>
  >([]);
  const [stopChildrenError, setStopChildrenError] = useState<string | null>(null);

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
    if (!route?.id) return;
    let cancelled = false;
    setStopChildrenError(null);

    const run = async () => {
      try {
        const data = await fetchRouteStopChildren(route.id, { tripType: "morning" });
        if (!cancelled) setStopChildren(data.stops || []);
      } catch (e) {
        if (!cancelled) setStopChildrenError(e instanceof Error ? e.message : "Failed to load assigned children");
      }
    };

    run();
    const t = window.setInterval(run, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [route?.id]);

  useEffect(() => {
    let cancelled = false;
    setRouteLine(null);
    const clean = (stops || []).filter(
      (s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)),
    );
    if (clean.length < 2) return;
    calculateTransportRouteLine(clean.map((s) => ({ lat: Number(s.lat), lng: Number(s.lng) })))
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

  const onDelete = async () => {
    if (!route) return;
    if (!confirm(`Delete route "${route.name}"?\n\nThis is allowed only if the route is unassigned.`)) return;
    try {
      await deleteTransportRoute(route.id);
      toast.success("Route deleted");
      window.location.href = "/transport/routes";
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete route");
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
    <div className="space-y-6 w-full max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/transport/routes" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            All routes
          </Link>
        </Button>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDelete}>
            Delete
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pickup points → assigned children (live)</CardTitle>
          <CardDescription>Green verified = child RFID scanned (onboard) today.</CardDescription>
        </CardHeader>
        <CardContent>
          {stopChildrenError ? (
            <p className="text-sm text-destructive">{stopChildrenError}</p>
          ) : (
            <div className="space-y-4">
              {(stopChildren || []).map((s, idx) => (
                <div key={s.id} className="rounded-md border bg-background/60 px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      {idx + 1}. {s.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(s.children || []).filter((c) => c.onboarded).length}/{(s.children || []).length} verified
                    </div>
                  </div>

                  {(s.children || []).length === 0 ? (
                    <div className="mt-2 text-xs text-muted-foreground">No children assigned to this pickup point.</div>
                  ) : (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {s.children.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm">{c.childName}</div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {c.rfidTagUid ? `RFID: ${c.rfidTagUid}` : "RFID: —"} {c.lastScannedAt ? `· ${new Date(c.lastScannedAt).toLocaleTimeString()}` : ""}
                            </div>
                          </div>
                          <div className="shrink-0">
                            {c.onboarded ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

