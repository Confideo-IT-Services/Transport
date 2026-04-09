import { Fragment, useEffect, useMemo, useState } from "react";
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
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import {
  createTransportChild,
  fetchBusPickupPoints,
  fetchNearestPickupPoints,
  fetchPickupPoints,
  fetchTransportBuses,
  fetchTransportChildren,
  patchChildAssignment,
  type TransportBusDto,
  type TransportChildDto,
  type TransportPickupPointDto,
} from "@transport/lib/transportApi";

export default function TransportParentsPage() {
  const SCHOOL_ID_KEY = "cp_transport_school_id";
  const [schoolId, setSchoolId] = useState(() => localStorage.getItem(SCHOOL_ID_KEY) || "");
  const [rows, setRows] = useState<TransportChildDto[]>([]);
  const [buses, setBuses] = useState<TransportBusDto[]>([]);
  const [pickupPoints, setPickupPoints] = useState<TransportPickupPointDto[]>([]);
  const [loading, setLoading] = useState(false);

  const canLoad = useMemo(() => Boolean(schoolId.trim()), [schoolId]);

  const refresh = async (sid?: string) => {
    const effective = (sid ?? schoolId).trim();
    if (!effective) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const [out, b, pp] = await Promise.all([
        fetchTransportChildren(effective),
        fetchTransportBuses(),
        fetchPickupPoints(effective),
      ]);
      setRows(out);
      setBuses(b);
      setPickupPoints(pp);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load children");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canLoad) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    schoolId: schoolId || "",
    parentEmail: "",
    childName: "",
    gender: "" as "" | "male" | "female" | "other",
    address: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sid = form.schoolId.trim();
    if (!sid) return toast.error("School ID is required");
    const childName = form.childName.trim();
    if (!childName) return toast.error("Child name is required");
    const email = form.parentEmail.trim();
    if (!email) return toast.error("Parent email is required");
    const address = form.address.trim();
    if (!address) return toast.error("Address is required");

    setLoading(true);
    try {
      await createTransportChild({
        schoolId: sid,
        childName,
        gender: form.gender || null,
        parentEmail: email,
        address,
      });
      localStorage.setItem(SCHOOL_ID_KEY, sid);
      setSchoolId(sid);
      toast.success("Child registered");
      setForm({
        schoolId: sid,
        parentEmail: "",
        childName: "",
        gender: "",
        address: "",
      });
      setOpen(false);
      await refresh(sid);
    } catch (e: any) {
      toast.error(e?.message || "Failed to register child");
    } finally {
      setLoading(false);
    }
  };

  const openRegisterChild = () => {
    setForm({
      schoolId: schoolId || "",
      parentEmail: "",
      childName: "",
      gender: "",
      address: "",
    });
    setOpen(true);
  };

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignChild, setAssignChild] = useState<TransportChildDto | null>(null);
  const [assignPickupPointId, setAssignPickupPointId] = useState<string>("none");
  const [assignBusId, setAssignBusId] = useState<string>("none");
  const [busPickupPoints, setBusPickupPoints] = useState<Array<{ id: string; name: string; lat: number; lng: number; routeStopId: string }>>([]);

  const openAssign = async (child: TransportChildDto) => {
    setAssignChild(child);
    setAssignPickupPointId(child.pickupPointId ?? "none");
    setAssignBusId(child.busId ?? "none");
    setBusPickupPoints([]);
    setAssignOpen(true);

    const addr = (child.address || "").trim();
    if (!addr || !child.schoolId) return;
    try {
      const nearest = await fetchNearestPickupPoints(child.schoolId, addr);
      if (nearest && nearest.length && (assignPickupPointId === "none" || !child.pickupPointId)) {
        setAssignPickupPointId(nearest[0].id);
      }
    } catch {
      // ignore — admin can manually choose
    }
  };

  const busCountsForPickup = useMemo(() => {
    const m = new Map<string, number>();
    if (assignPickupPointId === "none") return m;
    for (const c of rows) {
      if (c.pickupPointId === assignPickupPointId && c.busId) {
        m.set(c.busId, (m.get(c.busId) || 0) + 1);
      }
    }
    return m;
  }, [rows, assignPickupPointId]);

  useEffect(() => {
    const run = async () => {
      if (!assignOpen || !assignChild) return;
      if (assignBusId === "none") {
        setBusPickupPoints([]);
        setAssignPickupPointId("none");
        return;
      }
      try {
        const pts = await fetchBusPickupPoints(assignBusId, assignChild.schoolId, "morning");
        setBusPickupPoints(pts);
        if (pts.length) {
          setAssignPickupPointId((cur) => (cur === "none" ? pts[0].id : cur));
        }
      } catch (e: any) {
        setBusPickupPoints([]);
        toast.error(e?.message || "Failed to load pickup points for bus");
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignBusId, assignOpen, assignChild?.id]);

  const submitAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignChild) return;
    const pickupPointId = assignPickupPointId === "none" ? null : assignPickupPointId;
    const busId = assignBusId === "none" ? null : assignBusId;
    if (!pickupPointId) return toast.error("Select pickup point");
    if (!busId) return toast.error("Select bus");
    setLoading(true);
    try {
      await patchChildAssignment(assignChild.id, { busId, pickupPointId });
      toast.success("Child assigned. Parent will get email notification.");
      setAssignOpen(false);
      setAssignChild(null);
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to assign child");
    } finally {
      setLoading(false);
    }
  };

  const unassignChildFromBus = async () => {
    if (!assignChild) return;
    if (!confirm(`Unassign ${assignChild.childName} from bus?`)) return;
    setLoading(true);
    try {
      await patchChildAssignment(assignChild.id, { busId: null, pickupPointId: null });
      toast.success("Child unassigned from bus");
      setAssignOpen(false);
      setAssignChild(null);
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "Failed to unassign child");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Fragment>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Child registration</DialogTitle>
              <DialogDescription>
                Register a child with parent email and assign RFID later.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="sid">School ID</Label>
                  <Input
                    id="sid"
                    value={form.schoolId}
                    onChange={(e) => setForm((f) => ({ ...f, schoolId: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="em">Parent email</Label>
                  <Input
                    id="em"
                    type="email"
                    value={form.parentEmail}
                    onChange={(e) => setForm((f) => ({ ...f, parentEmail: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cn">Child name</Label>
                  <Input
                    id="cn"
                    value={form.childName}
                    onChange={(e) => setForm((f) => ({ ...f, childName: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="addr">Address</Label>
                  <Input
                    id="addr"
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="House no, street, area, landmark"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Gender</Label>
                  <Select
                    value={form.gender || "none"}
                    onValueChange={(v) => setForm((f) => ({ ...f, gender: v === "none" ? "" : (v as any) }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                Register child
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submitAssign}>
            <DialogHeader>
              <DialogTitle>Assign child</DialogTitle>
              <DialogDescription>
                Review address and choose pickup point and bus. Parent will get email notification.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid gap-2">
                <Label>Child</Label>
                <Input value={assignChild?.childName || ""} readOnly />
              </div>
              <div className="grid gap-2">
                <Label>Address</Label>
                <Input value={assignChild?.address || ""} readOnly />
              </div>
              <div className="grid gap-2">
                <Label>Pickup point (nearest pre-selected)</Label>
                <Select value={assignPickupPointId} onValueChange={setAssignPickupPointId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select pickup point" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose pickup point</SelectItem>
                    {(busPickupPoints.length ? busPickupPoints : pickupPoints).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Bus (shows how many children already)</Label>
                <Select value={assignBusId} onValueChange={setAssignBusId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose bus</SelectItem>
                    {buses.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}{busCountsForPickup.get(b.id) ? ` (${busCountsForPickup.get(b.id)} assigned)` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>
                Cancel
              </Button>
              {assignChild?.busId ? (
                <Button type="button" variant="outline" onClick={() => void unassignChildFromBus()} disabled={loading}>
                  Unassign child
                </Button>
              ) : null}
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                Assign
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Parents & children</h1>
            <p className="text-muted-foreground text-sm mt-1">
              New parents add children for bus travel; view registered families with contact details.
            </p>
          </div>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={openRegisterChild}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Register new child
          </Button>
        </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Registered children</CardTitle>
            <CardDescription>School ID, child name, gender and parent email.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-emerald-600/50 text-emerald-800 hover:bg-emerald-600/10 dark:text-emerald-300"
            onClick={openRegisterChild}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Register new child
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <Label>School ID (used for RFID & children list)</Label>
              <Input
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                placeholder="Paste school UUID"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const sid = schoolId.trim();
                  if (!sid) return toast.error("Enter School ID");
                  localStorage.setItem(SCHOOL_ID_KEY, sid);
                  refresh(sid);
                }}
                disabled={loading}
              >
                Load
              </Button>
              <Button type="button" variant="outline" onClick={() => refresh()} disabled={loading || !canLoad}>
                Refresh
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Child</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Parent email</TableHead>
                <TableHead>School</TableHead>
                <TableHead>Assignment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <p className="text-muted-foreground mb-4">No children registered yet.</p>
                    <Button
                      type="button"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={openRegisterChild}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Register new child
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.childName}</TableCell>
                    <TableCell className="capitalize">{r.gender || "-"}</TableCell>
                    <TableCell>{r.parentEmail}</TableCell>
                    <TableCell className="font-mono text-xs">{r.schoolId}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground">
                          {r.pickupPointName || "No pickup"} · {r.busId ? "Bus assigned" : "No bus"}
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => void openAssign(r)} disabled={loading}>
                          Assign child
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </Fragment>
  );
}
