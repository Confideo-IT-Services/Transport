import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { withIdentityPoolId } from "@aws/amazon-location-utilities-auth-helper";
import type { RouteStop } from "@transport/types";
import {
  buildMapStyleDescriptorUrl,
  buildMapsV2StyleDescriptorUrl,
  resolveLocationMapConfig,
} from "@transport/lib/awsLocationConfig";
import { getTransportApiBase, reverseGeocodeTransport } from "@transport/lib/transportApi";
import { cn } from "@/lib/utils";
import { getDriverJwt, getDriverSession } from "@transport/driverSession";

/** Append API key to every Amazon Location request (browser → AWS). */
function transformRequestWithApiKey(apiKey: string) {
  return (url: string, _resourceType?: maplibregl.ResourceType | undefined) => {
    if (!url.includes("maps.geo.") || !url.includes("amazonaws.com")) {
      return { url };
    }
    try {
      const u = new URL(url);
      u.searchParams.set("key", apiKey);
      return { url: u.toString() };
    } catch {
      const sep = url.includes("?") ? "&" : "?";
      return { url: `${url}${sep}key=${encodeURIComponent(apiKey)}` };
    }
  };
}

/** Route tile requests through ConventPulse API so the key is applied on the server (fixes many 403s from referrer rules). */
function transformRequestWithProxy(apiBase: string) {
  const proxyPath = `${apiBase.replace(/\/$/, "")}/transport/maps-proxy`;
  return (url: string, _resourceType?: maplibregl.ResourceType | undefined) => {
    // MapLibre passes our proxy URL again; the query string still contains "maps.geo" — do not double-wrap (causes 400).
    if (url.includes("/transport/maps-proxy")) {
      return { url };
    }
    if (!url.includes("maps.geo.") || !url.includes("amazonaws.com")) {
      return { url };
    }
    try {
      const u = new URL(url);
      u.searchParams.delete("key");
      const clean = u.toString();
      return { url: `${proxyPath}?u=${encodeURIComponent(clean)}` };
    } catch {
      return { url: `${proxyPath}?u=${encodeURIComponent(url)}` };
    }
  };
}

export type AwsLocationMapProps = {
  stops?: RouteStop[];
  currentStopIndex?: number;
  /** If provided, uses this road-snapped geometry instead of connecting stops directly. Coordinates: [lng, lat]. */
  routeLineString?: [number, number][];
  /** If provided, shows a "live" marker (e.g., bus GPS). Coordinates: [lng, lat]. */
  livePosition?: { lng: number; lat: number; label?: string } | null;
  /** Optional: render multiple route polylines at once (ALL view). */
  multiRoutes?: Array<{ id: string; lineString: [number, number][]; color?: string; label?: string }>;
  /** Optional: render multiple live markers at once (ALL view). */
  multiLivePositions?: Array<{ id: string; lng: number; lat: number; label?: string }>;
  className?: string;
  minHeight?: number;
};

const DEFAULT_CENTER: [number, number] = [78.4747, 17.385];

export function AwsLocationMap({
  stops = [],
  currentStopIndex = 0,
  routeLineString,
  livePosition = null,
  multiRoutes,
  multiLivePositions,
  className,
  minHeight = 280,
}: AwsLocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const routeLayersAddedRef = useRef(false);
  const userInteractedRef = useRef(false);
  const fittedForRouteKeyRef = useRef<string>("");
  /** Avoid re-running map init every render: resolveLocationMapConfig() returns a new object each call. */
  const mapConfig = useMemo(() => resolveLocationMapConfig(), []);
  const map403ReportedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const apiKey = (import.meta.env.VITE_AWS_LOCATION_API_KEY as string | undefined)?.trim();
  const identityPoolId = (import.meta.env.VITE_AWS_COGNITO_IDENTITY_POOL_ID as string | undefined)?.trim();
  const proxyFlag = String(import.meta.env.VITE_AWS_LOCATION_USE_MAP_PROXY ?? "").toLowerCase();
  const useMapProxy = proxyFlag === "true" || proxyFlag === "1";
  const apiBase = getTransportApiBase();
  /** v0 = legacy `/maps/v0/maps/{mapName}/style-descriptor` (Cognito/IAM). v2 = `/v2/styles/{Standard,...}/descriptor` (API keys). */
  const mapsApiVersion = String(import.meta.env.VITE_AWS_LOCATION_MAPS_API_VERSION ?? "v2").toLowerCase();
  const useMapsV0 = mapsApiVersion === "v0";
  const mapsV2Style = (import.meta.env.VITE_AWS_LOCATION_MAP_STYLE as string | undefined)?.trim() || "Standard";
  const [hoverLabel, setHoverLabel] = useState<string>("");
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const lastHoverReqRef = useRef<{ lng: number; lat: number } | null>(null);
  const reverseGeocodeBlockedRef = useRef(false);

  const routeGeoJson = useMemo(() => {
    const coords = (routeLineString && routeLineString.length >= 2)
      ? routeLineString
      : stops.map((s) => [s.lng, s.lat] as [number, number]);
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: coords },
        },
      ],
    } as const;
  }, [stops, routeLineString]);

  const multiRoutesGeoJson = useMemo(() => {
    const items = (multiRoutes || []).filter((r) => Array.isArray(r.lineString) && r.lineString.length >= 2);
    return {
      type: "FeatureCollection",
      features: items.map((r) => ({
        type: "Feature",
        properties: { id: r.id, color: r.color || "#1d4ed8" },
        geometry: { type: "LineString", coordinates: r.lineString },
      })),
    } as const;
  }, [multiRoutes]);

  const coveredRouteGeoJson = useMemo(() => {
    // Covered segment should follow the SAME geometry as the base route line.
    // If we have a road-snapped routeLineString, take it from start until the point closest
    // to the current stop (best-effort). Otherwise fall back to stop-to-stop connection.
    const stopEnd = Math.min(stops.length - 1, Math.max(0, currentStopIndex));
    const target = stops[stopEnd] ? { lng: Number(stops[stopEnd].lng), lat: Number(stops[stopEnd].lat) } : null;

    const haversineMeters = (a: { lng: number; lat: number }, b: { lng: number; lat: number }) => {
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

    let coords: [number, number][] = [];
    if (routeLineString && routeLineString.length >= 2 && target) {
      // Find the nearest point index on the polyline to the target stop.
      let bestIdx = 0;
      let bestD = Infinity;
      for (let i = 0; i < routeLineString.length; i++) {
        const pt = routeLineString[i];
        const d = haversineMeters({ lng: pt[0], lat: pt[1] }, target);
        if (d < bestD) {
          bestD = d;
          bestIdx = i;
        }
      }
      coords = routeLineString.slice(0, Math.max(2, bestIdx + 1));
    } else {
      const end = Math.min(stops.length, stopEnd + 1);
      coords = stops.slice(0, end).map((s) => [s.lng, s.lat] as [number, number]);
    }
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: coords },
        },
      ],
    } as const;
  }, [stops, currentStopIndex, routeLineString]);

  const syncMarkers = useCallback(
    (map: maplibregl.Map) => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // NOTE: Do not auto-fit bounds here. This callback runs often (GPS updates, polling),
      // and auto-fit would fight the user's manual zoom/pan. We fit once in a separate effect.

      if (stops.length) {
        stops.forEach((stop, i) => {
          const color = i <= currentStopIndex ? "#059669" : "#94a3b8";
          const marker = new maplibregl.Marker({ color })
            .setLngLat([stop.lng, stop.lat])
            .setPopup(new maplibregl.Popup({ offset: 16 }).setText(stop.name))
            .addTo(map);
          markersRef.current.push(marker);
        });
      }

      if (livePosition && !Number.isNaN(livePosition.lng) && !Number.isNaN(livePosition.lat)) {
        const el = document.createElement("div");
        el.style.width = "34px";
        el.style.height = "34px";
        el.style.borderRadius = "9999px";
        el.style.background = "rgba(255,255,255,0.95)";
        el.style.boxShadow = "0 10px 24px rgba(0,0,0,0.22)";
        el.style.border = "2px solid rgba(239,68,68,0.9)";
        el.style.display = "grid";
        el.style.placeItems = "center";

        // Simple inline "bus" icon (SVG) so we don't need extra assets.
        el.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M7 4h10a3 3 0 0 1 3 3v10a2 2 0 0 1-2 2h-1v1a1 1 0 1 1-2 0v-1H9v1a1 1 0 1 1-2 0v-1H6a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3Z" stroke="#b91c1c" stroke-width="1.6"/>
            <path d="M7 8h10" stroke="#b91c1c" stroke-width="1.6" stroke-linecap="round"/>
            <path d="M7 12h10" stroke="#b91c1c" stroke-width="1.6" stroke-linecap="round"/>
            <circle cx="8.2" cy="17.4" r="1.2" fill="#b91c1c"/>
            <circle cx="15.8" cy="17.4" r="1.2" fill="#b91c1c"/>
          </svg>
        `;

        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([livePosition.lng, livePosition.lat])
          .setPopup(new maplibregl.Popup({ offset: 18 }).setText(livePosition.label || "Live bus position"))
          .addTo(map);
        markersRef.current.push(marker);
      }

      if (multiLivePositions && multiLivePositions.length) {
        multiLivePositions.forEach((p) => {
          if (Number.isNaN(p.lng) || Number.isNaN(p.lat)) return;
          const el = document.createElement("div");
          el.style.width = "30px";
          el.style.height = "30px";
          el.style.borderRadius = "9999px";
          el.style.background = "rgba(255,255,255,0.95)";
          el.style.boxShadow = "0 10px 24px rgba(0,0,0,0.22)";
          el.style.border = "2px solid rgba(16,185,129,0.9)";
          el.style.display = "grid";
          el.style.placeItems = "center";
          el.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M7 4h10a3 3 0 0 1 3 3v10a2 2 0 0 1-2 2h-1v1a1 1 0 1 1-2 0v-1H9v1a1 1 0 1 1-2 0v-1H6a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3Z" stroke="#059669" stroke-width="1.6"/>
              <path d="M7 8h10" stroke="#059669" stroke-width="1.6" stroke-linecap="round"/>
              <circle cx="8.2" cy="17.4" r="1.2" fill="#059669"/>
              <circle cx="15.8" cy="17.4" r="1.2" fill="#059669"/>
            </svg>
          `;
          const marker = new maplibregl.Marker({ element: el, anchor: "center" })
            .setLngLat([p.lng, p.lat])
            .setPopup(new maplibregl.Popup({ offset: 18 }).setText(p.label || "Bus"))
            .addTo(map);
          markersRef.current.push(marker);
        });
      }
    },
    [stops, currentStopIndex, livePosition, multiRoutes, multiLivePositions],
  );

  const syncRouteLine = useCallback(
    (map: maplibregl.Map) => {
      const hasMulti = Boolean(multiRoutes && multiRoutes.length);
      const hasLine = (routeLineString && routeLineString.length >= 2) || stops.length >= 2;

      if (!routeLayersAddedRef.current) {
        if (!map.getSource("cp_routes_multi")) {
          map.addSource("cp_routes_multi", { type: "geojson", data: multiRoutesGeoJson });
        }
        if (!map.getLayer("cp_routes_multi_line")) {
          map.addLayer({
            id: "cp_routes_multi_line",
            type: "line",
            source: "cp_routes_multi",
            paint: {
              "line-color": ["get", "color"],
              "line-width": 6,
              "line-opacity": 0.7,
            },
            layout: { "line-join": "round", "line-cap": "round" },
          });
        }

        if (!map.getSource("cp_route_all")) {
          map.addSource("cp_route_all", { type: "geojson", data: routeGeoJson });
        }
        if (!map.getLayer("cp_route_all_line")) {
          map.addLayer({
            id: "cp_route_all_line",
            type: "line",
            source: "cp_route_all",
            paint: {
              // Google-like thick route stroke (base)
              "line-color": "#1d4ed8",
              "line-width": 8,
              "line-opacity": 0.75,
            },
            layout: { "line-join": "round", "line-cap": "round" },
          });
        }

        if (!map.getSource("cp_route_covered")) {
          map.addSource("cp_route_covered", { type: "geojson", data: coveredRouteGeoJson });
        }
        if (!map.getLayer("cp_route_covered_line")) {
          map.addLayer({
            id: "cp_route_covered_line",
            type: "line",
            source: "cp_route_covered",
            paint: {
              // Covered segment (metro-style). Only applies to stop-to-stop segment for now.
              "line-color": "#059669",
              "line-width": 6,
              "line-opacity": 0.9,
            },
            layout: { "line-join": "round", "line-cap": "round" },
          });
        }

        routeLayersAddedRef.current = true;
      }

      const srcMulti = map.getSource("cp_routes_multi") as maplibregl.GeoJSONSource | undefined;
      srcMulti?.setData(hasMulti ? multiRoutesGeoJson : { type: "FeatureCollection", features: [] });

      const srcAll = map.getSource("cp_route_all") as maplibregl.GeoJSONSource | undefined;
      srcAll?.setData(hasLine ? routeGeoJson : { type: "FeatureCollection", features: [] });
      const srcCovered = map.getSource("cp_route_covered") as maplibregl.GeoJSONSource | undefined;
      srcCovered?.setData(hasLine ? coveredRouteGeoJson : { type: "FeatureCollection", features: [] });
    },
    [stops.length, routeGeoJson, coveredRouteGeoJson, routeLineString, multiRoutes, multiRoutesGeoJson],
  );

  useEffect(() => {
    if (!containerRef.current || !mapConfig) {
      return;
    }

    const canUseBrowserKey = Boolean(apiKey) || Boolean(identityPoolId);
    if (!useMapProxy && !canUseBrowserKey) {
      setError(
        "Set VITE_AWS_LOCATION_API_KEY or VITE_AWS_COGNITO_IDENTITY_POOL_ID, or enable VITE_AWS_LOCATION_USE_MAP_PROXY with AWS_LOCATION_API_KEY on the server.",
      );
      return;
    }

    let cancelled = false;
    const el = containerRef.current;

    (async () => {
      try {
        map403ReportedRef.current = false;
        setError(null);
        setMapReady(false);

        let mapOptions: Record<string, unknown> = {
          container: el,
          center: DEFAULT_CENTER,
          zoom: 11,
        };

        if (useMapProxy) {
          const innerStyle = useMapsV0
            ? buildMapStyleDescriptorUrl(mapConfig.region, mapConfig.mapName)
            : buildMapsV2StyleDescriptorUrl(mapConfig.region, mapsV2Style);
          mapOptions.style = `${apiBase}/transport/maps-proxy?u=${encodeURIComponent(innerStyle)}`;
          mapOptions.transformRequest = transformRequestWithProxy(apiBase);
        } else if (apiKey) {
          mapOptions.style = useMapsV0
            ? buildMapStyleDescriptorUrl(mapConfig.region, mapConfig.mapName, apiKey)
            : buildMapsV2StyleDescriptorUrl(mapConfig.region, mapsV2Style, apiKey);
          mapOptions.transformRequest = transformRequestWithApiKey(apiKey);
        } else if (identityPoolId) {
          const authHelper = await withIdentityPoolId(identityPoolId);
          if (cancelled) return;
          mapOptions.style = useMapsV0
            ? buildMapStyleDescriptorUrl(mapConfig.region, mapConfig.mapName)
            : buildMapsV2StyleDescriptorUrl(mapConfig.region, mapsV2Style);
          mapOptions = {
            ...mapOptions,
            ...authHelper.getMapAuthenticationOptions(),
          };
        }

        if (cancelled) return;

        const map = new maplibregl.Map(mapOptions as ConstructorParameters<typeof maplibregl.Map>[0]);
        map.addControl(new maplibregl.NavigationControl(), "top-right");
        mapRef.current = map;

        map.on("error", (e) => {
          console.error("MapLibre error:", e);
          const ev = e as { error?: { message?: string }; tile?: unknown };
          const msg = ev.error?.message || String(e);
          const isTile = ev.tile != null;
          if (/403|Forbidden|not authorized|Unauthorized/i.test(msg)) {
            if (map403ReportedRef.current) {
              return;
            }
            map403ReportedRef.current = true;
            setError(
              isTile
                ? "Map tiles were denied (403). With Maps v2, the style JSON often loads even when the key is wrong, but every tile/sprite/glyph request must use a valid key with GetTile on geo-maps. Set the real API key secret in backend AWS_LOCATION_API_KEY (proxy) or VITE_AWS_LOCATION_API_KEY (direct), restart Node, and confirm the key in AWS still has GetTile for provider/default."
                : "Map request was denied (403). Check the API key value (backend AWS_LOCATION_API_KEY + VITE_AWS_LOCATION_API_KEY). With API keys, Maps v2 is used by default; legacy v0 needs Cognito/IAM — set VITE_AWS_LOCATION_MAPS_API_VERSION=v0 only if you use signed requests.",
            );
          }
        });

        map.once("load", () => {
          if (cancelled) return;
          routeLayersAddedRef.current = false;
          setMapReady(true);
        });

        // Track manual user interaction so we don't fight zoom/pan.
        map.on("dragstart", () => {
          userInteractedRef.current = true;
        });
        map.on("zoomstart", () => {
          userInteractedRef.current = true;
        });
        map.on("rotatestart", () => {
          userInteractedRef.current = true;
        });
        map.on("pitchstart", () => {
          userInteractedRef.current = true;
        });

        const ro = new ResizeObserver(() => {
          map.resize();
        });
        ro.observe(el);
        (map as unknown as { _ro?: ResizeObserver })._ro = ro;
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load map");
        }
      }
    })();

    return () => {
      cancelled = true;
      setMapReady(false);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      const map = mapRef.current;
      if (map) {
        const ro = (map as unknown as { _ro?: ResizeObserver })._ro;
        ro?.disconnect();
        try {
          if (map.getLayer("cp_route_covered_line")) map.removeLayer("cp_route_covered_line");
          if (map.getLayer("cp_route_all_line")) map.removeLayer("cp_route_all_line");
          if (map.getLayer("cp_routes_multi_line")) map.removeLayer("cp_routes_multi_line");
          if (map.getSource("cp_route_covered")) map.removeSource("cp_route_covered");
          if (map.getSource("cp_route_all")) map.removeSource("cp_route_all");
          if (map.getSource("cp_routes_multi")) map.removeSource("cp_routes_multi");
        } catch {
          /* ignore */
        }
        map.remove();
        mapRef.current = null;
      }
    };
  }, [mapConfig, apiKey, identityPoolId, useMapProxy, apiBase]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    syncRouteLine(map);
    syncMarkers(map);
  }, [mapReady, syncMarkers, syncRouteLine]);

  // Fit bounds ONCE per route selection (not on every GPS update).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Build a stable route key that ignores livePosition (which changes frequently).
    const routeKey = JSON.stringify({
      stops: (stops || []).map((s) => [s.lng, s.lat]),
      routeLine: routeLineString && routeLineString.length >= 2 ? routeLineString : null,
      multiIds: (multiRoutes || []).map((r) => r.id),
      multiCount: (multiRoutes || []).length,
    });

    if (fittedForRouteKeyRef.current === routeKey) return;
    if (userInteractedRef.current) {
      // User is already interacting; skip auto-fit.
      fittedForRouteKeyRef.current = routeKey;
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    if (multiRoutes && multiRoutes.length) {
      multiRoutes.forEach((r) => {
        (r.lineString || []).forEach((pt) => bounds.extend(pt));
      });
    } else if (routeLineString && routeLineString.length >= 2) {
      routeLineString.forEach((pt) => bounds.extend(pt));
    } else if (stops.length) {
      stops.forEach((s) => bounds.extend([s.lng, s.lat]));
    }

    try {
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 450 });
      }
    } catch {
      /* ignore */
    } finally {
      fittedForRouteKeyRef.current = routeKey;
    }
  }, [mapReady, stops, routeLineString, multiRoutes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const onMove = (e: maplibregl.MapMouseEvent & maplibregl.EventData) => {
      setHoverPos({ x: e.point.x, y: e.point.y });
      if (reverseGeocodeBlockedRef.current) {
        return;
      }
      if (hoverTimerRef.current) {
        window.clearTimeout(hoverTimerRef.current);
      }
      hoverTimerRef.current = window.setTimeout(() => {
        const lng = e.lngLat.lng;
        const lat = e.lngLat.lat;
        const last = lastHoverReqRef.current;
        if (last && Math.abs(last.lng - lng) < 0.0007 && Math.abs(last.lat - lat) < 0.0007) {
          return;
        }
        lastHoverReqRef.current = { lng, lat };
        const s = getDriverSession();
        const jwt = s?.token ? getDriverJwt() : null;
        reverseGeocodeTransport(lat, lng, jwt)
          .then((label) => setHoverLabel(label))
          .catch((e) => {
            console.error("reverseGeocode failed:", e);
            const msg = String((e as any)?.message || e || "");
            if (/403|forbidden/i.test(msg)) {
              reverseGeocodeBlockedRef.current = true;
            }
            setHoverLabel("");
          });
      }, 450);
    };

    const onLeave = () => {
      setHoverPos(null);
      setHoverLabel("");
    };

    map.on("mousemove", onMove);
    map.on("mouseout", onLeave);
    return () => {
      map.off("mousemove", onMove);
      map.off("mouseout", onLeave);
    };
  }, [mapReady]);

  if (!mapConfig) {
    return (
      <div
        className={cn(
          "w-full rounded-lg border border-dashed border-muted-foreground/35 bg-muted/20 flex flex-col items-center justify-center gap-2 px-4 py-8 text-center",
          className,
        )}
        style={{ minHeight }}
        role="region"
        aria-label="Map not configured"
      >
        <p className="text-sm font-medium text-muted-foreground">Map not configured</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Set <code className="rounded bg-muted px-1">VITE_AWS_LOCATION_MAP_ARN</code> (or region + map name) in{" "}
          <code className="rounded bg-muted px-1">Transport/.env</code>.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn("relative w-full rounded-lg overflow-hidden border border-border shadow-sm", className)}
      style={{ minHeight }}
      role="region"
      aria-label="Amazon Location map"
    >
      <div ref={containerRef} className="absolute inset-0" />
      {hoverPos && hoverLabel ? (
        <div
          className="pointer-events-none absolute z-20 rounded-md border bg-background/95 px-2 py-1 text-xs text-foreground shadow-sm"
          style={{
            left: 8 + hoverPos.x,
            top: 8 + hoverPos.y,
            maxWidth: "min(420px, calc(100% - 16px))",
          }}
        >
          {hoverLabel}
        </div>
      ) : null}
      {error ? (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 border border-destructive/40 bg-background/95 px-4 py-8 text-center backdrop-blur-[1px]"
          role="alert"
        >
          <p className="text-sm font-medium text-destructive">Map failed to load</p>
          <p className="text-xs text-muted-foreground max-w-md">{error}</p>
        </div>
      ) : null}
    </div>
  );
}
