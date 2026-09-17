export interface GtfsStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface GtfsRoute {
  id: string;
  shortName: string;
  longName: string;
  /** The real line name (e.g. "YELLOW", "VIOLET", "RAPID") parsed from route_long_name's own
   * prefix — DMRC's actual naming, not a guess. */
  lineName: string;
}

export interface GtfsTrip {
  id: string;
  routeId: string;
  serviceId: string;
}

export interface GtfsStopTime {
  tripId: string;
  stopId: string;
  sequence: number;
  arrivalSec: number;
  departureSec: number;
  /** Real cumulative track distance in meters from the trip's first stop (GTFS's own
   * shape_dist_traveled) — used for fare calculation instead of straight-line distance, since a
   * Metro journey (especially with an interchange) covers meaningfully more real distance than a
   * crow-flies line between origin and destination. */
  distTraveledMeters: number | null;
}

export interface GtfsCalendar {
  serviceId: string;
  days: [boolean, boolean, boolean, boolean, boolean, boolean, boolean]; // Mon..Sun
}

export interface GtfsData {
  stops: Map<string, GtfsStop>;
  routes: Map<string, GtfsRoute>;
  trips: Map<string, GtfsTrip>;
  stopTimesByTrip: Map<string, GtfsStopTime[]>;
  tripIdsByRoute: Map<string, string[]>;
  calendar: Map<string, GtfsCalendar>;
  /** Real DMRC line names, derived from routes.txt (e.g. "RED", "YELLOW", "VIOLET", "RAPID"). */
  lineNames: string[];
  /** Every stop_id that appears anywhere on a given line, across both directions/segments. */
  stopsOnLine: Map<string, Set<string>>;
  routeIdsForLine: Map<string, string[]>;
}
