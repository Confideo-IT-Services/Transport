import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createRfidTag, fetchRfidTags, type RfidTagDto } from "@transport/lib/transportApi";

export default function TransportRfidTagsPage() {
  const [tags, setTags] = useState<RfidTagDto[]>([]);
  const [tagUid, setTagUid] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [loading, setLoading] = useState(false);

  const stats = useMemo(() => {
    const total = tags.length;
    const assigned = tags.filter((t) => t.assignedStudentId).length;
    return { total, assigned, unassigned: total - assigned };
  }, [tags]);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await fetchRfidTags(schoolId || undefined);
      setTags(data);
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
      await createRfidTag({ schoolId: schoolId || undefined, tagUid: uid });
      setTagUid("");
      toast.success("RFID added");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to add RFID");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">RFID tags</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add RFID tags here. During child registration, only <span className="font-medium">unassigned</span> RFID tags will be shown.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add RFID</CardTitle>
          <CardDescription>Paste the RFID UID exactly as printed/returned by the scanner.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>School ID (optional when logged in)</Label>
            <Input value={schoolId} onChange={(e) => setSchoolId(e.target.value)} placeholder="uuid (only needed for admin-secret mode)" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>RFID Tag UID</Label>
            <div className="flex gap-2">
              <Input value={tagUid} onChange={(e) => setTagUid(e.target.value)} placeholder="e.g. 04A1B2C3D4" />
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
          <CardDescription>Assigned RFIDs are hidden from the registration form.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <div className="grid grid-cols-3 bg-muted/40 text-xs font-medium px-3 py-2">
              <div>Tag UID</div>
              <div>Assigned student</div>
              <div>Created</div>
            </div>
            {tags.length === 0 ? (
              <div className="px-3 py-8 text-sm text-muted-foreground">No RFID tags yet.</div>
            ) : (
              tags.map((t) => (
                <div key={t.id} className="grid grid-cols-3 px-3 py-2 text-sm border-t">
                  <div className="font-mono">{t.tagUid}</div>
                  <div className="font-mono text-xs">{t.assignedStudentId || "-"}</div>
                  <div className="text-xs text-muted-foreground">{t.createdAt ? String(t.createdAt) : "-"}</div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

