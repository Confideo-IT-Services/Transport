import type { SeatBoardingState } from "@transport/types";

const TRIP_PREFIX = "cp_transport_driver_trip_";
const NOTIFY_LOG = "cp_transport_driver_notify_log";
const HISTORY = "cp_transport_driver_trip_history";

export type TripStatus = "idle" | "active" | "ended";
export type TripType = "morning" | "evening";

export interface DriverTripState {
  date: string;
  driverId: string;
  tripType: TripType;
  status: TripStatus;
  startedAt: string | null;
  endedAt: string | null;
}

export interface ParentNotifyEvent {
  id: string;
  at: string;
  driverId: string;
  busId: string;
  kind: "trip_start" | "trip_end";
  message: string;
  parentCount: number;
}

export interface TripDaySummary {
  id: string;
  date: string;
  driverId: string;
  busId: string;
  tripType: TripType;
  startedAt: string | null;
  endedAt: string | null;
  /** Demo: copy of seat stats */
  boardedApprox: number;
  capacity: number;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function tripKey(driverId: string, date: string, tripType: TripType): string {
  return `${TRIP_PREFIX}${driverId}_${date}_${tripType}`;
}

export function getTripState(driverId: string, tripType: TripType): DriverTripState {
  const date = todayStr();
  const key = tripKey(driverId, date, tripType);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const t = JSON.parse(raw) as DriverTripState;
      if (t.date === date && t.driverId === driverId && t.tripType === tripType) return t;
    }
  } catch {
    /* fallthrough */
  }
  const initial: DriverTripState = {
    date,
    driverId,
    tripType,
    status: "idle",
    startedAt: null,
    endedAt: null,
  };
  localStorage.setItem(key, JSON.stringify(initial));
  return initial;
}

function saveTripState(state: DriverTripState): void {
  const key = tripKey(state.driverId, state.date, state.tripType);
  localStorage.setItem(key, JSON.stringify(state));
}

export function upsertTripStateFromServer(args: {
  driverId: string;
  tripType: TripType;
  date: string;
  status: TripStatus;
  startedAt: string | null;
  endedAt: string | null;
}): DriverTripState {
  const next: DriverTripState = {
    date: args.date,
    driverId: args.driverId,
    tripType: args.tripType,
    status: args.status,
    startedAt: args.startedAt,
    endedAt: args.endedAt,
  };
  saveTripState(next);
  return next;
}

function loadNotifyLog(): ParentNotifyEvent[] {
  try {
    const raw = localStorage.getItem(NOTIFY_LOG);
    if (!raw) return [];
    return JSON.parse(raw) as ParentNotifyEvent[];
  } catch {
    return [];
  }
}

function saveNotifyLog(events: ParentNotifyEvent[]): void {
  localStorage.setItem(NOTIFY_LOG, JSON.stringify(events.slice(-100)));
}

function loadHistory(): TripDaySummary[] {
  try {
    const raw = localStorage.getItem(HISTORY);
    if (!raw) return [];
    return JSON.parse(raw) as TripDaySummary[];
  } catch {
    return [];
  }
}

function saveHistory(rows: TripDaySummary[]): void {
  localStorage.setItem(HISTORY, JSON.stringify(rows.slice(-60)));
}

/** Start morning pickup run — demo: log parent notifications. */
export function startDriverTrip(
  driverId: string,
  busId: string,
  parentCount: number,
  tripType: TripType,
): { state: DriverTripState; event: ParentNotifyEvent } {
  const date = todayStr();
  let state = getTripState(driverId, tripType);
  if (state.date !== date) {
    state = { date, driverId, tripType, status: "idle", startedAt: null, endedAt: null };
  }
  if (state.status === "active") {
    return {
      state,
      event: {
        id: "noop",
        at: new Date().toISOString(),
        driverId,
        busId,
        kind: "trip_start",
        message: "Trip already started today.",
        parentCount: 0,
      },
    };
  }
  const startedAt = new Date().toISOString();
  state = {
    ...state,
    status: "active",
    startedAt,
    endedAt: null,
  };
  saveTripState(state);

  const event: ParentNotifyEvent = {
    id: `ev-${Date.now()}`,
    at: startedAt,
    driverId,
    busId,
    kind: "trip_start",
    message:
      tripType === "morning"
        ? "Morning trip started — please get your child ready. (Demo notification to all parents on this bus.)"
        : "Evening trip started — bus is departing school. (Demo notification to parents.)",
    parentCount,
  };
  const log = loadNotifyLog();
  log.push(event);
  saveNotifyLog(log);

  return { state, event };
}

/** End evening tour — save day summary (demo). */
export function endDriverTrip(
  driverId: string,
  busId: string,
  capacity: number,
  seats: SeatBoardingState[],
  tripType: TripType,
): { state: DriverTripState; event: ParentNotifyEvent; summary: TripDaySummary } {
  const date = todayStr();
  let state = getTripState(driverId, tripType);
  if (state.date !== date) {
    state = { date, driverId, tripType, status: "idle", startedAt: null, endedAt: null };
  }
  const endedAt = new Date().toISOString();
  const boardedApprox = seats.filter((s) => s.boarded).length;

  state = {
    ...state,
    status: "ended",
    endedAt,
  };
  saveTripState(state);

  const event: ParentNotifyEvent = {
    id: `ev-${Date.now()}`,
    at: endedAt,
    driverId,
    busId,
    kind: "trip_end",
    message:
      tripType === "morning"
        ? "Morning trip ended. (Demo notification.)"
        : "Evening trip ended. (Demo notification to parents — drop completed.)",
    parentCount: 0,
  };
  const log = loadNotifyLog();
  log.push(event);
  saveNotifyLog(log);

  const summary: TripDaySummary = {
    id: `day-${driverId}-${date}-${Date.now()}`,
    date,
    driverId,
    busId,
    tripType,
    startedAt: state.startedAt,
    endedAt,
    boardedApprox,
    capacity,
  };
  const hist = loadHistory();
  hist.unshift(summary);
  saveHistory(hist);

  return { state, event, summary };
}

export function getRecentNotifyEvents(driverId: string, limit = 8): ParentNotifyEvent[] {
  return loadNotifyLog()
    .filter((e) => e.driverId === driverId)
    .slice(-limit)
    .reverse();
}

export function getTripHistoryForDriver(driverId: string, limit = 14): TripDaySummary[] {
  return loadHistory().filter((h) => h.driverId === driverId).slice(0, limit);
}

export function getTripHistoryForDriverAndType(driverId: string, tripType: TripType, limit = 14): TripDaySummary[] {
  return loadHistory()
    .filter((h) => h.driverId === driverId && h.tripType === tripType)
    .slice(0, limit);
}
