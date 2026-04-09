/** API base for ConventPulse backend (same as main app). */
export function getTransportApiBase(): string {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined) || "";
  const base =
    fromEnv.trim() ||
    (typeof window !== "undefined" && window.location?.origin ? `${window.location.origin}/api` : "http://localhost:3000/api");
  return base.replace(/\/$/, "");
}

export function getTransportAdminHeaders(): HeadersInit {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const secret = import.meta.env.VITE_TRANSPORT_ADMIN_SECRET as string | undefined;
  if (secret) {
    h["X-Transport-Admin-Secret"] = secret;
  }
  const token = localStorage.getItem("conventpulse_token");
  if (token) {
    h["Authorization"] = `Bearer ${token}`;
  }
  return h;
}

export type RouteStopDto = {
  id: string;
  name: string;
  sequenceOrder: number;
  lat: number;
  lng: number;
};

export type TransportDriverDto = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  licenseNo: string | null;
  busId: string | null;
  busName: string | null;
  busRegistrationNo?: string | null;
  busCapacity?: number | null;
  morningRouteId: string | null;
  morningRouteName: string | null;
  eveningRouteId: string | null;
  eveningRouteName: string | null;
  createdAt?: string;
};

export type TransportBusDto = {
  id: string;
  name: string;
  registrationNo: string | null;
  capacity: number | null;
  createdAt?: string;
};

export type TransportRouteDto = {
  id: string;
  name: string;
  createdAt?: string;
};

export type TransportRouteWithStopsDto = TransportRouteDto & {
  stops: RouteStopDto[];
};

export async function fetchTransportBuses(): Promise<TransportBusDto[]> {
  const res = await fetch(`${getTransportApiBase()}/transport/buses`, {
    headers: getTransportAdminHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  const data = (await res.json()) as { buses: TransportBusDto[] };
  return data.buses || [];
}

export async function fetchTransportRoutes(): Promise<TransportRouteDto[]> {
  const res = await fetch(`${getTransportApiBase()}/transport/routes`, {
    headers: getTransportAdminHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  const data = (await res.json()) as { routes: TransportRouteDto[] };
  return data.routes || [];
}

export async function fetchTransportRoutesWithStops(): Promise<TransportRouteWithStopsDto[]> {
  const res = await fetch(`${getTransportApiBase()}/transport/routes?includeStops=1`, {
    headers: getTransportAdminHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  const data = (await res.json()) as { routes: TransportRouteWithStopsDto[] };
  return data.routes || [];
}

export async function createTransportBus(body: {
  name: string;
  registrationNo?: string;
  capacity?: number;
}): Promise<string | null> {
  const res = await fetch(`${getTransportApiBase()}/transport/buses`, {
    method: "POST",
    headers: getTransportAdminHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  const data = (await res.json()) as { id?: string };
  return data.id ?? null;
}

export async function patchTransportBus(
  busId: string,
  body: { name: string; registrationNo?: string | null; capacity?: number | null },
): Promise<void> {
  const res = await fetch(`${getTransportApiBase()}/transport/buses/${encodeURIComponent(busId)}`, {
    method: "PATCH",
    headers: getTransportAdminHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
}

export async function deleteTransportBus(busId: string): Promise<void> {
  const res = await fetch(`${getTransportApiBase()}/transport/buses/${encodeURIComponent(busId)}`, {
    method: "DELETE",
    headers: getTransportAdminHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
}

export async function createTransportRoute(body: {
  name: string;
  stops: { name: string; lat: number; lng: number }[];
}): Promise<string | null> {
  const res = await fetch(`${getTransportApiBase()}/transport/routes`, {
    method: "POST",
    headers: getTransportAdminHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  const data = (await res.json()) as { id?: string };
  return data.id ?? null;
}

export async function fetchTransportDrivers(): Promise<TransportDriverDto[]> {
  const res = await fetch(`${getTransportApiBase()}/transport/drivers`, {
    headers: getTransportAdminHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  const data = (await res.json()) as { drivers: TransportDriverDto[] };
  return data.drivers || [];
}

export async function adminResetDriverPassword(driverId: string, newPassword: string): Promise<void> {
  const res = await fetch(`${getTransportApiBase()}/transport/drivers/${encodeURIComponent(driverId)}/password`, {
    method: "PATCH",
    headers: getTransportAdminHeaders(),
    body: JSON.stringify({ newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
}

export async function createTransportDriver(body: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  licenseNo: string;
  busId: string;
  morningRouteId: string;
  eveningRouteId: string;
}): Promise<void> {
  const res = await fetch(`${getTransportApiBase()}/transport/drivers`, {
    method: "POST",
    headers: getTransportAdminHeaders(),
    body: JSON.stringify({
      email: body.email,
      password: body.password,
      fullName: body.fullName,
      phone: body.phone,
      licenseNo: body.licenseNo,
      busId: body.busId,
      morningRouteId: body.morningRouteId,
      eveningRouteId: body.eveningRouteId,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export async function patchTransportDriverAssignment(
  driverId: string,
  body: { busId: string; morningRouteId: string | null; eveningRouteId: string | null },
): Promise<void> {
  const res = await fetch(`${getTransportApiBase()}/transport/drivers/${driverId}`, {
    method: "PATCH",
    headers: getTransportAdminHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
}

export type PlaceSuggestion = {
  placeId: string;
  title: string;
  subtitle: string;
};

/** Amazon Location Places Autocomplete (via backend; requires AWS_LOCATION_API_KEY + Places on API key). */
export async function fetchPlacesAutocomplete(q: string): Promise<PlaceSuggestion[]> {
  const res = await fetch(
    `${getTransportApiBase()}/transport/places/autocomplete?q=${encodeURIComponent(q)}`,
    { headers: getTransportAdminHeaders() },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return (data as { suggestions: PlaceSuggestion[] }).suggestions || [];
}

export async function fetchPlaceDetails(placeId: string): Promise<{ name: string; lat: number; lng: number }> {
  const res = await fetch(
    `${getTransportApiBase()}/transport/places/details?placeId=${encodeURIComponent(placeId)}`,
    { headers: getTransportAdminHeaders() },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as { name: string; lat: number; lng: number };
}

export async function reverseGeocodeTransport(lat: number, lng: number, jwt?: string | null): Promise<string> {
  const headers: HeadersInit = jwt
    ? { Authorization: `Bearer ${jwt}` }
    : getTransportAdminHeaders();
  const res = await fetch(
    `${getTransportApiBase()}/transport/places/reverse-geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
    { headers },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return (data as { label?: string }).label || "";
}

export async function calculateTransportRouteLine(stops: { lat: number; lng: number }[]): Promise<{
  lineString: [number, number][];
  distanceMeters: number | null;
  durationSeconds: number | null;
}> {
  return calculateTransportRouteLineWithJwt(stops, null);
}

export async function calculateTransportRouteLineWithJwt(
  stops: { lat: number; lng: number }[],
  jwt: string | null,
): Promise<{
  lineString: [number, number][];
  distanceMeters: number | null;
  durationSeconds: number | null;
}> {
  const headers: HeadersInit = jwt
    ? { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" }
    : getTransportAdminHeaders();
  const res = await fetch(`${getTransportApiBase()}/transport/routes/calculate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ stops }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as {
    lineString: [number, number][];
    distanceMeters: number | null;
    durationSeconds: number | null;
  };
}

export async function patchTransportRoute(
  routeId: string,
  body: { name: string; stops: { name: string; lat: number; lng: number }[] },
): Promise<void> {
  const res = await fetch(`${getTransportApiBase()}/transport/routes/${routeId}`, {
    method: "PATCH",
    headers: getTransportAdminHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
}

export async function deleteTransportRoute(routeId: string): Promise<void> {
  const res = await fetch(`${getTransportApiBase()}/transport/routes/${encodeURIComponent(routeId)}`, {
    method: "DELETE",
    headers: getTransportAdminHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
}

export type DriverProfileDto = TransportDriverDto & {
  morningStops: RouteStopDto[];
  eveningStops: RouteStopDto[];
};

export type DriverLoginResponse = {
  token: string;
  driver: DriverProfileDto;
};

export async function loginTransportDriver(email: string, password: string): Promise<DriverLoginResponse> {
  const res = await fetch(`${getTransportApiBase()}/transport/driver/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Login failed");
  }
  return data as DriverLoginResponse;
}

export async function fetchDriverProfile(jwt: string): Promise<DriverProfileDto> {
  const res = await fetch(`${getTransportApiBase()}/transport/driver/me`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Failed to load profile");
  }
  return (data as { driver: DriverProfileDto }).driver;
}

export async function driverChangePassword(jwt: string, body: { currentPassword: string; newPassword: string }): Promise<void> {
  const res = await fetch(`${getTransportApiBase()}/transport/driver/password`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
}

export type TrackerPositionDto = {
  trackerName: string;
  deviceId: string;
  lat: number;
  lng: number;
  sampleTime: string | null;
  receivedTime: string | null;
};

export async function publishTrackerPosition(jwt: string, body: {
  lat: number;
  lng: number;
  accuracyMeters?: number;
  sampleTime?: string;
}): Promise<{ ok: true; deviceId: string; sampleTime: string }> {
  const res = await fetch(`${getTransportApiBase()}/transport/tracker/position`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as { ok: true; deviceId: string; sampleTime: string };
}

export async function fetchTrackerPosition(deviceId: string): Promise<TrackerPositionDto> {
  const res = await fetch(`${getTransportApiBase()}/transport/tracker/position/${encodeURIComponent(deviceId)}`, {
    headers: getTransportAdminHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as TrackerPositionDto;
}

export async function fetchMyTrackerPosition(jwt: string): Promise<TrackerPositionDto> {
  const res = await fetch(`${getTransportApiBase()}/transport/tracker/position/me`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as TrackerPositionDto;
}

export type TodayTripStatusDto = {
  busId: string;
  tripType: "morning" | "evening";
  status: "idle" | "active" | "ended";
  startedAt?: string | null;
  endedAt?: string | null;
  updatedAt?: string | null;
};

export async function fetchTodayTripStatuses(): Promise<{ tripDate: string; trips: TodayTripStatusDto[] }> {
  const res = await fetch(`${getTransportApiBase()}/transport/trips/today`, {
    headers: getTransportAdminHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as { tripDate: string; trips: TodayTripStatusDto[] };
}

export async function driverStartTrip(jwt: string, tripType: "morning" | "evening"): Promise<void> {
  const res = await fetch(`${getTransportApiBase()}/transport/driver/trip/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ tripType }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
}

export async function driverEndTrip(jwt: string, tripType: "morning" | "evening"): Promise<void> {
  const res = await fetch(`${getTransportApiBase()}/transport/driver/trip/end`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ tripType }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
}

export type DriverTodayTripsDto = {
  tripDate: string;
  busId: string;
  trips: Array<{
    tripType: "morning" | "evening";
    status: "idle" | "active" | "ended";
    startedAt: string | null;
    endedAt: string | null;
    updatedAt: string | null;
  }>;
};

export async function fetchDriverTodayTrips(jwt: string): Promise<DriverTodayTripsDto> {
  const res = await fetch(`${getTransportApiBase()}/transport/driver/trips/today`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as DriverTodayTripsDto;
}

export type DriverAssignedChildDto = {
  id: string;
  childName: string;
  parentEmail: string;
  gender: string | null;
  address: string | null;
  onboarded: boolean;
  lastScannedAt: string | null;
};

export async function fetchDriverAssignedChildren(
  jwt: string,
  tripType: "morning" | "evening" = "morning",
): Promise<{ busId: string; tripType: "morning" | "evening"; tripDate: string; children: DriverAssignedChildDto[] }> {
  const qs = new URLSearchParams();
  qs.set("tripType", tripType);
  const res = await fetch(`${getTransportApiBase()}/transport/driver/assigned-children?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as { busId: string; tripType: "morning" | "evening"; tripDate: string; children: DriverAssignedChildDto[] };
}

export type BusAttendanceDto = {
  busId: string;
  tripType: "morning" | "evening";
  date: string;
  boarded: Array<{ studentId: string; tagUid: string | null; boardedAt: string | null }>;
};

export async function fetchBusAttendance(busId: string, tripType: "morning" | "evening" = "morning"): Promise<BusAttendanceDto> {
  const qs = new URLSearchParams();
  qs.set("tripType", tripType);
  const res = await fetch(`${getTransportApiBase()}/transport/attendance/bus/${encodeURIComponent(busId)}?${qs.toString()}`, {
    headers: getTransportAdminHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data as BusAttendanceDto;
}

export type RfidTagDto = {
  id: string;
  tagUid: string;
  tagName?: string | null;
  assignedStudentId: string | null;
  createdAt?: string;
};

export async function fetchRfidTags(schoolId?: string): Promise<RfidTagDto[]> {
  const qs = schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : "";
  const res = await fetch(`${getTransportApiBase()}/transport/rfid-tags${qs}`, {
    headers: getTransportAdminHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return (data as { tags: RfidTagDto[] }).tags || [];
}

export async function createRfidTag(body: { schoolId?: string; tagUid: string; tagName?: string | null }): Promise<void> {
  const res = await fetch(`${getTransportApiBase()}/transport/rfid-tags`, {
    method: "POST",
    headers: getTransportAdminHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
}

export async function assignRfidTag(tagId: string, studentId: string): Promise<void> {
  const res = await fetch(`${getTransportApiBase()}/transport/rfid-tags/${encodeURIComponent(tagId)}/assign`, {
    method: "PATCH",
    headers: getTransportAdminHeaders(),
    body: JSON.stringify({ studentId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
}

export async function unassignRfidTag(tagId: string): Promise<void> {
  const res = await fetch(`${getTransportApiBase()}/transport/rfid-tags/${encodeURIComponent(tagId)}/unassign`, {
    method: "PATCH",
    headers: getTransportAdminHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
}

export type TransportChildDto = {
  id: string;
  schoolId: string;
  childName: string;
  gender: string | null;
  parentEmail: string;
  address?: string | null;
  busId?: string | null;
  pickupPointId?: string | null;
  pickupPointName?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export async function fetchTransportChildren(schoolId: string): Promise<TransportChildDto[]> {
  const qs = `?schoolId=${encodeURIComponent(schoolId)}`;
  const res = await fetch(`${getTransportApiBase()}/transport/children${qs}`, {
    headers: getTransportAdminHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return (data as { children: TransportChildDto[] }).children || [];
}

export async function createTransportChild(body: {
  schoolId: string;
  childName: string;
  gender?: string | null;
  parentEmail: string;
  address: string;
}): Promise<string | null> {
  const res = await fetch(`${getTransportApiBase()}/transport/children`, {
    method: "POST",
    headers: getTransportAdminHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return (data as { id?: string }).id ?? null;
}

export async function patchChildAssignment(childId: string, body: { busId?: string | null; pickupPointId?: string | null }): Promise<void> {
  const res = await fetch(`${getTransportApiBase()}/transport/children/${encodeURIComponent(childId)}/assignment`, {
    method: "PATCH",
    headers: getTransportAdminHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
}

export type TransportPickupPointDto = {
  id: string;
  schoolId: string;
  name: string;
  lat: number;
  lng: number;
  createdAt?: string;
};

export async function fetchPickupPoints(schoolId: string): Promise<TransportPickupPointDto[]> {
  const qs = `?schoolId=${encodeURIComponent(schoolId)}`;
  const res = await fetch(`${getTransportApiBase()}/transport/pickup-points${qs}`, {
    headers: getTransportAdminHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return (data as { pickupPoints: TransportPickupPointDto[] }).pickupPoints || [];
}

export async function fetchNearestPickupPoints(schoolId: string, q: string): Promise<Array<{ id: string; name: string; lat: number; lng: number }>> {
  const qs = new URLSearchParams();
  qs.set("schoolId", schoolId);
  qs.set("q", q);
  const res = await fetch(`${getTransportApiBase()}/transport/pickup-points/nearest?${qs.toString()}`, {
    headers: getTransportAdminHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return (data as { pickupPoints: Array<{ id: string; name: string; lat: number; lng: number }> }).pickupPoints || [];
}

export async function fetchBusPickupPoints(busId: string, schoolId: string, tripType: "morning" | "evening" = "morning"): Promise<Array<{ id: string; name: string; lat: number; lng: number; routeStopId: string }>> {
  const qs = new URLSearchParams();
  qs.set("schoolId", schoolId);
  qs.set("tripType", tripType);
  const res = await fetch(`${getTransportApiBase()}/transport/buses/${encodeURIComponent(busId)}/pickup-points?${qs.toString()}`, {
    headers: getTransportAdminHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return (data as { pickupPoints: Array<{ id: string; name: string; lat: number; lng: number; routeStopId: string }> }).pickupPoints || [];
}

export async function unassignChildrenFromBus(busId: string): Promise<void> {
  const res = await fetch(`${getTransportApiBase()}/transport/buses/${encodeURIComponent(busId)}/unassign-children`, {
    method: "PATCH",
    headers: getTransportAdminHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
}

export async function unassignDriverFromBus(busId: string): Promise<void> {
  const res = await fetch(`${getTransportApiBase()}/transport/buses/${encodeURIComponent(busId)}/unassign-driver`, {
    method: "PATCH",
    headers: getTransportAdminHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
}
