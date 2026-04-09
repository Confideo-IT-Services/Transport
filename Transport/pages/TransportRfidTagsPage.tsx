import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  assignRfidTag,
  createRfidTag,
  fetchRfidTags,
  fetchTransportChildren,
  unassignRfidTag,
  type RfidTagDto,
  type TransportChildDto,
} from "@transport/lib/transportApi";

export default function TransportRfidTagsPage() {
  const SCHOOL_ID_KEY = "cp_transport_school_id";
  const [tags, setTags] = useState<RfidTagDto[]>([]);
  const [tagUid, setTagUid] = useState("");
  const [tagName, setTagName] = useState("");
  const [children, setChildren] = useState<TransportChildDto[]>([]);
  const [loading, setLoading] = useState(false);

  const schoolId = (typeof window !== "undefined" ? localStorage.getItem(SCHOOL_ID_KEY) : "") || "";

  const stats = useMemo(() => {
    const total = tags.length;
    const assigned = tags.filter((t) => t.assignedStudentId).length;
    return { total, assigned, unassigned: total - assigned };
  }, [tags]);

  const refresh = async () => {
    setLoading(true);
    try {
      if (!schoolId.trim()) {
        setTags([]);
        setChildren([]);
        toast.error("School ID not set. Register a child first (Parents & children) to set School ID.");
        return;
      }
      const data = await fetchRfidTags(schoolId);
      setTags(data);
      const c = await fetchTransportChildren(schoolId);
      setChildren(c);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load RFID tags");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAdd = async () => {
    const uid = tagUid.trim();
    if (!uid) return toast.error("Enter RFID tag UID");
    setLoading(true);
    try {
      if (!schoolId.trim()) {
        toast.error("School ID not set. Register a child first to set School ID.");
        return;
      }
      await createRfidTag({ schoolId, tagUid: uid, tagName: tagName.trim() || null });
      setTagUid("");
      setTagName("");
      toast.success("RFID added");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to add RFID");
    } finally {
      setLoading(false);
    }
  };

  const childById = useMemo(() => {
    const m = new Map<string, TransportChildDto>();
    for (const c of children) m.set(c.id, c);
    return m;
  }, [children]);

  const onAssign = async (tagId: string, studentId: string) => {
    if (studentId === "none") return;
    setLoading(true);
    try {
      await assignRfidTag(tagId, studentId);
      toast.success("RFID assigned. Parent will get email with card details.");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to assign RFID");
    } finally {
      setLoading(false);
    }
  };

  const onUnassign = async (tagId: string) => {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">RFID tags</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add RFID tags here using the UID printed by the scanner (e.g. Arduino shows “UID: 5D16D5”).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add RFID</CardTitle>
          <CardDescription>Paste the RFID UID exactly as printed/returned by the scanner.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>RFID name (optional)</Label>
            <Input value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="e.g. Card-01 / Bus-A-Card" />
          </div>
          <div className="space-y-2">
            <Label>RFID Tag UID</Label>
            <div className="flex gap-2">
              <Input value={tagUid} onChange={(e) => setTagUid(e.target.value)} placeholder="e.g. 5D16D5" />
              <Button onClick={onAdd} disabled={loading}>
                Add
              </Button>
              <Button variant="outline" onClick={refresh} disabled={loading}>
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            RFID list{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({stats.total} total · {stats.unassigned} unassigned · {stats.assigned} assigned)
            </span>
          </CardTitle>
          <CardDescription>Create RFID first, then assign to a child (assignment triggers parent email).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <div className="grid grid-cols-4 bg-muted/40 text-xs font-medium px-3 py-2">
              <div>Tag</div>
              <div>Name</div>
              <div>Assigned child</div>
              <div>Assign</div>
            </div>
            {tags.length === 0 ? (
              <div className="px-3 py-8 text-sm text-muted-foreground">No RFID tags yet.</div>
            ) : (
              tags.map((t) => (
                <div key={t.id} className="grid grid-cols-4 px-3 py-2 text-sm border-t items-center gap-2">
                  <div className="font-mono">{t.tagUid}</div>
                  <div className="text-xs">{t.tagName || "-"}</div>
                  <div className="text-xs">
                    {t.assignedStudentId ? (childById.get(t.assignedStudentId)?.childName || t.assignedStudentId) : "-"}
                  </div>
                  <div>
                    {t.assignedStudentId ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8"
                        onClick={() => onUnassign(t.id)}
                        disabled={loading}
                      >
                        Unassign
                      </Button>
                    ) : (
                      <Select value="none" onValueChange={(v) => onAssign(t.id, v)}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Assign child" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Choose child</SelectItem>
                          {children.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.childName} ({c.parentEmail})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

