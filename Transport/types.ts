/** Transport module domain types (UI + future API). */

export interface RouteStop {
  id: string;
  name: string;
  /** Placeholder for AWS Location coordinates */
  lat: number;
  lng: number;
  order: number;
}

export interface TransportRoute {
  id: string;
  name: string;
  pickupLabel: string;
  dropLabel: string;
  stops: RouteStop[];
}

export interface TransportDriver {
  id: string;
  name: string;
  phone: string;
  licenseNo: string;
  busId: string;
  routeId: string;
}

export interface TransportBus {
  id: string;
  label: string;
  regNumber: string;
  capacity: number;
  routeId: string;
  driverId: string;
  /** Mock: index into route.stops for current position */
  currentStopIndex: number;
}

export interface TransportParentRecord {
  id: string;
  parentName: string;
  phone: string;
  childName: string;
  classGrade: string;
  pickupArea: string;
  assignedBusId: string | null;
  createdAt: string;
}

export interface SeatBoardingState {
  seatNumber: number;
  boarded: boolean;
  childName?: string;
}
