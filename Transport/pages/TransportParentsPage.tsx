import { Fragment, useState } from "react";
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
import { UserPlus, Trash2 } from "lucide-react";
import {
  addParent,
  removeParent,
  assignParentToBus,
  getParents,
  getBuses,
} from "@transport/mock/mockStore";
import type { TransportParentRecord } from "@transport/types";

export default function TransportParentsPage() {
  const [rows, setRows] = useState<TransportParentRecord[]>(() => getParents());

  const refresh = () => setRows(getParents());
  const buses = getBuses();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    parentName: "",
    phone: "",
    childName: "",
    classGrade: "",
    pickupArea: "",
    assignedBusId: "" as string | "none",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    addParent({
      parentName: form.parentName.trim(),
      phone: form.phone.trim(),
      childName: form.childName.trim(),
      classGrade: form.classGrade.trim(),
      pickupArea: form.pickupArea.trim(),
      assignedBusId: form.assignedBusId === "none" || !form.assignedBusId ? null : form.assignedBusId,
    });
    toast.success("Child registered for bus travel");
    setForm({
      parentName: "",
      phone: "",
      childName: "",
      classGrade: "",
      pickupArea: "",
      assignedBusId: "none",
    });
    setOpen(false);
    refresh();
  };

  const openRegisterChild = () => {
    setForm({
      parentName: "",
      phone: "",
      childName: "",
      classGrade: "",
      pickupArea: "",
      assignedBusId: "none",
    });
    setOpen(true);
  };

  const onAssignBus = (parentId: string, busId: string) => {
    assignParentToBus(parentId, busId === "none" ? null : busId);
    refresh();
    toast.message("Assignment updated");
  };

  const onRemove = (id: string) => {
    removeParent(id);
    refresh();
    toast.success("Removed from list");
  };

  return (
    <Fragment>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Child registration</DialogTitle>
              <DialogDescription>
                Add a new child for school bus travel. Enter parent contact and pickup details (demo: stored in
                browser).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="pn">Parent name</Label>
                  <Input
                    id="pn"
                    value={form.parentName}
                    onChange={(e) => setForm((f) => ({ ...f, parentName: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ph">Phone</Label>
                  <Input
                    id="ph"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
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
                  <Label htmlFor="cg">Class / section</Label>
                  <Input
                    id="cg"
                    placeholder="e.g. 5-A"
                    value={form.classGrade}
                    onChange={(e) => setForm((f) => ({ ...f, classGrade: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pa">Pickup area</Label>
                  <Input
                    id="pa"
                    value={form.pickupArea}
                    onChange={(e) => setForm((f) => ({ ...f, pickupArea: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Assign bus</Label>
                  <Select
                    value={form.assignedBusId || "none"}
                    onValueChange={(v) => setForm((f) => ({ ...f, assignedBusId: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose bus" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned later</SelectItem>
                      {buses.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.label} ({b.regNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                Register child
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
            <CardDescription>Parent name, phone, child, and bus assignment.</CardDescription>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parent</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Child</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Bus</TableHead>
                <TableHead className="w-[100px]" />
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
                    <TableCell className="font-medium">{r.parentName}</TableCell>
                    <TableCell>{r.phone}</TableCell>
                    <TableCell>{r.childName}</TableCell>
                    <TableCell>{r.classGrade}</TableCell>
                    <TableCell>{r.pickupArea}</TableCell>
                    <TableCell>
                      <Select
                        value={r.assignedBusId ?? "none"}
                        onValueChange={(v) => onAssignBus(r.id, v)}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {buses.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onRemove(r.id)}
                        aria-label="Remove"
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
