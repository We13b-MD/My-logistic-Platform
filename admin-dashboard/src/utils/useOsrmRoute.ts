import { useState, useEffect } from "react";

/**
 * useOsrmRoute
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches a real-road route between two coordinates using the public OSRM demo
 * server (https://router.project-osrm.org). Returns:
 *   - routeCoords  : Array of [lat, lng] tuples that form the road path
 *   - distanceKm   : Road distance in kilometres
 *   - durationMins : Estimated drive time in minutes
 *   - loading      : true while the request is in flight
 *   - error        : error message string if the request failed
 *
 * The hook skips the fetch when any coordinate is missing / 0.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface OsrmRouteResult {
  routeCoords: [number, number][];
  distanceKm: number | null;
  durationMins: number | null;
  rawDurationMins: number | null;
  durationRange: string | null;
  trafficMultiplier: number | null;
  trafficCondition: "FREE_FLOW" | "NORMAL_CITY" | "PEAK_RUSH" | null;
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
      return;
    }

    let cancelled = false;

    const fetchRoute = async () => {
      setLoading(true);
      setError(null);

      try {
        // OSRM public demo endpoint — free, no API key required
        // Format: /route/v1/{profile}/{lng,lat};{lng,lat}
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}` +
          `?overview=full&geometries=geojson`;

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
          // Fall back silently — the caller can draw a straight line if needed
          setRouteCoords([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRoute();

    // Cleanup: if coordinates change before the fetch completes, ignore stale response
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
    loading,
    error,
  };
}
