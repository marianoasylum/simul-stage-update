/**
 * TypeScript definitions for the Interactive Event Simulation
 */

export interface TicketInfo {
  section: string;
  sectionCode: 'VIP' | 'PLAT' | 'GRAD' | 'TRIB' | 'PB_TRASERA';
  row: number;
  seat: number;
  eventName: string;
  venueName: string;
  gate: string;
  gateNumber?: number;
  ticketId: string;
  date: string;
  price: string;
  capacity?: string;
  sectorAforo?: number;
  totalVenueAforo?: number;
}

export type SimPhase =
  | 'TICKET_SELECTION'
  | 'PERMISSIONS_MODAL'
  | 'WALKING_OUTSIDE'
  | 'INSIDE_VENUE'
  | 'SEATED_WAITING'
  | 'CONCERT_PLAYING'
  | 'CONCERT_BLACKOUT'
  | 'CONCERT_FINALE'
  | 'EXITING_VENUE'
  | 'COMPLETED'
  | 'SPEED_LIMIT_FAIL'
  | 'FLASHLIGHT_EXPELLED'
  | 'EVENT_MISSED';

export interface SensorState {
  gyroscopeAllowed: boolean;
  gyroscopeActive: boolean;
  micAllowed: boolean;
  micActive: boolean;
  cameraAllowed: boolean;
  cameraActive: boolean;
}

export interface OrientationData {
  alpha: number; // Z-axis (0-360)
  beta: number;  // X-axis (-180 to 180)
  gamma: number; // Y-axis (-90 to 90)
}

export interface AudioMetrics {
  volume: number;    // 0.0 to 1.0
  bassLevel: number; // 0.0 to 1.0
  trebleLevel: number;
}

export interface AppState {
  isInitialized: boolean;
  phase: SimPhase;
  ticket: TicketInfo;
  sensors: SensorState;
  orientationData: OrientationData;
  audioMetrics: AudioMetrics;
  speed: number;
  isInsideVenue: boolean;
  isSeated: boolean;
  flashlightOn: boolean;
  timeRemainingSeconds: number; // 3 min countdown
  sprintEnabled: boolean;
  cameraMode: 'FIRST_PERSON' | 'THIRD_PERSON';
  flashlightWarningSeconds: number | null; // 5-second countdown to turn off flashlight or be expelled
  blackoutRemainingSeconds: number | null; // Countdown for blackout ending
  gpsWalkEnabled: boolean;
  gpsDistanceWalked: number;
  gpsAccuracy: number | null;
  customMediaName: string | null;
  customMediaUrl: string | null;
  audienceExitRemainingSeconds: number | null;
  isVenueEmpty: boolean;
  hasExploredEmptyVenue: boolean;
  blackoutCycle: number;
  targetBlackouts: number;
}
