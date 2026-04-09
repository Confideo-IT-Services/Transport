import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCircle, Bus, ScanLine } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { MapPlaceholder } from "@transport/components/MapPlaceholder";
import {
  calculateTransportRouteLine,
  fetchTodayTripStatuses,
  fetchTransportDrivers,
  fetchTransportRoutesWithStops,
  fetchTrackerPosition,
  type TodayTripStatusDto,
  type TransportDriverDto,
  type TransportRouteWithStopsDto,
} from "@transport/lib/transportApi";
import type { RouteStop } from "@transport/types";

export default function TransportDashboard() {
  const [drivers, setDrivers] = useState<TransportDriverDto[]>([]);
  const [routes, setRoutes] = useState<TransportRouteWithStopsDto[]>([]);
  const [todayTrips, setTodayTrips] = useState<{ tripDate: string; trips: TodayTripStatusDto[] } | null>(null);
  const [loadingMap, setLoadingMap] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingMap(true);
    setMapError(null);
    Promise.all([fetchTransportDrivers(), fetchTransportRoutesWithStops(), fetchTodayTripStatuses()])
      .then(([d, r, t]) => {
        if (cancelled) return;
        setDrivers(d);
        setRoutes(r);
        setTodayTrips(t);
      })
      .catch((e) => {
        if (!cancelled) setMapError(e instanceof Error ? e.message : "Failed to load routes/drivers");
      })
      .finally(() => {
        if (!cancelled) setLoadingMap(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const assigned = useMemo(() => {
    // Each driver may have morning + evening route. We show route polylines by route ID.
    const rows: Array<{
      key: string;
      driver: TransportDriverDto;
      tripType: "morning" | "evening";
      routeId: string;
      routeName: string;
      busLabel: string;
      stops: RouteStop[];
    }> = [];

    const routeById = new Map<string, TransportRouteWithStopsDto>();
    for (const r of routes) routeById.set(r.id, r);

    for (const d of drivers) {
      const busLabel = d.busName || (d.busId ? `Bus (${d.busId.slice(0, 8)}…)` : "Unassigned bus");
      const add = (tripType: "morning" | "evening", routeId: string | null, routeName: string | null) => {
        if (!routeId) return;
        const r = routeById.get(routeId);
        const stops = (r?.stops || []).map((s, i) => ({
          id: s.id,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          order: s.sequenceOrder ?? i + 1,
        }));
        if (stops.length < 2) return;
        rows.push({
          key: `${d.id}:${tripType}:${routeId}`,
          driver: d,
          tripType,
          routeId,
          routeName: routeName || r?.name || "Route",
          busLabel,
          stops,
        });
      };
      add("morning", d.morningRouteId, d.morningRouteName);
      add("evening", d.eveningRouteId, d.eveningRouteName);
    }
    return rows;
  }, [drivers, routes]);

  const [selectedKey, setSelectedKey] = useState<string>("");
  useEffect(() => {
    if (!selectedKey && assigned.length) setSelectedKey(assigned[0].key);
  }, [assigned.length, selectedKey]);

  const ALL_KEY = "__all__";
  const selected = useMemo(
    () => (selectedKey === ALL_KEY ? null : assigned.find((x) => x.key === selectedKey) || null),
    [assigned, selectedKey],
  );
  const allSelected = selectedKey === ALL_KEY;

  const [progress, setProgress] = useState(0); // 0..100
  const lastRef = useRef<{ at: number; p: number } | null>(null);

  const segmentKm = useMemo(() => {
    if (!selected) return [];
    const pts = selected.stops;
    const R = 6371000;
    const toRad = (n: number) => (n * Math.PI) / 180;
    const out: number[] = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const s1 = Math.sin(dLat / 2);
      const s2 = Math.sin(dLng / 2);
      const c =
        2 *
        Math.asin(
          Math.min(
            1,
            Math.sqrt(s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2),
          ),
        );
      out.push((R * c) / 1000);
    }
    return out;
  }, [selected]);

  const totalKm = useMemo(() => segmentKm.reduce((a, b) => a + b, 0), [segmentKm]);

  const segmentSpeedKmh = useMemo(() => {
    // Heuristic from your rule: short hop between pickup points -> 20 km/h, longer gap -> 35 km/h.
    // Threshold 5 km.
    return segmentKm.map((km) => (km <= 5 ? 20 : 35));
  }, [segmentKm]);

  const statusForSelected = useMemo(() => {
    if (!todayTrips || !selected) return null;
    const busId = selected.driver.busId;
    if (!busId) return null;
    const hit = todayTrips.trips.find((t) => t.busId === busId && t.tripType === selected.tripType);
    return hit?.status || null;
  }, [todayTrips, selected]);

  const statusByBusAndType = useMemo(() => {
    const m = new Map<string, "idle" | "active" | "ended">();
    for (const t of todayTrips?.trips || []) {
      m.set(`${t.busId}:${t.tripType}`, t.status);
    }
    return m;
  }, [todayTrips]);

  const [gpsPos, setGpsPos] = useState<{ lng: number; lat: number; sampleTime?: string | null } | null>(null);
  const [gpsSpeedKmh, setGpsSpeedKmh] = useState<number | null>(null);
  const lastGpsRef = useRef<{ atMs: number; lng: number; lat: number } | null>(null);

  // Road-following polyline for the selected route
  const [roadLine, setRoadLine] = useState<[number, number][] | null>(null);
  const [roadMeta, setRoadMeta] = useState<{ distanceKm: number | null; durationMin: number | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setRoadLine(null);
    setRoadMeta(null);
    if (!selected || selected.stops.length < 2) return;
    const stops = selected.stops.map((s) => ({ lat: s.lat, lng: s.lng }));
    calculateTransportRouteLine(stops)
      .then((d) => {
        if (cancelled) return;
        setRoadLine(d.lineString || null);
        setRoadMeta({
          distanceKm: d.distanceMeters != null ? d.distanceMeters / 1000 : null,
          durationMin: d.durationSeconds != null ? Math.round(d.durationSeconds / 60) : null,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setRoadLine(null);
          setRoadMeta(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedKey]); // only when route selection changes

  // Live GPS tracking for the selected route (admin view).
  useEffect(() => {
    if (!selected || !selected.driver.busId) {
      setGpsPos(null);
      setGpsSpeedKmh(null);
      lastGpsRef.current = null;
      return;
    }
    let cancelled = false;
    const busId = selected.driver.busId;

    const tick = async () => {
      try {
        const p = await fetchTrackerPosition(busId);
        if (cancelled) return;
        setGpsPos({ lng: p.lng, lat: p.lat, sampleTime: p.sampleTime });
        const now = Date.now();
        const prev = lastGpsRef.current;
        if (prev) {
          const dt = Math.max(1, (now - prev.atMs) / 1000);
          const d = haversineMeters({ lat: prev.lat, lng: prev.lng }, { lat: p.lat, lng: p.lng });
          const kmh = Math.min(130, (d / dt) * 3.6);
          setGpsSpeedKmh(kmh < 1.5 ? 0 : kmh);
        }
        lastGpsRef.current = { atMs: now, lng: p.lng, lat: p.lat };
      } catch {
        // Ignore; keep last known GPS if any.
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [selectedKey]);

  const shortLabel = (name: string) => {
    const s = String(name || "").trim();
    if (!s) return "—";
    const idx = s.indexOf(",");
    return idx > 0 ? s.slice(0, idx) : s;
  };

  const haversineMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 6371000;
    const toRad = (n: number) => (n * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLng / 2);
    const c =
      2 *
      Math.asin(
        Math.min(1, Math.sqrt(s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2)),
      );
    return R * c;
  };

  const pointAlongLine = (line: [number, number][], t01: number): { lng: number; lat: number } | null => {
    if (!Array.isArray(line) || line.length < 2) return null;
    const t = Math.max(0, Math.min(1, t01));
    const pts = line.map(([lng, lat]) => ({ lng: Number(lng), lat: Number(lat) }));
    const seg: number[] = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = haversineMeters(pts[i - 1], pts[i]);
      seg.push(d);
      total += d;
    }
    if (!total) return pts[0] || null;
    const target = total * t;
    let acc = 0;
    for (let i = 0; i < seg.length; i++) {
      const d = seg[i] || 0;
      if (acc + d >= target) {
        const local = d ? (target - acc) / d : 0;
        const a = pts[i];
        const b = pts[i + 1];
        return { lng: a.lng + (b.lng - a.lng) * local, lat: a.lat + (b.lat - a.lat) * local };
      }
      acc += d;
    }
    return pts[pts.length - 1] || null;
  };

  const [allLines, setAllLines] = useState<
    Array<{ id: string; lineString: [number, number][]; color?: string; label?: string }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    if (!allSelected) {
      setAllLines([]);
      return;
    }
    const colors = ["#1d4ed8", "#059669", "#b91c1c", "#7c3aed", "#0f766e", "#b45309", "#0ea5e9", "#9333ea"];

    const run = async () => {
      const tasks = assigned.slice(0, 12).map(async (a, i) => {
        const out = await calculateTransportRouteLine(a.stops.map((s) => ({ lat: s.lat, lng: s.lng })));
        const ls = out.lineString || [];
        return { id: a.key, lineString: ls, color: colors[i % colors.length], label: `${a.busLabel} — ${a.routeName}` };
      });
      const settled = await Promise.allSettled(tasks);
      if (cancelled) return;
      const ok = settled
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map((r) => r.value)
        .filter((x) => Array.isArray(x.lineString) && x.lineString.length >= 2);
      setAllLines(ok);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [allSelected, assigned]);

  const [allLivePositions, setAllLivePositions] = useState<Array<{ id: string; lng: number; lat: number; label?: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    if (!allSelected) {
      setAllLivePositions([]);
      return;
    }
    const busIds = Array.from(new Set(assigned.map((a) => a.driver.busId).filter(Boolean))) as string[];
    if (!busIds.length) return;

    const fallbackByBusId = new Map<string, { lng: number; lat: number; label: string }>();
    for (const a of assigned) {
      const bid = a.driver.busId;
      if (!bid) continue;
      const first = a.stops?.[0];
      if (!first) continue;
      if (!fallbackByBusId.has(bid)) {
        fallbackByBusId.set(bid, { lng: first.lng, lat: first.lat, label: a.busLabel });
      }
    }

    const tick = async () => {
      const res = await Promise.allSettled(
        busIds.map(async (busId) => {
          try {
            const p = await fetchTrackerPosition(busId);
            return { id: busId, lng: p.lng, lat: p.lat, label: fallbackByBusId.get(busId)?.label || `Bus ${busId.slice(0, 6)}…` };
          } catch {
            const fb = fallbackByBusId.get(busId);
            if (!fb) throw new Error("no fallback");
            return { id: busId, lng: fb.lng, lat: fb.lat, label: fb.label };
          }
        }),
      );
      if (cancelled) return;
      const ok = res
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map((r) => r.value);
      setAllLivePositions(ok);
    };

    void tick();
    const id = window.setInterval(() => void tick(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [allSelected, assigned]);

  // Auto-advance when trip is active (simple simulation).
  useEffect(() => {
    if (!selected) return;
    if (statusForSelected !== "active") return;
    let raf: number | null = null;
    let last = Date.now();

    const tick = () => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;

      // Determine current segment speed based on where we are.
      const segCount = Math.max(1, selected.stops.length - 1);
      const t = Math.max(0, Math.min(1, progress / 100));
      const idx = Math.min(segCount - 1, Math.floor(t * segCount));
      const kmh = segmentSpeedKmh[idx] ?? 20;
      const kmPerSec = kmh / 3600;
      const delta = totalKm > 0 ? (kmPerSec * dt * 100) / totalKm : 0;

      setProgress((p) => Math.min(100, p + delta));
      raf = window.setTimeout(tick, 250) as unknown as number;
    };

    raf = window.setTimeout(tick, 500) as unknown as number;
    return () => {
      if (raf != null) window.clearTimeout(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusForSelected, selectedKey, totalKm, segmentSpeedKmh]);

  const livePosition = useMemo(() => {
    if (!selected || selected.stops.length < 2) return null;
    const t = Math.max(0, Math.min(1, progress / 100));
    // Prefer real GPS when available, else simulate along road polyline.
    const p = gpsPos
      ? { lng: gpsPos.lng, lat: gpsPos.lat }
      : roadLine && roadLine.length >= 2
        ? pointAlongLine(roadLine, t)
        : null;
    const fallback = selected.stops;
    const idx = Math.min(fallback.length - 2, Math.floor(t * (fallback.length - 1)));
    const localT = t * (fallback.length - 1) - idx;
    const a = fallback[idx];
    const b = fallback[idx + 1];
    const lat = p?.lat ?? a.lat + (b.lat - a.lat) * localT;
    const lng = p?.lng ?? a.lng + (b.lng - a.lng) * localT;
    // show segment speed by rule
    const kmh = gpsSpeedKmh != null ? gpsSpeedKmh : (segmentSpeedKmh[idx] ?? 20);
    return { lng, lat, label: `${selected.busLabel} · ${kmh.toFixed(0)} km/h` };
  }, [selected, progress, segmentSpeedKmh, roadLine, gpsPos, gpsSpeedKmh]);

  const onProgress = (value: number[]) => {
    const p = value[0] ?? 0;
    const now = Date.now();
    const prev = lastRef.current;
    lastRef.current = { at: now, p };
    setProgress(p);
  };

  const parents = 0;
  const buses = useMemo(() => new Set(drivers.map((d) => d.busId).filter(Boolean)).size, [drivers]);
  const driverCount = drivers.length;

  const cards = [
    {
      title: "Parents & children",
      description: "Register bus travel, assign children to buses.",
      href: "/transport/parents",
      icon: Users,
      stat: `${parents} registered`,
    },
    {
      title: "Drivers",
      description: "Add drivers and assign bus + route.",
      href: "/transport/drivers",
      icon: UserCircle,
      stat: `${driverCount} drivers`,
    },
    {
      title: "Buses & routes",
      description: "Fleet, routes, pickup/drop, live position (mock).",
      href: "/transport/buses",
      icon: Bus,
      stat: `${buses} buses`,
    },
    {
      title: "Attendance (RFID)",
      description: "Per-bus seat board status (green / red).",
      href: "/transport/attendance",
      icon: ScanLine,
      stat: "RFID scan UI",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transport overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage parents, drivers, buses, routes, and RFID boarding from this console.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ title, description, href, icon: Icon, stat }) => (
          <Link key={href} to={href} className="block group">
            <Card className="h-full transition-shadow hover:shadow-md border-emerald-600/15 hover:border-emerald-600/30">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="rounded-lg bg-emerald-600/10 p-2 text-emerald-700 dark:text-emerald-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs text-muted-foreground">{stat}</span>
                </div>
                <CardTitle className="text-lg group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                  {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Open →</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Drivers use a separate app:{" "}
        <Link to="/transport/driver/login" className="text-emerald-700 dark:text-emerald-400 underline font-medium">
          Open driver login
        </Link>
      </p>

      <Card className="border-emerald-600/10">
        <CardHeader>
          <CardTitle className="text-base">Fleet map (overview)</CardTitle>
          <CardDescription>
            Select a route. The line shows segment distances and suggested speeds (demo). If the trip is active, the bus auto-moves.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mapError ? <p className="text-sm text-destructive">{mapError}</p> : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">Selected · </span>
              <span className="font-medium">
                {selected ? `${selected.busLabel} — ${selected.routeName} (${selected.tripType})` : "—"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {assigned.length} assigned route{assigned.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Routes</label>
              <div className="flex gap-2">
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                  disabled={loadingMap || assigned.length === 0}
                >
                  {assigned.length === 0 ? <option value="">No assigned routes yet</option> : null}
                  {assigned.length > 0 ? <option value={ALL_KEY}>ALL (show every route)</option> : null}
                  {assigned.map((x) => (
                    <option key={x.key} value={x.key}>
                      {x.busLabel} — {x.routeName} ({x.tripType})
                    </option>
                  ))}
                </select>
              </div>
              {!allSelected && selected ? (
                <p className="text-xs text-muted-foreground">
                  {selected.stops[0]?.name} → {selected.stops[selected.stops.length - 1]?.name} · {selected.stops.length} stops ·{" "}
                  <span className="font-medium text-foreground">
                    {(roadMeta?.distanceKm ?? totalKm).toFixed(1)} km
                  </span>
                  {statusForSelected ? (
                    <span className="ml-2 text-muted-foreground">
                      · status: <span className="font-medium text-foreground">{statusForSelected}</span>
                    </span>
                  ) : null}
                </p>
              ) : allSelected ? (
                <p className="text-xs text-muted-foreground">
                  Showing {allLines.length || assigned.length} route line{(allLines.length || assigned.length) === 1 ? "" : "s"}.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Route line</label>
              {!allSelected && selected ? (
                <div className="rounded-lg border bg-muted/30 px-3 py-3 space-y-3">
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="text-muted-foreground">Bus</div>
                      <div className="font-semibold truncate">{selected.busLabel}</div>
                      <div className="text-xs text-muted-foreground">
                        Speed:{" "}
                        <span className="font-medium text-foreground">
                          {(gpsSpeedKmh != null ? gpsSpeedKmh : (segmentSpeedKmh[0] ?? 20)).toFixed(0)} km/h
                        </span>
                        {gpsPos?.sampleTime ? <span className="ml-2">· GPS</span> : <span className="ml-2">· demo</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-muted-foreground">Total</div>
                      <div className="font-semibold">{(roadMeta?.distanceKm ?? totalKm).toFixed(1)} km</div>
                    </div>
                  </div>

                  {/* Vertical timeline (matches your sketch) */}
                  <div className="relative pl-5">
                    <div className="absolute left-2 top-2 bottom-2 w-[2px] bg-emerald-600/40" />
                    <div className="space-y-4">
                      {selected.stops.map((s, i) => {
                        const segKm = i < selected.stops.length - 1 ? segmentKm[i] : null;
                        const segSpeed = i < selected.stops.length - 1 ? segmentSpeedKmh[i] : null;
                        return (
                          <div key={`${s.id}-${i}`} className="relative grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
                            <div className="absolute -left-[2px] top-1 h-4 w-4 rounded-full border-2 border-emerald-600 bg-background" />
                            <div className="ml-2 min-w-0">
                              <div className="text-xs font-semibold break-words leading-snug" title={s.name}>
                                {i === 0
                                  ? `Start: ${shortLabel(s.name)}`
                                  : i === selected.stops.length - 1
                                    ? `End: ${shortLabel(s.name)}`
                                    : shortLabel(s.name)}
                              </div>
                              {segKm != null && segSpeed != null ? (
                                <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                                  → {segKm.toFixed(1)} km · {segSpeed} km/h
                                </div>
                              ) : null}
                            </div>
                            <div className="text-[11px] text-muted-foreground whitespace-nowrap pt-0.5">
                              {i + 1}/{selected.stops.length}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Total distance: <span className="font-medium text-foreground">{(roadMeta?.distanceKm ?? totalKm).toFixed(1)} km</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Move bus (demo)</span>
                      <span>{progress.toFixed(0)}%</span>
                    </div>
                    <Slider value={[progress]} min={0} max={100} step={1} onValueChange={onProgress} />
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                  Select a single route to see the detailed stop-by-stop line.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <MapPlaceholder
              stops={allSelected ? [] : selected?.stops || []}
              currentStopIndex={0}
              routeLineString={allSelected ? undefined : roadLine ?? undefined}
              livePosition={allSelected ? null : livePosition}
              multiRoutes={allSelected ? allLines : undefined}
              multiLivePositions={allSelected ? allLivePositions : undefined}
              minHeight={340}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
