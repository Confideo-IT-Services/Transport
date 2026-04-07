import type {
  TransportBus,
  TransportDriver,
  TransportParentRecord,
  TransportRoute,
  SeatBoardingState,
} from "@transport/types";

const PREFIX = "cp_transport_mock_";

const KEYS = {
  parents: `${PREFIX}parents`,
  drivers: `${PREFIX}drivers`,
  buses: `${PREFIX}buses`,
  routes: `${PREFIX}routes`,
  seeded: `${PREFIX}seeded`,
} as const;

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

const initialRoutes: TransportRoute[] = [
  {
    id: "route-1",
    name: "North Hyderabad — Morning",
    pickupLabel: "North depot",
    dropLabel: "School main gate",
    stops: [
      { id: "s1", name: "Kompally Circle", lat: 17.535, lng: 78.481, order: 1 },
      { id: "s2", name: "Suchitra Junction", lat: 17.508, lng: 78.472, order: 2 },
      { id: "s3", name: "School gate", lat: 17.44, lng: 78.39, order: 3 },
    ],
  },
  {
    id: "route-2",
    name: "Secunderabad — Morning",
    pickupLabel: "Secunderabad depot",
    dropLabel: "School main gate",
    stops: [
      { id: "r2s1", name: "Paradise", lat: 17.443, lng: 78.501, order: 1 },
      { id: "r2s2", name: "Trimulgherry", lat: 17.475, lng: 78.508, order: 2 },
      { id: "r2s3", name: "School gate", lat: 17.44, lng: 78.39, order: 3 },
    ],
  },
];

const initialDrivers: TransportDriver[] = [
  {
    id: "drv-1",
    name: "Ramesh Kumar",
    phone: "+91 98765 43210",
    licenseNo: "TS-09-2018-001234",
    busId: "bus-1",
    routeId: "route-1",
  },
  {
    id: "drv-2",
    name: "Sunil Reddy",
    phone: "+91 91234 56788",
    licenseNo: "TS-09-2019-005678",
    busId: "bus-2",
    routeId: "route-2",
  },
  {
    id: "drv-3",
    name: "Vikram Singh",
    phone: "+91 99887 76655",
    licenseNo: "TS-09-2020-009900",
    busId: "bus-3",
    routeId: "route-1",
  },
];

const initialBuses: TransportBus[] = [
  {
    id: "bus-1",
    label: "Bus A",
    regNumber: "TS-09-AB-1234",
    capacity: 30,
    routeId: "route-1",
    driverId: "drv-1",
    currentStopIndex: 1,
  },
  {
    id: "bus-2",
    label: "Bus B",
    regNumber: "TS-09-CD-5678",
    capacity: 30,
    routeId: "route-2",
    driverId: "drv-2",
    currentStopIndex: 0,
  },
  {
    id: "bus-3",
    label: "Bus C",
    regNumber: "TS-09-EF-9012",
    capacity: 40,
    routeId: "route-1",
    driverId: "drv-3",
    currentStopIndex: 0,
  },
];

const initialParents: TransportParentRecord[] = [
  {
    id: "p1",
    parentName: "Anita Rao",
    phone: "+91 98765 11111",
    childName: "Arjun Rao",
    classGrade: "5-A",
    pickupArea: "Kompally",
    assignedBusId: "bus-1",
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: "p2",
    parentName: "Mohammed Khan",
    phone: "+91 98765 22222",
    childName: "Zara Khan",
    classGrade: "3-B",
    pickupArea: "Suchitra",
    assignedBusId: "bus-1",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

function ensureSeed(): void {
  if (localStorage.getItem(KEYS.seeded) === "1") return;
  saveJson(KEYS.parents, initialParents);
  saveJson(KEYS.drivers, initialDrivers);
  saveJson(KEYS.buses, initialBuses);
  saveJson(KEYS.routes, initialRoutes);
  localStorage.setItem(KEYS.seeded, "1");
}

export function getRoutes(): TransportRoute[] {
  ensureSeed();
  return loadJson<TransportRoute[]>(KEYS.routes, initialRoutes);
}

export function saveRoutes(list: TransportRoute[]): void {
  ensureSeed();
  saveJson(KEYS.routes, list);
}

/** Quick route from pickup / drop labels and optional checkpoint names (one per line). */
export function addRouteFromForm(input: {
  name: string;
  pickupLabel: string;
  dropLabel: string;
  checkpointLines: string;
}): TransportRoute[] {
  const lines = input.checkpointLines
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const baseLat = 17.44 + Math.random() * 0.08;
  const baseLng = 78.39 + Math.random() * 0.1;
  const stops = lines.map((name, i) => ({
    id: `stop-${Date.now()}-${i}`,
    name,
    lat: baseLat + i * 0.02,
    lng: baseLng + i * 0.02,
    order: i + 1,
  }));
  if (stops.length === 0) {
    stops.push(
      { id: `stop-${Date.now()}-a`, name: input.pickupLabel, lat: baseLat, lng: baseLng, order: 1 },
      { id: `stop-${Date.now()}-b`, name: input.dropLabel, lat: baseLat + 0.03, lng: baseLng + 0.03, order: 2 },
    );
  }
  const list = getRoutes();
  const next: TransportRoute = {
    id: `route-${Date.now()}`,
    name: input.name.trim(),
    pickupLabel: input.pickupLabel.trim(),
    dropLabel: input.dropLabel.trim(),
    stops,
  };
  const merged = [next, ...list];
  saveRoutes(merged);
  return merged;
}

export function getRouteById(id: string): TransportRoute | undefined {
  return getRoutes().find((r) => r.id === id);
}

export function getDrivers(): TransportDriver[] {
  ensureSeed();
  return loadJson<TransportDriver[]>(KEYS.drivers, initialDrivers);
}

export function getDriverById(id: string): TransportDriver | undefined {
  return getDrivers().find((d) => d.id === id);
}

export function saveDrivers(list: TransportDriver[]): void {
  ensureSeed();
  saveJson(KEYS.drivers, list);
}

export function addDriver(
  row: Omit<TransportDriver, "id">,
): TransportDriver[] {
  const list = getDrivers();
  const next: TransportDriver = {
    ...row,
    id: `drv-${Date.now()}`,
  };
  const merged = [next, ...list];
  saveDrivers(merged);
  return merged;
}

export function updateDriver(id: string, patch: Partial<TransportDriver>): TransportDriver[] {
  const list = getDrivers().map((d) => (d.id === id ? { ...d, ...patch } : d));
  saveDrivers(list);
  return list;
}

export function getBuses(): TransportBus[] {
  ensureSeed();
  return loadJson<TransportBus[]>(KEYS.buses, initialBuses);
}

export function getBusById(id: string): TransportBus | undefined {
  return getBuses().find((b) => b.id === id);
}

export function saveBuses(list: TransportBus[]): void {
  ensureSeed();
  saveJson(KEYS.buses, list);
}

export function addBus(row: Omit<TransportBus, "id" | "currentStopIndex"> & { currentStopIndex?: number }): TransportBus[] {
  const list = getBuses();
  const next: TransportBus = {
    ...row,
    id: `bus-${Date.now()}`,
    currentStopIndex: row.currentStopIndex ?? 0,
  };
  const merged = [next, ...list];
  saveBuses(merged);
  return merged;
}

export function getParents(): TransportParentRecord[] {
  ensureSeed();
  return loadJson<TransportParentRecord[]>(KEYS.parents, initialParents);
}

export function addParent(record: Omit<TransportParentRecord, "id" | "createdAt">): TransportParentRecord[] {
  ensureSeed();
  const list = getParents();
  const next: TransportParentRecord = {
    ...record,
    id: `p-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const merged = [next, ...list];
  saveJson(KEYS.parents, merged);
  return merged;
}

export function removeParent(id: string): TransportParentRecord[] {
  const list = getParents().filter((p) => p.id !== id);
  saveJson(KEYS.parents, list);
  return list;
}

export function assignParentToBus(parentId: string, busId: string | null): TransportParentRecord[] {
  const list = getParents().map((p) => (p.id === parentId ? { ...p, assignedBusId: busId } : p));
  saveJson(KEYS.parents, list);
  return list;
}

/** Deterministic mock boarding pattern per bus for RFID / seat view */
export function getSeatBoardingForBus(busId: string, capacity: number): SeatBoardingState[] {
  const parents = getParents().filter((p) => p.assignedBusId === busId);
  const boardedCount = Math.min(
    parents.length,
    Math.floor(capacity * 0.65) + (busId === "bus-3" ? 3 : 0),
  );
  const seats: SeatBoardingState[] = [];
  for (let i = 1; i <= capacity; i++) {
    const boarded = i <= boardedCount;
    seats.push({
      seatNumber: i,
      boarded,
      childName: boarded && parents[i - 1] ? parents[i - 1].childName : undefined,
    });
  }
  return seats;
}
