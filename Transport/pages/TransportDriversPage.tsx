import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { UserPlus, Loader2, Bus, Route, Pencil } from "lucide-react";
import { useMemo } from "react";
import {
  fetchTransportDrivers,
  createTransportDriver,
  fetchTransportBuses,
  fetchTransportRoutes,
  createTransportBus,
  createTransportRoute,
  patchTransportDriverAssignment,
  type TransportDriverDto,
  type TransportBusDto,
  type TransportRouteDto,
} from "@transport/lib/transportApi";
import { RouteStopsBuilder, type RouteStopInput } from "@transport/components/RouteStopsBuilder";

export default function TransportDriversPage() {
  const [rows, setRows] = useState<TransportDriverDto[]>([]);
  const [buses, setBuses] = useState<TransportBusDto[]>([]);
  const [routes, setRoutes] = useState<TransportRouteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const loadFleet = useCallback(async () => {
    try {
      const [b, r] = await Promise.all([fetchTransportBuses(), fetchTransportRoutes()]);
      setBuses(b);
      setRoutes(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load buses/routes";
      toast.error(msg);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      await loadFleet();
      const drivers = await fetchTransportDrivers();
      setRows(drivers);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load drivers";
      setListError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [loadFleet]);

  useEffect(() => {
    void load();
  }, [load]);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    licenseNo: "",
    busId: "",
    morningRouteId: "",
    eveningRouteId: "",
  });

  const usedRouteIds = useMemo(() => {
    const s = new Set<string>();
    for (const d of rows) {
      if (d.morningRouteId) s.add(d.morningRouteId);
      if (d.eveningRouteId) s.add(d.eveningRouteId);
    }
    return s;
  }, [rows]);

  const availableRoutesForCreate = useMemo(() => {
    return routes.filter((r) => !usedRouteIds.has(r.id));
  }, [routes, usedRouteIds]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.busId || !form.morningRouteId || !form.eveningRouteId) {
      toast.error("Select bus, morning route, and evening route");
      return;
    }
    if (form.morningRouteId === form.eveningRouteId) {
      toast.error("Morning and evening route must be different");
      return;
    }
    if (!form.email.trim() || !form.password) {
      toast.error("Email and password are required");
      return;
    }
    setSaving(true);
    try {
      await createTransportDriver({
        email: form.email.trim(),
        password: form.password,
        fullName: form.name.trim(),
        phone: form.phone.trim(),
        licenseNo: form.licenseNo.trim(),
        busId: form.busId,
        morningRouteId: form.morningRouteId,
        eveningRouteId: form.eveningRouteId,
      });
      toast.success("Driver created in database");
      setForm({
        email: "",
        password: "",
        name: "",
        phone: "",
        licenseNo: "",
        busId: "",
        morningRouteId: "",
        eveningRouteId: "",
      });
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create driver");
    } finally {
      setSaving(false);
    }
  };

  const [busOpen, setBusOpen] = useState(false);
  const [busSaving, setBusSaving] = useState(false);
  const [busForm, setBusForm] = useState({ name: "", registrationNo: "", capacity: "" });

  const submitBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!busForm.name.trim()) {
      toast.error("Bus name is required");
      return;
    }
    setBusSaving(true);
    try {
      await createTransportBus({
        name: busForm.name.trim(),
        registrationNo: busForm.registrationNo.trim() || undefined,
        capacity: busForm.capacity ? parseInt(busForm.capacity, 10) : undefined,
      });
      toast.success("Bus created");
      setBusForm({ name: "", registrationNo: "", capacity: "" });
      setBusOpen(false);
      await loadFleet();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusSaving(false);
    }
  };

  const [routeOpen, setRouteOpen] = useState(false);
  const [routeSaving, setRouteSaving] = useState(false);
  const [routeForm, setRouteForm] = useState({ name: "" });
  const [routeStops, setRouteStops] = useState<RouteStopInput[]>([]);

  const submitRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeForm.name.trim()) {
      toast.error("Route name is required");
      return;
    }
    if (routeStops.length === 0) {
      toast.error("Add at least one stop (search and select a place)");
      return;
    }
    setRouteSaving(true);
    try {
      await createTransportRoute({
        name: routeForm.name.trim(),
        stops: routeStops.map((s) => ({ name: s.name, lat: s.lat, lng: s.lng })),
      });
      toast.success("Route created");
      setRouteForm({ name: "" });
      setRouteStops([]);
      setRouteOpen(false);
      await loadFleet();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setRouteSaving(false);
    }
  };

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editDriver, setEditDriver] = useState<TransportDriverDto | null>(null);
  const [editForm, setEditForm] = useState({
    busId: "",
    morningRouteId: "",
    eveningRouteId: "",
  });

  const openEdit = (d: TransportDriverDto) => {
    setEditDriver(d);
    setEditForm({
      busId: d.busId || "",
      morningRouteId: d.morningRouteId || "",
      eveningRouteId: d.eveningRouteId || "",
    });
    setEditOpen(true);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDriver) return;
    if (!editForm.busId) return;
    const m = editForm.morningRouteId || null;
    const ev = editForm.eveningRouteId || null;
    if ((m && !ev) || (!m && ev)) {
      toast.error("Set both morning and evening routes (or clear both to unassign)");
      return;
    }
    if (m && ev && m === ev) {
      toast.error("Morning and evening route must be different");
      return;
    }
    setEditSaving(true);
    try {
      await patchTransportDriverAssignment(editDriver.id, {
        busId: editForm.busId,
        morningRouteId: m,
        eveningRouteId: ev,
      });
      toast.success("Driver assignment updated");
      setEditOpen(false);
      setEditDriver(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Drivers</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Assign a <strong>bus</strong> and <strong>morning</strong> / <strong>evening</strong> routes (unique IDs from
            PostgreSQL). Create buses and routes first if the lists are empty.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={busOpen} onOpenChange={setBusOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Bus className="h-4 w-4 mr-2" />
                Add bus
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={submitBus}>
                <DialogHeader>
                  <DialogTitle>New bus</DialogTitle>
                  <DialogDescription>Creates a row in <code className="text-xs">transport_buses</code>.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <div className="grid gap-2">
                    <Label>Name</Label>
                    <Input value={busForm.name} onChange={(e) => setBusForm((f) => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div className="grid gap-2">
                    <Label>Registration (optional)</Label>
                    <Input value={busForm.registrationNo} onChange={(e) => setBusForm((f) => ({ ...f, registrationNo: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Capacity (optional)</Label>
                    <Input type="number" value={busForm.capacity} onChange={(e) => setBusForm((f) => ({ ...f, capacity: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={busSaving}>
                    {busSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save bus"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog
            open={routeOpen}
            onOpenChange={(o) => {
              setRouteOpen(o);
              if (!o) {
                setRouteForm({ name: "" });
                setRouteStops([]);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Route className="h-4 w-4 mr-2" />
                Add route
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <form onSubmit={submitRoute}>
                <DialogHeader>
                  <DialogTitle>New route</DialogTitle>
                  <DialogDescription>
                    Search places like in Uber/Rapido, then add stops in <strong>morning order</strong> (1 → N). Evening
                    uses the same stops in reverse.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <div className="grid gap-2">
                    <Label>Route name</Label>
                    <Input
                      value={routeForm.name}
                      onChange={(e) => setRouteForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. West zone — morning"
                      required
                    />
                  </div>
                  <RouteStopsBuilder stops={routeStops} onChange={setRouteStops} disabled={routeSaving} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={routeSaving}>
                    {routeSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save route"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <UserPlus className="h-4 w-4 mr-2" />
                Add driver
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <form onSubmit={submit}>
                <DialogHeader>
                  <DialogTitle>New driver</DialogTitle>
                  <DialogDescription>
                    Requires <code className="text-xs bg-muted px-1 rounded">TRANSPORT_ADMIN_SECRET</code> or school admin
                    JWT.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="de">Email</Label>
                    <Input
                      id="de"
                      type="email"
                      autoComplete="off"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dpw">Password</Label>
                    <Input
                      id="dpw"
                      type="password"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dn">Full name</Label>
                    <Input id="dn" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dph">Phone</Label>
                    <Input id="dph" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dl">License number</Label>
                    <Input id="dl" value={form.licenseNo} onChange={(e) => setForm((f) => ({ ...f, licenseNo: e.target.value }))} required />
                  </div>
                  <div className="grid gap-2">
                    <Label>Bus</Label>
                    <Select value={form.busId} onValueChange={(v) => setForm((f) => ({ ...f, busId: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bus" />
                      </SelectTrigger>
                      <SelectContent>
                        {buses.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                            {b.registrationNo ? ` (${b.registrationNo})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Morning route</Label>
                    <Select value={form.morningRouteId} onValueChange={(v) => setForm((f) => ({ ...f, morningRouteId: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Morning trip (stop order 1→N)" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoutesForCreate.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Evening route</Label>
                    <Select value={form.eveningRouteId} onValueChange={(v) => setForm((f) => ({ ...f, eveningRouteId: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Evening trip (often same route, reversed in app)" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoutesForCreate.map((r) => (
                          <SelectItem key={`e-${r.id}`} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save driver"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={submitEdit}>
                <DialogHeader>
                  <DialogTitle>Edit assignment</DialogTitle>
                  <DialogDescription>
                    Update bus and routes for {editDriver?.fullName ?? editDriver?.email ?? "driver"}.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <div className="grid gap-2">
                    <Label>Bus</Label>
                    <Select value={editForm.busId} onValueChange={(v) => setEditForm((f) => ({ ...f, busId: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bus" />
                      </SelectTrigger>
                      <SelectContent>
                        {buses.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                            {b.registrationNo ? ` (${b.registrationNo})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Morning route</Label>
                    <Select
                      value={editForm.morningRouteId}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, morningRouteId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Morning route" />
                      </SelectTrigger>
                      <SelectContent>
                        {routes
                          .filter((r) => !usedRouteIds.has(r.id) || r.id === editDriver?.morningRouteId || r.id === editDriver?.eveningRouteId)
                          .map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Evening route</Label>
                    <Select
                      value={editForm.eveningRouteId}
                      onValueChange={(v) => setEditForm((f) => ({ ...f, eveningRouteId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Evening route" />
                      </SelectTrigger>
                      <SelectContent>
                        {routes
                          .filter((r) => !usedRouteIds.has(r.id) || r.id === editDriver?.morningRouteId || r.id === editDriver?.eveningRouteId)
                          .map((r) => (
                          <SelectItem key={`e-${r.id}`} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={editSaving}>
                    {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save assignment"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {listError && (
        <p className="text-sm text-destructive">
          {listError}. Ensure the backend is running,{" "}
          <code className="text-xs bg-muted px-1 rounded">2026-04-08-transport_fleet.sql</code> is applied, and{" "}
          <code className="text-xs bg-muted px-1 rounded">VITE_TRANSPORT_ADMIN_SECRET</code> or admin JWT is set.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Driver roster</CardTitle>
          <CardDescription>Data from PostgreSQL (GET /api/transport/drivers).</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading drivers…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Bus</TableHead>
                  <TableHead>Morning route</TableHead>
                  <TableHead>Evening route</TableHead>
                  <TableHead className="w-[100px]"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground text-center py-8">
                      No drivers yet. Add at least one bus and two routes (or the same route twice), then add a driver.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.email}</TableCell>
                      <TableCell className="font-medium">{d.fullName ?? "—"}</TableCell>
                      <TableCell>{d.phone ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{d.licenseNo ?? "—"}</TableCell>
                      <TableCell>{d.busName ?? d.busId ?? "—"}</TableCell>
                      <TableCell>{d.morningRouteName ?? d.morningRouteId ?? "—"}</TableCell>
                      <TableCell>{d.eveningRouteName ?? d.eveningRouteId ?? "—"}</TableCell>
                      <TableCell>
                        <Button type="button" variant="outline" size="sm" onClick={() => openEdit(d)}>
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
