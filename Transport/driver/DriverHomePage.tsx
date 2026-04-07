import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Square, Bell, History } from "lucide-react";
import { getDriverJwt, getDriverSession, resolveDriverBusId } from "@transport/driverSession";
import {
  getTripState,
  startDriverTrip,
  endDriverTrip,
  getRecentNotifyEvents,
  getTripHistoryForDriverAndType,
  type TripType,
} from "@transport/mock/driverTripStore";
import { toast } from "sonner";
import { format } from "date-fns";
import { driverEndTrip, driverStartTrip, publishTrackerPosition } from "@transport/lib/transportApi";

export default function DriverHomePage() {
  const session = getDriverSession();
  const driverId = session?.driverId ?? "";
  const busId = session ? resolveDriverBusId(session) : undefined;
  const busCapacity = session?.busCapacity ?? 30;
  const busLabel = session?.busName || (busId ? `Bus (${busId.slice(0, 8)}…)` : "");

  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const [tripType, setTripType] = useState<TripType>("morning");
  const trip = useMemo(() => (driverId ? getTripState(driverId, tripType) : null), [driverId, tripType, tick]);
  const jwt = useMemo(() => (session?.token ? getDriverJwt() : null), [session?.token]);
  const geoDeniedToastShownRef = useRef(false);
  const lastSentAtRef = useRef<number>(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!jwt) return;
    if (!trip || trip.status !== "active") return;
    if (!navigator.geolocation) return;

    geoDeniedToastShownRef.current = false;
    lastSentAtRef.current = 0;
    inFlightRef.current = false;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        // Simple cost control: at most one publish per 10s (tracker itself has its own filtering too).
        if (now - lastSentAtRef.current < 10_000) return;
        if (inFlightRef.current) return;
        lastSentAtRef.current = now;
        inFlightRef.current = true;

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracyMeters = pos.coords.accuracy;
        const sampleTime = new Date(pos.timestamp).toISOString();

        publishTrackerPosition(jwt, { lat, lng, accuracyMeters, sampleTime })
          .catch((e) => {
            console.error("tracker publish failed:", e);
          })
          .finally(() => {
            inFlightRef.current = false;
          });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED && !geoDeniedToastShownRef.current) {
          geoDeniedToastShownRef.current = true;
          toast.error("Location permission denied. Enable GPS to share live bus location.");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 15_000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [jwt, trip?.status, tripType, driverId]);

  const notifyEvents = useMemo(
    () => (driverId ? getRecentNotifyEvents(driverId, 6) : []),
    [driverId, tick],
  );

  const history = useMemo(() => {
    if (!driverId) return [];
    return getTripHistoryForDriverAndType(driverId, tripType, 5);
  }, [driverId, tripType, tick]);

  const seats = useMemo(() => {
    const out: { seatNumber: number; boarded: boolean; childName?: string }[] = [];
    for (let i = 1; i <= busCapacity; i++) {
      const boarded = i <= Math.max(1, Math.floor(busCapacity * 0.65));
      out.push({ seatNumber: i, boarded });
    }
    return out;
  }, [busCapacity, tick]);

  const onStartTrip = () => {
    if (!busId || !driverId) return;
    if (trip?.status === "ended") {
      toast.message("This trip already ended today. Come back tomorrow.");
      return;
    }
    if (trip?.status === "active") {
      toast.message("Trip already started.");
      return;
    }
    const { event } = startDriverTrip(driverId, busId, 0, tripType);
    if (jwt) {
      driverStartTrip(jwt, tripType).catch((e) => {
        console.error("driverStartTrip failed:", e);
        toast.error(`Could not sync start trip to server: ${e instanceof Error ? e.message : "Unknown error"}`);
      });
    } else {
      toast.error("Driver JWT missing — cannot sync start trip to server. Please sign out and sign in again.");
    }
    toast.success(
      `Parents notified (demo): ${event.parentCount} famil${event.parentCount === 1 ? "y" : "ies"} — bus is starting pickup, get ready.`,
    );
    refresh();
  };

  const onEndTour = () => {
    if (!busId || !driverId) return;
    if (trip?.status !== "active") {
      toast.message("Start the trip first before ending the tour.");
      return;
    }
    const { summary } = endDriverTrip(driverId, busId, busCapacity, seats, tripType);
    if (jwt) {
      driverEndTrip(jwt, tripType).catch((e) => {
        console.error("driverEndTrip failed:", e);
        toast.error(`Could not sync end trip to server: ${e instanceof Error ? e.message : "Unknown error"}`);
      });
    } else {
      toast.error("Driver JWT missing — cannot sync end trip to server. Please sign out and sign in again.");
    }
    toast.success(
      `Tour ended. Today's run saved (demo): ${summary.boardedApprox} / ${summary.capacity} seats on record.`,
    );
    refresh();
  };

  if (!busId || !trip) {
    return (
      <p className="text-muted-foreground">Could not load your assignment. Sign out and try again.</p>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Today&apos;s trips</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Each driver has two trips: <strong>morning pickup</strong> and <strong>evening drop</strong>. Start and end
          each trip separately.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={tripType === "morning" ? "default" : "outline"}
          onClick={() => setTripType("morning")}
        >
          Morning trip
        </Button>
        <Button
          type="button"
          variant={tripType === "evening" ? "default" : "outline"}
          onClick={() => setTripType("evening")}
        >
          Evening trip
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground">Status:</span>
        {trip.status === "idle" && (
          <Badge variant="secondary">Not started</Badge>
        )}
        {trip.status === "active" && (
          <Badge className="bg-emerald-600">Trip in progress</Badge>
        )}
        {trip.status === "ended" && (
          <Badge variant="outline" className="border-amber-600/50 text-amber-800 dark:text-amber-300">
            Tour ended for {trip.date}
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Trip actions</CardTitle>
          <CardDescription>
            <span className="block sm:inline">
              <strong>Start trip</strong> — morning pickup; parents get a &quot;get ready&quot; notice (demo).
            </span>{" "}
            <span className="block sm:inline mt-1 sm:mt-0">
              <strong>End tour</strong> — evening; closes today&apos;s run and saves attendance (demo).
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Bus: <strong className="text-foreground">{busLabel}</strong>
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <button
              type="button"
              onClick={onStartTrip}
              disabled={trip.status === "active" || trip.status === "ended"}
              style={{ backgroundColor: "#059669", color: "#ffffff" }}
              className="inline-flex min-h-[52px] w-full flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-base font-semibold shadow-md transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40 sm:min-w-[140px]"
            >
              <Play className="h-5 w-5 shrink-0" aria-hidden />
              Start trip
            </button>
            <button
              type="button"
              onClick={onEndTour}
              disabled={trip.status !== "active"}
              style={{ backgroundColor: "#059669", color: "#ffffff" }}
              className="inline-flex min-h-[52px] w-full flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-base font-semibold shadow-md transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40 sm:min-w-[140px]"
            >
              <Square className="h-5 w-5 shrink-0" aria-hidden />
              End tour
            </button>
          </div>

          {(trip.startedAt || trip.endedAt) && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground pt-1 border-t">
              {trip.startedAt && <span>Started: {format(new Date(trip.startedAt), "PPp")}</span>}
              {trip.endedAt && <span>Ended: {format(new Date(trip.endedAt), "PPp")}</span>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Recent notifications (demo)
          </CardTitle>
          <CardDescription>What parents would receive via SMS/WhatsApp when integrated.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifyEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet today.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {notifyEvents.map((e) => (
                <li key={e.id} className="rounded-md border p-3 bg-muted/30">
                  <div className="flex justify-between gap-2 text-xs text-muted-foreground mb-1">
                    <span>{e.kind === "trip_start" ? "Trip start" : "Trip end"}</span>
                    <span>{format(new Date(e.at), "HH:mm")}</span>
                  </div>
                  <p>{e.message}</p>
                  {e.parentCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {e.parentCount} parent contact{e.parentCount === 1 ? "" : "s"}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Completed runs (demo)
          </CardTitle>
          <CardDescription>End tour saves one row per day for your bus.</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed tours logged yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex justify-between gap-4 border-b pb-2 last:border-0">
                  <span>
                    {h.date} · boarded ~{h.boardedApprox} / {h.capacity}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {h.endedAt ? format(new Date(h.endedAt), "HH:mm") : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
