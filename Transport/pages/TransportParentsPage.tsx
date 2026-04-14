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
import { Trash2, UserPlus } from "lucide-react";
import {
  createTransportChild,
  createRfidTag,
  assignRfidTag,
  unassignRfidTag,
  deleteRfidTag,
  deleteTransportChild,
  fetchRfidTags,
  fetchBusPickupPoints,
  fetchNearestPickupPoints,
  fetchPickupPoints,
  fetchTransportBuses,
  fetchTransportChildren,
  patchChildAssignment,
  type TransportBusDto,
  type TransportChildDto,
  type TransportPickupPointDto,
  type RfidTagDto,
} from "@transport/lib/transportApi";
import { isWebNfcSupported, scanOneNfcTagSerialNumber } from "@transport/lib/nfc";

export default function TransportParentsPage() {
  const SCHOOL_ID_KEY = "cp_transport_school_id";
  const [schoolId, setSchoolId] = useState(() => localStorage.getItem(SCHOOL_ID_KEY) || "");
  const [rows, setRows] = useState<TransportChildDto[]>([]);
  const [buses, setBuses] = useState<TransportBusDto[]>([]);
  const [pickupPoints, setPickupPoints] = useState<TransportPickupPointDto[]>([]);
  const [rfidTags, setRfidTags] = useState<RfidTagDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [nfcBusyChildId, setNfcBusyChildId] = useState<string | null>(null);

  const canLoad = useMemo(() => Boolean(schoolId.trim()), [schoolId]);

  const refresh = async (sid?: string) => {
    const effective = (sid ?? schoolId).trim();
    if (!effective) {
      setRows([]);
      setRfidTags([]);
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
      const tags = await fetchRfidTags(effective);
      setRfidTags(tags);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load children");
    } finally {
      setLoading(false);
    }
  };

  const unassignedTags = useMemo(() => rfidTags.filter((t) => !t.assignedStudentId), [rfidTags]);
  const busNameById = useMemo(() => new Map(buses.map((b) => [String(b.id), b.name])), [buses]);

  const assignExistingTag = async (childId: string, tagId: string) => {
    if (!tagId || tagId === "none") return;
    setLoading(true);
    try {
      await assignRfidTag(tagId, childId);
      toast.success("RFID assigned");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to assign RFID");
    } finally {
      setLoading(false);
    }
  };

  const unassignChildRfid = async (tagId: string) => {
    if (!tagId) return;
    setLoading(true);
    try {
      await unassignRfidTag(tagId);
      toast.success("RFID unassigned");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to unassign RFID");
    } finally {
      setLoading(false);
    }
  };

  const deleteChildRfid = async (tagId: string) => {
    if (!tagId) return;
    if (!confirm("Delete this RFID tag permanently?")) return;
    setLoading(true);
    try {
      await deleteRfidTag(tagId);
      toast.success("RFID deleted");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete RFID");
    } finally {
      setLoading(false);
    }
  };

  const deleteChild = async (child: TransportChildDto) => {
    if (!confirm(`Delete ${child.childName} permanently? This will remove assignment and unassign RFID.`)) return;
    setLoading(true);
    try {
      await deleteTransportChild(child.id);
      toast.success("Child deleted");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete child");
    } finally {
      setLoading(false);
    }
  };

  const scanAndAssignNfc = async (child: TransportChildDto) => {
    const sid = child.schoolId || schoolId;
    if (!sid) return toast.error("School ID missing");
    if (!isWebNfcSupported()) {
      return toast.error("NFC not supported. Use Android Chrome over HTTPS or assign manually.");
    }
    setNfcBusyChildId(child.id);
    try {
      toast.message("Tap the RFID/NFC card on the phone…");
      const { serialNumber } = await scanOneNfcTagSerialNumber({ timeoutMs: 20000 });
      const uid = serialNumber.trim();
      const newTagId = await createRfidTag({ schoolId: sid, tagUid: uid, tagName: null });
      if (!newTagId) throw new Error("RFID created but ID was not returned");
      await assignRfidTag(newTagId, child.id);
      toast.success("RFID scanned & assigned");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "NFC scan failed");
    } finally {
      setNfcBusyChildId(null);
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
  const [assignBusId, setAssignBusId] = useState<string>("none");
  const [assignMorningPickupPointId, setAssignMorningPickupPointId] = useState<string>("none");
  const [assignEveningDropPointId, setAssignEveningDropPointId] = useState<string>("none");
  const [busMorningPoints, setBusMorningPoints] = useState<Array<{ id: string; name: string; lat: number; lng: number; routeStopId: string }>>([]);
  const [busEveningPoints, setBusEveningPoints] = useState<Array<{ id: string; name: string; lat: number; lng: number; routeStopId: string }>>([]);

  const openAssign = async (child: TransportChildDto) => {
    setAssignChild(child);
    setAssignBusId(child.busId ?? "none");
    setAssignMorningPickupPointId(child.pickupPointId ?? "none");
    setAssignEveningDropPointId(child.dropPointId ?? "none");
    setBusMorningPoints([]);
    setBusEveningPoints([]);
    setAssignOpen(true);

    const addr = (child.address || "").trim();
    if (!addr || !child.schoolId) return;
    try {
      const nearest = await fetchNearestPickupPoints(child.schoolId, addr);
      if (nearest && nearest.length && !child.pickupPointId) {
        setAssignMorningPickupPointId((cur) => (cur === "none" ? nearest[0].id : cur));
      }
    } catch {
      // ignore — admin can manually choose
    }
  };

  const busCountsForPickup = useMemo(() => {
    const m = new Map<string, number>();
    if (assignMorningPickupPointId === "none") return m;
    for (const c of rows) {
      if (c.pickupPointId === assignMorningPickupPointId && c.busId) {
        m.set(c.busId, (m.get(c.busId) || 0) + 1);
      }
    }
    return m;
  }, [rows, assignMorningPickupPointId]);

  useEffect(() => {
    const run = async () => {
      if (!assignOpen || !assignChild) return;
      if (assignBusId === "none") {
        setBusMorningPoints([]);
        setBusEveningPoints([]);
        setAssignMorningPickupPointId("none");
        setAssignEveningDropPointId("none");
        return;
      }
      try {
        const [mPts, ePts] = await Promise.all([
          fetchBusPickupPoints(assignBusId, assignChild.schoolId, "morning"),
          fetchBusPickupPoints(assignBusId, assignChild.schoolId, "evening"),
        ]);
        setBusMorningPoints(mPts);
        setBusEveningPoints(ePts);
        if (mPts.length) {
          setAssignMorningPickupPointId((cur) => (cur === "none" ? mPts[0].id : cur));
        }
        if (ePts.length) {
          setAssignEveningDropPointId((cur) => (cur === "none" ? ePts[0].id : cur));
        }
      } catch (e: any) {
        setBusMorningPoints([]);
        setBusEveningPoints([]);
        toast.error(e?.message || "Failed to load pickup points for bus");
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignBusId, assignOpen, assignChild?.id]);

  const submitAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignChild) return;
    const busId = assignBusId === "none" ? null : assignBusId;
    if (!busId) return toast.error("Select bus");
    const pickupPointId = assignMorningPickupPointId === "none" ? null : assignMorningPickupPointId;
    const dropPointId = assignEveningDropPointId === "none" ? null : assignEveningDropPointId;
    if (busMorningPoints.length && !pickupPointId) return toast.error("Select morning pickup point");
    if (busEveningPoints.length && !dropPointId) return toast.error("Select evening drop point");
    setLoading(true);
    try {
      await patchChildAssignment(assignChild.id, { busId, pickupPointId, dropPointId });
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
      await patchChildAssignment(assignChild.id, { busId: null, pickupPointId: null, dropPointId: null });
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
                Register a child with parent email.
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

      <Dialog
        open={assignOpen}
        onOpenChange={(v) => {
          setAssignOpen(v);
          if (!v) {
            setAssignChild(null);
            setAssignBusId("none");
            setAssignMorningPickupPointId("none");
            setAssignEveningDropPointId("none");
            setBusMorningPoints([]);
            setBusEveningPoints([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submitAssign}>
            <DialogHeader>
              <DialogTitle>Assign child</DialogTitle>
              <DialogDescription>
                Select bus first. Then select morning pickup and evening drop points from that bus routes. Parent will get email notification.
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
                <Label>Bus</Label>
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
              <div className="grid gap-2">
                <Label>Morning pickup point (from bus morning route)</Label>
                <Select
                  value={assignMorningPickupPointId}
                  onValueChange={setAssignMorningPickupPointId}
                  disabled={assignBusId === "none" || busMorningPoints.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={assignBusId === "none" ? "Select bus first" : "Select morning pickup"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose pickup point</SelectItem>
                    {busMorningPoints.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-[11px] text-muted-foreground">
                  Morning pickup points are derived from the selected bus morning route stops.
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Evening drop point (from bus evening route)</Label>
                <Select
                  value={assignEveningDropPointId}
                  onValueChange={setAssignEveningDropPointId}
                  disabled={assignBusId === "none" || busEveningPoints.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={assignBusId === "none" ? "Select bus first" : "Select evening drop"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose drop point</SelectItem>
                    {busEveningPoints.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-[11px] text-muted-foreground">
                  Evening drop points are derived from the selected bus evening route stops.
                </div>
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
                <TableHead className="hidden md:table-cell">Gender</TableHead>
                <TableHead className="hidden lg:table-cell">Parent email</TableHead>
                <TableHead>Pickup point</TableHead>
                <TableHead className="hidden lg:table-cell">School</TableHead>
                <TableHead>RFID</TableHead>
                <TableHead className="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
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
                    <TableCell className="hidden md:table-cell capitalize">{r.gender || "-"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{r.parentEmail}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <div className="text-xs text-muted-foreground">
                          {r.pickupPointName || "Not assigned"}
                          {r.dropPointName ? ` · Drop: ${r.dropPointName}` : ""}{" "}
                          <span className="hidden sm:inline">
                            {r.busId ? `· ${busNameById.get(String(r.busId)) || "Bus"} ` : "· No bus"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => void openAssign(r)}
                            disabled={loading}
                          >
                            {r.busId || r.pickupPointId || r.dropPointId ? "Change" : "Assign bus & points"}
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell font-mono text-xs">{r.schoolId}</TableCell>
                    <TableCell>
                      {r.rfidTagId && r.rfidTagUid ? (
                        <div className="flex flex-col gap-1">
                          <div className="font-mono text-xs">{r.rfidTagUid}</div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void unassignChildRfid(r.rfidTagId as string)}
                              disabled={loading}
                            >
                              Unassign
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => void deleteChildRfid(r.rfidTagId as string)}
                              disabled={loading}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void scanAndAssignNfc(r)}
                              disabled={loading || nfcBusyChildId === r.id}
                            >
                              {nfcBusyChildId === r.id ? "Tap card…" : "Scan & assign RFID"}
                            </Button>
                            <Select value="none" onValueChange={(v) => void assignExistingTag(r.id, v)}>
                              <SelectTrigger className="h-9 w-[180px]">
                                <SelectValue placeholder="Assign existing RFID" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Choose unassigned tag</SelectItem>
                                {unassignedTags.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.tagUid} {t.tagName ? `(${t.tagName})` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            NFC needs Android Chrome over HTTPS. Otherwise use “Assign existing”.
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => void deleteChild(r)}
                        disabled={loading}
                        aria-label="Delete student"
                        title="Delete student"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
