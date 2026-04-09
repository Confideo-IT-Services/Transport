import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { toast } from "sonner";
import { Bus, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";
import {
  createTransportBus,
  deleteTransportBus,
  fetchTodayTripStatuses,
  fetchTransportBuses,
  fetchTransportDrivers,
  unassignDriverFromBus,
  patchTransportBus,
  type TransportBusDto,
  type TransportDriverDto,
} from "@transport/lib/transportApi";
import { Badge } from "@/components/ui/badge";

export default function TransportBusesPage() {
  const [buses, setBuses] = useState<TransportBusDto[]>([]);
  const [drivers, setDrivers] = useState<TransportDriverDto[]>([]);
  const [todayTrips, setTodayTrips] = useState<{ tripDate: string; trips: { busId: string; tripType: "morning" | "evening"; status: "idle" | "active" | "ended" }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [b, d, t] = await Promise.all([fetchTransportBuses(), fetchTransportDrivers(), fetchTodayTripStatuses()]);
      setBuses(b);
      setDrivers(d);
      setTodayTrips(t);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load fleet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  // Keep "Today" status fresh while admin is watching the page.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const t = await fetchTodayTripStatuses();
        if (!cancelled) setTodayTrips(t);
      } catch {
        // ignore — fleet still loads, but "Today" badges may be stale
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const [busOpen, setBusOpen] = useState(false);
  const [busForm, setBusForm] = useState({
    name: "",
    registrationNo: "",
    capacity: "40",
  });

  const submitBus = async (e: React.FormEvent) => {
    e.preventDefault();
    const cap = parseInt(busForm.capacity, 10);
    if (!busForm.name.trim() || Number.isNaN(cap) || cap < 1) {
      toast.error("Fill bus name and valid capacity");
      return;
    }
    try {
      await createTransportBus({
        name: busForm.name.trim(),
        registrationNo: busForm.registrationNo.trim() || undefined,
        capacity: cap,
      });
      toast.success("Bus created");
      setBusForm({ name: "", registrationNo: "", capacity: "40" });
      setBusOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create bus");
    }
  };

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editBus, setEditBus] = useState<TransportBusDto | null>(null);
  const [editForm, setEditForm] = useState({ name: "", registrationNo: "", capacity: "40" });

  const openEdit = (b: TransportBusDto) => {
    setEditBus(b);
    setEditForm({
      name: b.name ?? "",
      registrationNo: b.registrationNo ?? "",
      capacity: b.capacity != null ? String(b.capacity) : "40",
    });
    setEditOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBus) return;
    const cap = editForm.capacity ? parseInt(editForm.capacity, 10) : NaN;
    if (!editForm.name.trim() || Number.isNaN(cap) || cap < 1) {
      toast.error("Fill bus name and valid capacity");
      return;
    }
    setEditSaving(true);
    try {
      await patchTransportBus(editBus.id, {
        name: editForm.name.trim(),
        registrationNo: editForm.registrationNo.trim() || null,
        capacity: cap,
      });
      toast.success("Bus updated");
      setEditOpen(false);
      setEditBus(null);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update bus");
    } finally {
      setEditSaving(false);
    }
  };

  const onDelete = async (b: TransportBusDto) => {
    if (!confirm(`Delete bus "${b.name}"?\n\nThis is allowed only if the bus is unassigned.`)) return;
    try {
      await deleteTransportBus(b.id);
      toast.success("Bus deleted");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete bus");
    }
  };

  const onUnassignDriver = async (b: TransportBusDto) => {
    if (!confirm(`Unassign driver from "${b.name}"?\n\nThis is required before deleting the bus.`)) return;
    try {
      await unassignDriverFromBus(b.id);
      toast.success("Driver unassigned from bus");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to unassign driver");
    }
  };

  const driverByBusId = useMemo(() => {
    const m = new Map<string, TransportDriverDto>();
    for (const d of drivers) {
      if (d.busId) m.set(d.busId, d);
    }
    return m;
  }, [drivers]);

  const statusByBusId = useMemo(() => {
    const m = new Map<string, { overall: "not_started" | "active" | "ended"; morning?: string; evening?: string }>();
    const trips = todayTrips?.trips || [];
    for (const t of trips) {
      const cur = m.get(t.busId) || { overall: "not_started" as const };
      if (t.tripType === "morning") cur.morning = t.status;
      if (t.tripType === "evening") cur.evening = t.status;
      // overall: active > ended > not_started
      if (t.status === "active") cur.overall = "active";
      else if (t.status === "ended" && cur.overall !== "active") cur.overall = "ended";
      m.set(t.busId, cur);
    }
    return m;
  }, [todayTrips]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Buses</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All buses from PostgreSQL (Transport API).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={busOpen} onOpenChange={setBusOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-2" />
                Add bus
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={submitBus}>
                <DialogHeader>
                  <DialogTitle>Add bus</DialogTitle>
                  <DialogDescription>Registration, capacity, and default route.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <div className="grid gap-2">
                    <Label>Name</Label>
                    <Input
                      value={busForm.name}
                      onChange={(e) => setBusForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. BUS-B"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Registration</Label>
                    <Input
                      value={busForm.registrationNo}
                      onChange={(e) => setBusForm((f) => ({ ...f, registrationNo: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Seat capacity</Label>
                    <Input
                      type="number"
                      min={1}
                      value={busForm.capacity}
                      onChange={(e) => setBusForm((f) => ({ ...f, capacity: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Save bus</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={submitEdit}>
                <DialogHeader>
                  <DialogTitle>Edit bus</DialogTitle>
                  <DialogDescription>Update name, registration, and capacity.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <div className="grid gap-2">
                    <Label>Name</Label>
                    <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div className="grid gap-2">
                    <Label>Registration</Label>
                    <Input
                      value={editForm.registrationNo}
                      onChange={(e) => setEditForm((f) => ({ ...f, registrationNo: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Seat capacity</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editForm.capacity}
                      onChange={(e) => setEditForm((f) => ({ ...f, capacity: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={editSaving}>
                    {editSaving ? "Saving…" : "Save changes"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loadError && (
        <p className="text-sm text-destructive">
          {loadError}. Ensure backend is running and `2026-04-08-transport_fleet.sql` is applied.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : buses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No buses yet. Add one.</p>
        ) : (
          buses.map((b) => {
            const driver = driverByBusId.get(b.id);
            const routeName = driver?.morningRouteName || driver?.eveningRouteName || "—";
            const status = statusByBusId.get(b.id)?.overall || "not_started";
          return (
            <Card key={b.id} className="overflow-hidden border-emerald-600/10">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-emerald-600/10 p-2 text-emerald-700 dark:text-emerald-400">
                      <Bus className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{b.name}</CardTitle>
                      <CardDescription className="font-mono text-xs">{b.registrationNo ?? ""}</CardDescription>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{b.capacity ?? "—"} seats</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Today:</span>
                  {status === "active" ? (
                    <Badge className="bg-emerald-600">Trip in progress</Badge>
                  ) : status === "ended" ? (
                    <Badge variant="outline" className="border-amber-600/50 text-amber-800 dark:text-amber-300">
                      Tour ended
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not started</Badge>
                  )}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Driver · </span>
                  <span className="font-medium">{driver?.fullName ?? driver?.email ?? "—"}</span>
                  {driver?.phone && driver.phone !== "—" && (
                    <span className="text-muted-foreground block text-xs mt-0.5">{driver.phone}</span>
                  )}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Route · </span>
                  <span className="font-medium">{routeName}</span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => openEdit(b)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Modify
                  </Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => void onUnassignDriver(b)}>
                    Unassign driver
                  </Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => void onDelete(b)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
                <Button variant="secondary" className="w-full justify-between" asChild>
                  <Link to={`/transport/buses/${b.id}`}>
                    View route & live position
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
