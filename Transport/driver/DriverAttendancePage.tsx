import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bus, RefreshCw, CheckCircle2 } from "lucide-react";
import { getDriverJwt, getDriverSession, resolveDriverBusId } from "@transport/driverSession";
import { SeatBoardingGrid } from "@transport/components/SeatBoardingGrid";
import { driverAttendanceManual, driverAttendanceScan, fetchDriverAssignedChildren, type DriverAssignedChildDto } from "@transport/lib/transportApi";
import { toast } from "sonner";
import { isWebNfcSupported, scanOneNfcTagSerialNumber } from "@transport/lib/nfc";

export default function DriverAttendancePage() {
  const session = getDriverSession();
  const busId = session ? resolveDriverBusId(session) : undefined;
  const busLabel = session?.busName || (busId ? `Bus (${busId.slice(0, 8)}…)` : "");
  const capacity = session?.busCapacity ?? 30;
  const jwt = session?.token ? getDriverJwt() : null;

  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const [tripType, setTripType] = useState<"morning" | "evening">("morning");
  const [children, setChildren] = useState<DriverAssignedChildDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const unverified = useMemo(() => children.filter((c) => !c.onboarded), [children]);

  useEffect(() => {
    if (!jwt) return;
    let cancelled = false;
    setLoading(true);
    fetchDriverAssignedChildren(jwt, tripType)
      .then((out) => {
        if (cancelled) return;
        setChildren(out.children || []);
      })
      .catch((e) => {
        if (cancelled) return;
        setChildren([]);
        toast.error(e instanceof Error ? e.message : "Failed to load assigned children");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const t = window.setInterval(() => {
      fetchDriverAssignedChildren(jwt, tripType)
        .then((out) => {
          if (!cancelled) setChildren(out.children || []);
        })
        .catch(() => {
          // keep last known view
        });
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [jwt, tripType, tick]);

  const seats = useMemo(() => {
    if (!busId) return [];
    const boardedCount = children.filter((c) => c.onboarded).length;
    const out: { seatNumber: number; boarded: boolean; childName?: string }[] = [];
    for (let i = 1; i <= capacity; i++) {
      out.push({ seatNumber: i, boarded: i <= boardedCount });
    }
    return out;
  }, [busId, capacity, children]);

  const boarded = seats.filter((s) => s.boarded).length;

  if (!busId) {
    return <p className="text-muted-foreground">No bus assigned.</p>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tripType === "morning" ? "default" : "outline"}
          onClick={() => setTripType("morning")}
        >
          Morning
        </Button>
        <Button
          type="button"
          variant={tripType === "evening" ? "default" : "outline"}
          onClick={() => setTripType("evening")}
        >
          Evening
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600/10 text-amber-800">
              <Bus className="h-6 w-6" />
            </span>
            Attendance
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {busLabel} · {boarded} onboard of {capacity} seats{" "}
            {jwt ? "(live RFID scans)" : "(demo / offline)"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seat layout</CardTitle>
          <CardDescription>Green = RFID onboarded · Red = vacant / not yet scanned</CardDescription>
        </CardHeader>
        <CardContent>
          <SeatBoardingGrid seats={seats} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tap RFID (NFC)</CardTitle>
          <CardDescription>
            Use an NFC-enabled phone to scan a child’s RFID card. This posts to attendance and updates the console.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {isWebNfcSupported()
              ? "Ready: tap a card near the phone."
              : "NFC not supported on this device/browser. Use Android Chrome (HTTPS; localhost is OK)."}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              disabled={!jwt || scanBusy || !isWebNfcSupported()}
              onClick={async () => {
                if (!jwt) return toast.error("Driver session missing");
                setScanBusy(true);
                try {
                  toast.message("Tap the RFID/NFC card on the phone…");
                  const { serialNumber } = await scanOneNfcTagSerialNumber({ timeoutMs: 20000 });
                  const uid = serialNumber.trim();
                  await driverAttendanceScan(jwt, { tagUid: uid, tripType, direction: "on", scannedAt: new Date().toISOString() });
                  toast.success("Scanned (onboard)");
                  refresh();
                } catch (e: any) {
                  toast.error(e?.message || "NFC scan failed");
                } finally {
                  setScanBusy(false);
                }
              }}
            >
              {scanBusy ? "Tap card…" : "Scan onboard"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!jwt || scanBusy}
              onClick={async () => {
                if (!jwt) return toast.error("Driver session missing");
                // If NFC isn't supported, use manual verification flow (mark onboard) for unscanned children.
                if (!isWebNfcSupported()) {
                  setManualOpen(true);
                  return;
                }
                setScanBusy(true);
                try {
                  toast.message("Tap the RFID/NFC card on the phone…");
                  const { serialNumber } = await scanOneNfcTagSerialNumber({ timeoutMs: 20000 });
                  const uid = serialNumber.trim();
                  await driverAttendanceScan(jwt, { tagUid: uid, tripType, direction: "off", scannedAt: new Date().toISOString() });
                  toast.success("Scanned (offboard)");
                  refresh();
                } catch (e: any) {
                  toast.error(e?.message || "NFC scan failed");
                } finally {
                  setScanBusy(false);
                }
              }}
            >
              {isWebNfcSupported() ? "Scan offboard" : "Manual verify"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {manualOpen ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manual verify (no NFC)</CardTitle>
            <CardDescription>Select a child who is not scanned yet to mark as verified.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-sm text-muted-foreground">{unverified.length} not scanned</div>
              <Button type="button" variant="outline" size="sm" onClick={() => setManualOpen(false)} disabled={scanBusy}>
                Close
              </Button>
            </div>
            {unverified.length === 0 ? (
              <p className="text-sm text-muted-foreground">Everyone is already verified.</p>
            ) : (
              <div className="space-y-2">
                {unverified.map((c) => (
                  <Button
                    key={c.id}
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                    disabled={!jwt || scanBusy}
                    onClick={async () => {
                      if (!jwt) return;
                      setScanBusy(true);
                      try {
                        await driverAttendanceManual(jwt, {
                          studentId: c.id,
                          tripType,
                          direction: "on",
                          scannedAt: new Date().toISOString(),
                        });
                        toast.success(`Verified: ${c.childName}`);
                        refresh();
                      } catch (e: any) {
                        toast.error(e?.message || "Manual verify failed");
                      } finally {
                        setScanBusy(false);
                      }
                    }}
                  >
                    <span className="truncate">{c.childName}</span>
                    <span className="text-xs text-muted-foreground">Mark verified</span>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assigned children</CardTitle>
          <CardDescription>
            Shows each child assigned to this bus. Verified = RFID scanned onboarded for this {tripType} trip today.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {children.length === 0 ? (
            <p className="text-sm text-muted-foreground">No children assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {children.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.childName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Parent: {c.parentEmail}
                      {c.address ? ` · ${c.address}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {c.onboarded ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        Verified
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not scanned</span>
                    )}
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
