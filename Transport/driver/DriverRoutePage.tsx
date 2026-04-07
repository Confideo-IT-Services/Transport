import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPlaceholder } from "@transport/components/MapPlaceholder";
import { RouteCheckpointTimeline } from "@transport/components/RouteCheckpointTimeline";
import { getDriverJwt, getDriverSession, resolveDriverBusId } from "@transport/driverSession";
import {
  calculateTransportRouteLineWithJwt,
  fetchDriverProfile,
  fetchMyTrackerPosition,
  publishTrackerPosition,
  type DriverProfileDto,
} from "@transport/lib/transportApi";
import { getBusById, getRouteById } from "@transport/mock/mockStore";
import { getTripState, type TripType } from "@transport/mock/driverTripStore";
import { toast } from "sonner";
import type { RouteStop } from "@transport/types";

function mapApiStopsToRouteStops(stops: DriverProfileDto["morningStops"]): RouteStop[] {
  return (stops || []).map((s, i) => ({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    order: s.sequenceOrder ?? i + 1,
  }));
}

export default function DriverRoutePage() {
  const session = getDriverSession();
  const jwt = getDriverJwt();
  const useMock = Boolean(session?.mockDriverId ?? (session?.driverId.startsWith("drv-") ? session.driverId : undefined));
  const [tripType, setTripType] = useState<TripType>("morning");
  const busId = session ? resolveDriverBusId(session) : undefined;
  const driverId = session?.driverId ?? "";

  const [apiProfile, setApiProfile] = useState<DriverProfileDto | null>(null);
  const [loading, setLoading] = useState(Boolean(jwt && !useMock));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [routeLine, setRouteLine] = useState<[number, number][] | null>(null);
  const [livePos, setLivePos] = useState<{ lng: number; lat: number; sampleTime?: string | null } | null>(null);
  const geoDeniedToastShownRef = useRef(false);
  const lastSentAtRef = useRef<number>(0);
  const inFlightRef = useRef(false);

  const trip = useMemo(() => (driverId ? getTripState(driverId, tripType) : null), [driverId, tripType]);

  useEffect(() => {
    if (!jwt || useMock) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchDriverProfile(jwt)
      .then((d) => {
        if (!cancelled) setApiProfile(d);
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e.message || "Could not load route");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jwt, useMock]);

  useEffect(() => {
    let cancelled = false;
    setRouteLine(null);
    if (!apiProfile) return;
    const rawStops = tripType === "evening" ? apiProfile.eveningStops : apiProfile.morningStops;
    const stops = (rawStops || []).map((s) => ({ lat: s.lat, lng: s.lng }));
    if (stops.length < 2) return;
    calculateTransportRouteLineWithJwt(stops, jwt)
      .then((d) => {
        if (!cancelled) setRouteLine(d.lineString || null);
      })
      .catch(() => {
        if (!cancelled) setRouteLine(null);
      });
    return () => {
      cancelled = true;
    };
  }, [apiProfile, jwt, tripType]);

  useEffect(() => {
    if (!jwt || useMock) return;
    let cancelled = false;
    setLivePos(null);

    const tick = async () => {
      try {
        const p = await fetchMyTrackerPosition(jwt);
        if (cancelled) return;
        setLivePos({ lng: p.lng, lat: p.lat, sampleTime: p.sampleTime });
      } catch {
        if (!cancelled) setLivePos(null);
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [jwt, useMock]);

  // Publish GPS while trip is active (so live marker works even when driver is on this page).
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
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [jwt, trip?.status, tripType]);

  const mockData = useMemo(() => {
    if (!useMock) return null;
    const busId = session ? resolveDriverBusId(session) : undefined;
    const bus = busId ? getBusById(busId) : undefined;
    const route = bus ? getRouteById(bus.routeId) : undefined;
    const stops = route?.stops ?? [];
    return { bus, route, stops };
  }, [session, useMock]);

  const { title, stops, currentStopIndex, busLabel, mapDescription } = useMemo(() => {
    if (apiProfile) {
      const rawStops = tripType === "evening" ? apiProfile.eveningStops : apiProfile.morningStops;
      const s = mapApiStopsToRouteStops(rawStops);
      const bus = apiProfile.busName || "Bus";
      const routeName =
        tripType === "evening"
          ? apiProfile.eveningRouteName || "Evening route"
          : apiProfile.morningRouteName || "Morning route";
      return {
        title: `${bus} · ${routeName}`,
        stops: s,
        currentStopIndex: 0,
        busLabel: bus,
        mapDescription: "Amazon Location map with route checkpoints.",
      };
    }
    if (mockData?.bus && mockData.route) {
      return {
        title: `${mockData.bus.label} · ${mockData.route.name}`,
        stops: mockData.stops,
        currentStopIndex: mockData.bus.currentStopIndex,
        busLabel: mockData.bus.label,
        mapDescription: "Amazon Location map with route checkpoints (demo).",
      };
    }
    return {
      title: "",
      stops: [] as RouteStop[],
      currentStopIndex: 0,
      busLabel: "",
      mapDescription: "",
    };
  }, [apiProfile, mockData, tripType]);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading route…</p>;
  }

  if (loadError && !apiProfile && !useMock) {
    return <p className="text-destructive text-sm">{loadError}</p>;
  }

  if (!stops.length) {
    return <p className="text-muted-foreground">No route assigned.</p>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Route &amp; map</h1>
        <p className="text-muted-foreground text-sm mt-1">{title}</p>
      </div>

      {!useMock && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={tripType === "morning" ? "default" : "outline"}
            onClick={() => setTripType("morning")}
          >
            Morning route
          </Button>
          <Button
            type="button"
            variant={tripType === "evening" ? "default" : "outline"}
            onClick={() => setTripType("evening")}
          >
            Evening route
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checkpoints</CardTitle>
          <CardDescription>Morning trip order (evening uses the same stops in reverse).</CardDescription>
        </CardHeader>
        <CardContent>
          <RouteCheckpointTimeline
            stops={stops}
            currentStopIndex={currentStopIndex}
            busLabel={busLabel}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Map</CardTitle>
          <CardDescription>{mapDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <MapPlaceholder
            stops={stops}
            currentStopIndex={currentStopIndex}
            routeLineString={routeLine ?? undefined}
            livePosition={
              livePos ? { lng: livePos.lng, lat: livePos.lat, label: livePos.sampleTime ? `Live · ${livePos.sampleTime}` : "Live" } : null
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
