const SESSION_KEY = "cp_transport_driver_session";
const JWT_KEY = "cp_transport_driver_jwt";

export type DriverSessionPayload = {
  driverId: string;
  at: string;
  role: "driver";
  /** JWT from POST /api/transport/driver/login */
  token?: string;
  email?: string;
  fullName?: string;
  busId?: string;
  /** @deprecated demo mock route id */
  routeId?: string;
  busName?: string;
  busRegistrationNo?: string;
  busCapacity?: number;
  morningRouteId?: string;
  eveningRouteId?: string;
  /** When using demo accounts (drv-1), mock store id */
  mockDriverId?: string;
};

/** Legacy: demo-only id (drv-1). Prefer setDriverSessionPayload. */
export function setDriverSession(driverId: string): void {
  setDriverSessionPayload({
    driverId,
    mockDriverId: driverId.startsWith("drv-") ? driverId : undefined,
  });
}

export function setDriverSessionPayload(payload: Partial<DriverSessionPayload> & { driverId: string }): void {
  const full: DriverSessionPayload = {
    driverId: payload.driverId,
    at: new Date().toISOString(),
    role: "driver",
    token: payload.token,
    email: payload.email,
    fullName: payload.fullName,
    busId: payload.busId,
    routeId: payload.routeId,
    busName: payload.busName,
    busRegistrationNo: payload.busRegistrationNo,
    busCapacity: payload.busCapacity,
    morningRouteId: payload.morningRouteId,
    eveningRouteId: payload.eveningRouteId,
    mockDriverId: payload.mockDriverId,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(full));
  if (payload.token) {
    localStorage.setItem(JWT_KEY, payload.token);
  }
}

export function clearDriverSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(JWT_KEY);
}

export function getDriverSession(): DriverSessionPayload | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DriverSessionPayload;
    if (parsed.role !== "driver" || !parsed.driverId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getDriverJwt(): string | null {
  return localStorage.getItem(JWT_KEY);
}

export function isDriverAuthenticated(): boolean {
  return getDriverSession() != null;
}

/** Resolve bus id for UI: API session or mock driver row */
export function resolveDriverBusId(session: DriverSessionPayload): string | undefined {
  if (session.busId) return session.busId;
  const mockId = session.mockDriverId ?? (session.driverId.startsWith("drv-") ? session.driverId : undefined);
  if (mockId) {
    const hit = DRIVER_DEMO_ACCOUNTS.find((a) => a.driverId === mockId);
    return hit?.busId;
  }
  return undefined;
}

export function resolveDriverDisplayName(session: DriverSessionPayload): string {
  if (session.fullName) return session.fullName;
  if (session.email) {
    const local = session.email.split("@")[0];
    if (local) return local;
  }
  const mockId = session.mockDriverId ?? (session.driverId.startsWith("drv-") ? session.driverId : undefined);
  if (mockId) {
    const hit = DRIVER_DEMO_ACCOUNTS.find((a) => a.driverId === mockId);
    if (hit?.label) return hit.label.split("(")[0].trim();
  }
  return "Driver";
}

/** Demo logins — used only if API is unreachable */
export const DRIVER_DEMO_ACCOUNTS: {
  email: string;
  password: string;
  driverId: string;
  busId: string;
  routeId: string;
  label: string;
}[] = [
  {
    email: "ramesh.driver@conventpulse.edu",
    password: "Driver@123",
    driverId: "drv-1",
    busId: "bus-1",
    routeId: "route-1",
    label: "Ramesh Kumar (Bus A)",
  },
  {
    email: "sunil.driver@conventpulse.edu",
    password: "Driver@123",
    driverId: "drv-2",
    busId: "bus-2",
    routeId: "route-2",
    label: "Sunil Reddy (Bus B)",
  },
];

export function resolveDriverLogin(email: string, password: string): string | null {
  const e = email.trim().toLowerCase();
  const p = password;
  const hit = DRIVER_DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === e && a.password === p);
  return hit?.driverId ?? null;
}
