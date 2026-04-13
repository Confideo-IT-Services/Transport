import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  createTransportAnnouncement,
  fetchTransportAnnouncements,
  type TransportAnnouncementDto,
} from "@transport/lib/transportApi";

export default function TransportAnnouncementsPage() {
  const SCHOOL_ID_KEY = "cp_transport_school_id";
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<TransportAnnouncementDto[]>([]);
  const [loading, setLoading] = useState(false);

  const schoolId = (typeof window !== "undefined" ? localStorage.getItem(SCHOOL_ID_KEY) : "") || "";

  const refresh = async () => {
    setLoading(true);
    try {
      if (!schoolId.trim()) {
        setItems([]);
        toast.error("School ID not set. Register a child first (Parents & children) to set School ID.");
        return;
      }
      const data = await fetchTransportAnnouncements(schoolId);
      setItems(data);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCreate = async () => {
    const t = title.trim();
    const m = message.trim();
    if (!t) return toast.error("Enter title");
    if (!m) return toast.error("Enter message");
    if (!schoolId.trim()) return toast.error("School ID not set. Register a child first to set School ID.");
    setLoading(true);
    try {
      await createTransportAnnouncement({ schoolId, title: t, message: m });
      setTitle("");
      setMessage("");
      toast.success("Announcement created");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create announcement");
    } finally {
      setLoading(false);
    }
  };

  const prettyDate = useMemo(
    () => (d: string | undefined) => {
      if (!d) return "";
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return d;
      return dt.toLocaleString();
    },
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Announcements</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create announcements for parents (in-app). Keep messages short and clear.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">New announcement</CardTitle>
          <CardDescription>Title and message only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bus A delayed by 20 min" />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the announcement message..."
              rows={5}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={onCreate} disabled={loading}>
              Publish
            </Button>
            <Button variant="outline" onClick={refresh} disabled={loading}>
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent announcements</CardTitle>
          <CardDescription>Latest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground">No announcements yet.</div>
          ) : (
            <div className="space-y-3">
              {items.map((a) => (
                <div key={a.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold break-words">{a.title}</div>
                      <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">{a.message}</div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">{prettyDate(a.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

