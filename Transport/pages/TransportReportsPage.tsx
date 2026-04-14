import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fetchDriverReport, fetchTransportBuses, type DriverReportDto, type TransportBusDto } from "@transport/lib/transportApi";

export default function TransportReportsPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tripType, setTripType] = useState<"morning" | "evening">("morning");
  const [buses, setBuses] = useState<TransportBusDto[]>([]);
  const [busId, setBusId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<DriverReportDto | null>(null);

  useEffect(() => {
    fetchTransportBuses()
      .then((b) => {
        setBuses(b);
        if (!busId && b.length) setBusId(b[0].id);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load buses"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedBus = useMemo(() => buses.find((b) => b.id === busId) || null, [buses, busId]);

  const load = async () => {
    if (!busId) return toast.error("Select a bus");
    setLoading(true);
    try {
      const out = await fetchDriverReport({ busId, tripType, date });
      setReport(out);
      toast.success("Report loaded");
    } catch (e: any) {
      toast.error(e?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Driver trip report: trip times + reached stops.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Driver report</CardTitle>
          <CardDescription>Select date + bus + trip type.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Trip type</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={tripType}
              onChange={(e) => setTripType(e.target.value === "evening" ? "evening" : "morning")}
            >
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Bus</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={busId}
              onChange={(e) => setBusId(e.target.value)}
            >
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.id.slice(0, 8)}…)
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4 flex items-center gap-2">
            <Button onClick={() => void load()} disabled={loading}>
              {loading ? "Loading…" : "Load report"}
            </Button>
            <div className="text-xs text-muted-foreground">
              {selectedBus ? `Bus: ${selectedBus.name}` : "—"}
            </div>
          </div>
        </CardContent>
      </Card>

      {report ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
            <CardDescription>Trip status and stop reach times.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4 text-sm">
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">Status</div>
                <div className="font-medium">{report.trip?.status || "—"}</div>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">Started</div>
                <div className="font-medium">{report.trip?.startedAt || "—"}</div>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">Ended</div>
                <div className="font-medium">{report.trip?.endedAt || "—"}</div>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-xs text-muted-foreground">Route</div>
                <div className="font-medium">{report.route?.routeId ? `${report.route.routeId.slice(0, 8)}…` : "—"}</div>
              </div>
            </div>

            <div className="mt-5 border rounded-md overflow-hidden">
              <div className="grid grid-cols-4 bg-muted/40 text-xs font-medium px-3 py-2">
                <div>#</div>
                <div className="col-span-2">Stop</div>
                <div>Reached at</div>
              </div>
              {report.stops.length === 0 ? (
                <div className="px-3 py-8 text-sm text-muted-foreground">No stops found for this bus/trip.</div>
              ) : (
                report.stops
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((s) => (
                    <div key={s.id} className="grid grid-cols-4 px-3 py-2 text-sm border-t items-center gap-2">
                      <div className="text-xs text-muted-foreground">{s.order}</div>
                      <div className="col-span-2 truncate" title={s.name}>
                        {s.name}
                      </div>
                      <div className="font-mono text-xs">{s.reachedAt || "—"}</div>
                    </div>
                  ))
              )}
            </div>

            <div className="mt-5 border rounded-md overflow-hidden">
              <div className="grid grid-cols-3 bg-muted/40 text-xs font-medium px-3 py-2">
                <div>Event</div>
                <div>Stop ID</div>
                <div>Time</div>
              </div>
              {report.events.length === 0 ? (
                <div className="px-3 py-8 text-sm text-muted-foreground">No events for this date.</div>
              ) : (
                report.events.map((e, idx) => (
                  <div key={`${e.eventType}-${e.at}-${idx}`} className="grid grid-cols-3 px-3 py-2 text-sm border-t items-center gap-2">
                    <div className="text-xs">{e.eventType}</div>
                    <div className="font-mono text-xs">{e.routeStopId ? `${e.routeStopId.slice(0, 8)}…` : "—"}</div>
                    <div className="font-mono text-xs">{e.at}</div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

