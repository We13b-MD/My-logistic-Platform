import { useState, useEffect } from "react";

/**
 * useOsrmRoute
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches a real-road route between two coordinates using the public OSRM demo
 * server (https://router.project-osrm.org). Returns:
 *   - routeCoords        : Array of [lat, lng] tuples that form the road path
 *   - distanceKm         : Road distance in kilometres
 *   - durationMins       : Estimated drive time in minutes (calibrated for traffic)
 *   - rawDurationMins    : Theoretical empty-highway duration
 *   - durationRange      : Formatted range string (e.g. "14 - 20 mins")
 *   - trafficMultiplier  : Dynamic multiplier applied
 *   - trafficCondition   : Traffic classification
 *   - steps              : Array of turn-by-turn maneuver steps for the In-App HUD
 *   - loading            : true while request is in flight
 *   - error              : error message string if request failed
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface RouteStep {
  instruction: string;        // e.g. "Turn left onto Bode Thomas St"
  streetName: string;         // e.g. "Bode Thomas St"
  maneuverType: string;       // e.g. "turn", "depart", "arrive", "roundabout"
  modifier?: string;          // e.g. "left", "right", "slight left", "sharp right", "straight"
  distanceMeters: number;     // e.g. 350
  durationSeconds: number;    // e.g. 45
  location: [number, number]; // [lat, lng] of the intersection
}

export interface OsrmRouteResult {
  routeCoords: [number, number][];
  distanceKm: number | null;
  durationMins: number | null;
  rawDurationMins: number | null;
  durationRange: string | null;
  trafficMultiplier: number | null;
  trafficCondition: "FREE_FLOW" | "NORMAL_CITY" | "PEAK_RUSH" | null;
  steps: RouteStep[];
  loading: boolean;
  error: string | null;
}

export function useOsrmRoute(
  pickupLat: number | null | undefined,
  pickupLng: number | null | undefined,
  dropoffLat: number | null | undefined,
  dropoffLng: number | null | undefined,
  vehicleType?: string | null
): OsrmRouteResult {
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMins, setDurationMins] = useState<number | null>(null);
  const [rawDurationMins, setRawDurationMins] = useState<number | null>(null);
  const [durationRange, setDurationRange] = useState<string | null>(null);
  const [trafficMultiplier, setTrafficMultiplier] = useState<number | null>(null);
  const [trafficCondition, setTrafficCondition] = useState<"FREE_FLOW" | "NORMAL_CITY" | "PEAK_RUSH" | null>(null);
  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guard: skip if any coordinate is missing or zero
    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
      setRouteCoords([]);
      setDistanceKm(null);
      setDurationMins(null);
      setRawDurationMins(null);
      setTrafficMultiplier(null);
      setTrafficCondition(null);
      setSteps([]);
      return;
    }

    let cancelled = false;

    const fetchRoute = async () => {
      setLoading(true);
      setError(null);

      try {
        // Request route with geometries AND turn-by-turn maneuver steps
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}` +
          `?overview=full&geometries=geojson&steps=true`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`OSRM responded with status ${response.status}`);
        }

        const data = await response.json();

        if (cancelled) return;

        if (data.code !== "Ok" || !data.routes?.length) {
          throw new Error("No route found between these coordinates.");
        }

        const route = data.routes[0];

        // GeoJSON coordinates are [lng, lat] — flip them to [lat, lng] for Leaflet
        const coords: [number, number][] = route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng]
        );

        setRouteCoords(coords);
        // distance is in metres → convert to km
        setDistanceKm(Math.round((route.distance / 1000) * 10) / 10);

        // Raw theoretical duration (free-flow empty expressway)
        const idealMins = Math.round(route.duration / 60);
        setRawDurationMins(idealMins);

        // ─────────────────────────────────────────────────────────────────────
        // Parse Turn-by-Turn Maneuver Steps for the In-App HUD
        // ─────────────────────────────────────────────────────────────────────
        const rawSteps = route.legs?.[0]?.steps || [];
        const parsedSteps: RouteStep[] = rawSteps.map((s: any) => {
          const type = s.maneuver?.type || "continue";
          const modifier = s.maneuver?.modifier || "";
          const name = s.name || "Unnamed Road";

          // Generate human-friendly speech & text instruction
          let text = `Continue on ${name}`;
          if (type === "depart") text = `Head out on ${name}`;
          else if (type === "arrive") text = `Arrive at destination`;
          else if (type === "roundabout") text = `Enter roundabout and take exit onto ${name}`;
          else if (modifier) text = `Turn ${modifier} onto ${name}`;

          return {
            instruction: text,
            streetName: name,
            maneuverType: type,
            modifier: modifier,
            distanceMeters: Math.round(s.distance || 0),
            durationSeconds: Math.round(s.duration || 0),
            // Flip GeoJSON [lng, lat] to Leaflet [lat, lng]
            location: [s.maneuver.location[1], s.maneuver.location[0]] as [number, number],
          };
        });

        setSteps(parsedSteps);

        // ─────────────────────────────────────────────────────────────────────
        // Lagos Urban Traffic Multiplier (Realistic City Calibration)
        // ─────────────────────────────────────────────────────────────────────
        const currentHour = new Date().getHours();
        const isPeak =
          (currentHour >= 7 && currentHour <= 10) || (currentHour >= 16 && currentHour <= 20);
        const isLateNight = currentHour >= 22 || currentHour < 6;

        const condition: "FREE_FLOW" | "NORMAL_CITY" | "PEAK_RUSH" = isLateNight
          ? "FREE_FLOW"
          : isPeak
          ? "PEAK_RUSH"
          : "NORMAL_CITY";

        const vType = (vehicleType || "BIKE").toUpperCase();
        let multiplier = 2.4; // standard urban default

        if (vType === "BIKE") {
          // Motorbikes can lane-split past traffic jams
          multiplier = isLateNight ? 1.2 : isPeak ? 2.2 : 1.8;
        } else if (vType === "TRUCK") {
          // Heavy trucks are subject to movement restrictions & slow acceleration
          multiplier = isLateNight ? 1.5 : isPeak ? 4.0 : 3.2;
        } else {
          // CAR / VAN
          multiplier = isLateNight ? 1.3 : isPeak ? 3.5 : 2.6;
        }

        const realisticDuration = Math.max(1, Math.round(idealMins * multiplier));
        const minMins = Math.max(1, Math.round(idealMins * (multiplier * 0.85)));
        const maxMins = Math.max(minMins + 2, Math.round(idealMins * (multiplier * 1.25)));
        const rangeStr = `${minMins} - ${maxMins} mins`;

        setDurationMins(realisticDuration);
        setDurationRange(rangeStr);
        setTrafficMultiplier(multiplier);
        setTrafficCondition(condition);
      } catch (err: any) {
        if (!cancelled) {
          console.warn("OSRM route fetch failed:", err.message);
          setError(err.message || "Route unavailable.");
          setRouteCoords([]);
          setSteps([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRoute();

    // Cleanup: if coordinates change before fetch completes, ignore stale response
    return () => {
      cancelled = true;
    };
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType]);

  return {
    routeCoords,
    distanceKm,
    durationMins,
    rawDurationMins,
    durationRange,
    trafficMultiplier,
    trafficCondition,
    steps,
    loading,
    error,
  };
}
