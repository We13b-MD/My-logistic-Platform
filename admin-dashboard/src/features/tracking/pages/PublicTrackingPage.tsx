import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { trackingApi } from "@/api/tracking.api";
import { toast } from "sonner";
import { DeliveryStatus } from "@/types";
import { Icon } from "@iconify/react";
import { LogistelLogo } from "@/components/LogistelLogo";
import { useOsrmRoute } from "@/utils/useOsrmRoute";

// Leaflet map imports
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Resolve Leaflet marker asset bundle paths in Vite
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const pickupIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const dropoffIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Custom pulsating animated courier marker for live motion
const liveCourierIcon = new L.DivIcon({
  className: "live-courier-marker",
  html: `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 46px; height: 46px;">
      <div style="position: absolute; width: 42px; height: 42px; border-radius: 9999px; background: rgba(6, 182, 212, 0.45); animation: ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: relative; width: 36px; height: 36px; border-radius: 9999px; background: linear-gradient(135deg, #06b6d4, #0284c7); border: 2.5px solid #ffffff; box-shadow: 0 4px 14px rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; font-size: 17px; cursor: pointer;">
        🛵
      </div>
    </div>
  `,
  iconSize: [46, 46],
  iconAnchor: [23, 23],
  popupAnchor: [0, -23],
});

// Smooth map recenter watcher component
function MapFollower({ center, enabled }: { center: [number, number] | null; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (center && enabled) {
      map.panTo(center, { animate: true, duration: 0.3 });
    }
  }, [center, enabled, map]);
  return null;
}

export function PublicTrackingPage() {
  const { code: urlCode } = useParams<{ code?: string }>();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState(urlCode || "");
  const [loading, setLoading] = useState(false);
  const [trackingData, setTrackingData] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Live Driver Simulation States
  const [isSimulating, setIsSimulating] = useState(false);
  const [simIndex, setSimIndex] = useState(0);
  const [simSpeed, setSimSpeed] = useState<1 | 2 | 4>(1);
  const [simulatedStatus, setSimulatedStatus] = useState<DeliveryStatus | null>(null);
  const [followVehicle, setFollowVehicle] = useState(true);

  // OSRM real-road route between pickup and dropoff
  const {
    routeCoords,
    distanceKm,
    durationMins,
    loading: routeLoading,
  } = useOsrmRoute(
    trackingData?.pickupLatitude,
    trackingData?.pickupLongitude,
    trackingData?.dropoffLatitude,
    trackingData?.dropoffLongitude
  );

  // Active path for courier movement (real road path or interpolated line)
  const activePath: [number, number][] = useMemo(() => {
    if (routeCoords && routeCoords.length > 1) {
      return routeCoords;
    }
    if (
      trackingData?.pickupLatitude &&
      trackingData?.pickupLongitude &&
      trackingData?.dropoffLatitude &&
      trackingData?.dropoffLongitude
    ) {
      const p1: [number, number] = [trackingData.pickupLatitude, trackingData.pickupLongitude];
      const p2: [number, number] = [trackingData.dropoffLatitude, trackingData.dropoffLongitude];
      const points: [number, number][] = [];
      const steps = 70;
      for (let i = 0; i <= steps; i++) {
        const ratio = i / steps;
        points.push([
          p1[0] + (p2[0] - p1[0]) * ratio,
          p1[1] + (p2[1] - p1[1]) * ratio,
        ]);
      }
      return points;
    }
    return [];
  }, [routeCoords, trackingData]);

  // Current position of courier vehicle
  const currentCourierPos: [number, number] | null = useMemo(() => {
    if ((isSimulating || simIndex > 0) && activePath.length > 0) {
      return activePath[Math.min(simIndex, activePath.length - 1)];
    }
    if (trackingData?.driver?.latitude && trackingData?.driver?.longitude) {
      return [trackingData.driver.latitude, trackingData.driver.longitude];
    }
    return null;
  }, [isSimulating, simIndex, activePath, trackingData]);

  const simProgressPercent = activePath.length > 1
    ? Math.round((simIndex / (activePath.length - 1)) * 100)
    : 0;

  // Active status considering live simulation
  const effectiveStatus: DeliveryStatus = simulatedStatus || trackingData?.status || "PENDING";

  // Simulation tick loop
  useEffect(() => {
    if (!isSimulating || activePath.length === 0) return;

    const intervalMs = Math.max(30, Math.floor(130 / simSpeed));
    const timer = setInterval(() => {
      setSimIndex((prev) => {
        if (prev >= activePath.length - 1) {
          setIsSimulating(false);
          setSimulatedStatus("DELIVERED");
          toast.success("🎉 Courier has arrived at destination! Delivery successfully completed.");
          return prev;
        }
        const next = prev + 1;
        const progress = next / (activePath.length - 1);
        if (progress < 0.15) setSimulatedStatus("ASSIGNED");
        else if (progress < 0.35) setSimulatedStatus("PICKED_UP");
        else if (progress < 0.98) setSimulatedStatus("IN_TRANSIT");
        else setSimulatedStatus("DELIVERED");
        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isSimulating, activePath, simSpeed]);

  const toggleSimulation = () => {
    if (activePath.length === 0) {
      toast.error("Waiting for route coordinates to calculate...");
      return;
    }
    if (simIndex >= activePath.length - 1) {
      setSimIndex(0);
      setSimulatedStatus("ASSIGNED");
      setIsSimulating(true);
      toast.info("Restarting live courier drive simulation...");
      return;
    }
    setIsSimulating((prev) => {
      const next = !prev;
      if (next) toast.success("Live courier simulation started! Watch the vehicle navigate the roads.");
      return next;
    });
  };

  const resetSimulation = () => {
    setIsSimulating(false);
    setSimIndex(0);
    setSimulatedStatus(null);
  };

  const fetchTracking = async (codeToFetch: string) => {
    if (!codeToFetch.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    resetSimulation();

    try {
      const res = await trackingApi.getPublicTrackingInfo(codeToFetch.trim());
      if (res.data?.status === "success" && res.data?.data) {
        setTrackingData(res.data.data);
      } else {
        setTrackingData(null);
        setErrorMsg("No shipment found matching this tracking code.");
      }
    } catch (err: any) {
      console.error("Public tracking search error:", err);
      setTrackingData(null);
      setErrorMsg(err.response?.data?.message || "No shipment found matching this tracking code or OTP.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (urlCode) {
      setSearchInput(urlCode);
      fetchTracking(urlCode);
    }
  }, [urlCode]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) {
      toast.error("Please enter a 6-digit OTP or Delivery ID.");
      return;
    }
    navigate(`/track/${searchInput.trim()}`);
    fetchTracking(searchInput.trim());
  };

  // 5-Step Progress Bar status order mapping using clean Iconify icons
  const steps: { key: DeliveryStatus; label: string; icon: string }[] = [
    { key: "PENDING", label: "Order Placed", icon: "solar:box-minimalistic-bold-duotone" },
    { key: "ASSIGNED", label: "Courier Assigned", icon: "solar:user-rounded-bold-duotone" },
    { key: "PICKED_UP", label: "Cargo Collected", icon: "solar:delivery-bold-duotone" },
    { key: "IN_TRANSIT", label: "Out for Delivery", icon: "solar:routing-bold-duotone" },
    { key: "DELIVERED", label: "Delivered", icon: "solar:check-circle-bold-duotone" },
  ];

  const getStepStatus = (stepKey: DeliveryStatus, currentStatus: DeliveryStatus) => {
    if (currentStatus === "CANCELLED") return "CANCELLED";

    const statusOrder: DeliveryStatus[] = ["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const stepIndex = statusOrder.indexOf(stepKey);

    if (stepIndex < currentIndex) return "COMPLETED";
    if (stepIndex === currentIndex) return "ACTIVE";
    return "UPCOMING";
  };

  return (
    <div className="min-h-screen w-full bg-[#080D1A] text-slate-100 flex flex-col font-body-md relative overflow-x-hidden">
      {/* Top Enterprise Header */}
      <header className="glass-panel border-b border-slate-800 px-6 py-4 flex items-center justify-between z-20 sticky top-0">
        <LogistelLogo
          size="md"
          subtext="Live Package Tracking Portal"
          onClick={() => navigate("/")}
        />

        <button
          onClick={() => navigate("/login")}
          className="text-xs font-semibold text-teal-400 hover:text-teal-300 border border-teal-500/20 bg-teal-500/10 px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <span>Partner Login</span>
          <Icon icon="lucide:arrow-right" className="text-xs" />
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-[1200px] w-full mx-auto px-4 py-8 space-y-6 z-10">
        {/* Search Bar Section */}
        <div className="glass-panel border-slate-800 p-6 rounded-2xl space-y-4 max-w-2xl mx-auto text-center shadow-xl">
          <h2 className="font-display text-xl text-slate-100 font-bold">
            Track Your Package Live
          </h2>
          <p className="text-xs text-slate-400">
            Enter your 6-digit confirmation PIN / OTP or Tracking Number below.
          </p>

          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 pt-2">
            <input
              type="text"
              placeholder="e.g. 542381 or Order ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-grow bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-100 focus:border-teal-400 outline-none font-mono placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-[#29a195] hover:bg-[#22877d] text-slate-950 font-bold px-6 py-3 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              {loading ? (
                <Icon icon="lucide:loader-2" className="animate-spin text-lg" />
              ) : (
                <Icon icon="lucide:search" className="text-lg" />
              )}
              Track Order
            </button>
          </form>

          {/* Quick Demo Code Suggestions */}
          <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <span>Sample Demo Codes:</span>
            <button
              type="button"
              onClick={() => {
                setSearchInput("542381");
                fetchTracking("542381");
              }}
              className="font-mono text-teal-400 font-bold hover:underline bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded cursor-pointer"
            >
              542381
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchInput("983210");
                fetchTracking("983210");
              }}
              className="font-mono text-teal-400 font-bold hover:underline bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded cursor-pointer"
            >
              983210
            </button>
          </div>
        </div>

        {/* Error State */}
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-xl text-center text-xs max-w-2xl mx-auto flex items-center justify-center gap-2">
            <Icon icon="solar:danger-triangle-bold" className="text-rose-400 text-lg" />
            {errorMsg}
          </div>
        )}

        {/* Tracking Details & Map View */}
        {trackingData && (
          <div className="space-y-6">
            {/* Shipment Status Stepper / Progress Bar */}
            <div className="glass-panel border-slate-800 p-6 rounded-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] text-teal-400 uppercase font-bold tracking-widest block">
                    {trackingData.companyName}
                  </span>
                  <h3 className="font-display text-lg text-slate-100 font-bold mt-0.5">
                    Package for {trackingData.recipientName}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase border transition-all ${
                      effectiveStatus === "DELIVERED"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                        : effectiveStatus === "CANCELLED"
                        ? "bg-rose-500/15 text-rose-400 border-rose-500/25"
                        : "bg-teal-500/15 text-teal-300 border-teal-500/25"
                    }`}
                  >
                    {effectiveStatus}
                  </span>
                </div>
              </div>

              {/* 5-Step Stepper Line */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 relative">
                {steps.map((step) => {
                  const state = getStepStatus(step.key, effectiveStatus);
                  return (
                    <div
                      key={step.key}
                      className={`flex flex-col items-center text-center p-3.5 rounded-xl border transition-all ${
                        state === "COMPLETED"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : state === "ACTIVE"
                          ? "bg-teal-500/15 border-teal-500/40 text-teal-300 font-bold shadow-lg shadow-teal-500/10"
                          : "bg-slate-900/40 border-slate-800 text-slate-500"
                      }`}
                    >
                      <div className="p-2 rounded-xl mb-2 bg-slate-900 border border-slate-800">
                        <Icon icon={step.icon} className="text-xl" />
                      </div>
                      <span className="text-xs font-bold">{step.label}</span>
                      <span className="text-[9px] uppercase tracking-wider font-semibold opacity-75 mt-0.5">
                        {state}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Leaflet Map & Info Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Map Canvas (2 columns) */}
              <div className="lg:col-span-2 glass-panel border-slate-800 p-4 rounded-2xl h-[460px] relative overflow-hidden flex flex-col">
                
                {/* Interactive Live Simulation Control Header */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/60 shadow-lg">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleSimulation}
                      type="button"
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                        isSimulating
                          ? "bg-amber-500 hover:bg-amber-400 text-slate-950 animate-pulse"
                          : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                      }`}
                    >
                      <Icon icon={isSimulating ? "solar:pause-bold" : "solar:play-bold"} className="text-sm" />
                      <span>{isSimulating ? "Pause Courier" : simIndex > 0 ? "Resume Drive" : "▶ Simulate Live Drive"}</span>
                    </button>

                    <button
                      onClick={resetSimulation}
                      type="button"
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                      title="Reset Route to Start"
                    >
                      <Icon icon="solar:restart-bold" className="text-xs" />
                      <span>Reset</span>
                    </button>
                  </div>

                  {/* Speed Selector */}
                  <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-800 text-xs">
                    <span className="text-[10px] text-slate-400 font-bold px-1 uppercase">Speed:</span>
                    {([1, 2, 4] as const).map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => setSimSpeed(spd)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                          simSpeed === spd
                            ? "bg-cyan-500 text-slate-950 shadow"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>

                  {/* Live Telemetry Pill */}
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-cyan-300 font-mono font-bold bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-1 rounded-lg">
                      <span className={`inline-block w-2 h-2 rounded-full ${isSimulating ? "bg-cyan-400 animate-ping" : "bg-slate-500"}`}></span>
                      <span>{isSimulating ? "Moving • 42 km/h" : simIndex > 0 ? "Paused" : "Ready"}</span>
                      <span className="text-slate-500">|</span>
                      <span>{simProgressPercent}%</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setFollowVehicle(!followVehicle)}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        followVehicle
                          ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                      title="Camera follows moving courier"
                    >
                      Follow 🎯
                    </button>
                  </div>
                </div>

                {/* Map Container */}
                <div className="flex-1 w-full relative rounded-xl overflow-hidden">
                  <MapContainer
                    center={[trackingData.pickupLatitude, trackingData.pickupLongitude]}
                    zoom={12}
                    scrollWheelZoom={true}
                    className="w-full h-full rounded-xl z-0"
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />

                    {/* Smooth Camera Recenter Follower */}
                    <MapFollower center={currentCourierPos} enabled={isSimulating && followVehicle} />

                    {/* Pickup Marker */}
                    <Marker
                      position={[trackingData.pickupLatitude, trackingData.pickupLongitude]}
                      icon={pickupIcon}
                    >
                      <Popup>
                        <div className="text-xs">
                          <strong>Pickup Address:</strong>
                          <p>{trackingData.pickupAddress}</p>
                        </div>
                      </Popup>
                    </Marker>

                    {/* Dropoff Marker */}
                    <Marker
                      position={[trackingData.dropoffLatitude, trackingData.dropoffLongitude]}
                      icon={dropoffIcon}
                    >
                      <Popup>
                        <div className="text-xs">
                          <strong>Destination Address:</strong>
                          <p>{trackingData.dropoffAddress}</p>
                        </div>
                      </Popup>
                    </Marker>

                    {/* Live Moving Courier Marker */}
                    {currentCourierPos && (
                      <Marker
                        position={currentCourierPos}
                        icon={liveCourierIcon}
                      >
                        <Popup>
                          <div className="text-xs space-y-1">
                            <strong className="text-cyan-400 font-bold block flex items-center gap-1">
                              <span>🛵</span> Active Dispatch Courier
                            </strong>
                            <p className="font-semibold text-slate-200">
                              Vehicle: {trackingData.driver?.vehicleType || "BIKE"} ({trackingData.driver?.licenseNumber || "DL-SWIFT-99123"})
                            </p>
                            <p className="text-slate-400">
                              Motion Status: <span className="text-cyan-300 font-bold">{isSimulating ? "En Route (42 km/h)" : simIndex > 0 ? "Stationary (Paused)" : "Ready at Station"}</span>
                            </p>
                            <p className="text-slate-400 font-mono">
                              Trip Progress: <span className="text-teal-300 font-bold">{simProgressPercent}% complete</span>
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    )}

                    {/* OSRM Real-Road Route Polyline */}
                    {routeCoords.length > 1 ? (
                      <Polyline
                        positions={routeCoords}
                        color="#00F2FE"
                        weight={4}
                        opacity={0.85}
                      />
                    ) : (
                      // Fallback straight-line while route loads or if OSRM unavailable
                      <Polyline
                        positions={[
                          [trackingData.pickupLatitude, trackingData.pickupLongitude],
                          [trackingData.dropoffLatitude, trackingData.dropoffLongitude],
                        ]}
                        color="#00F2FE"
                        weight={3}
                        dashArray="5, 10"
                        opacity={0.5}
                      />
                    )}
                  </MapContainer>
                </div>
              </div>

              {/* Delivery Details Side Panel */}
              <div className="lg:col-span-1 glass-panel border-slate-800 p-6 rounded-2xl space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <h4 className="font-display text-xs text-teal-400 font-bold uppercase tracking-wider border-b border-slate-800 pb-2">
                    Shipment Locations
                  </h4>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Pickup Origin</span>
                      <p className="text-slate-200 font-semibold mt-0.5">{trackingData.pickupAddress}</p>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Destination Dropoff</span>
                      <p className="text-slate-200 font-semibold mt-0.5">{trackingData.dropoffAddress}</p>
                    </div>

                    {/* OSRM Road Distance & ETA Badge */}
                    {(distanceKm !== null || routeLoading) && (
                      <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-3 space-y-1">
                        <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider block flex items-center gap-1">
                          <Icon icon="solar:routing-bold-duotone" className="text-sm" />
                          Live Route Info
                        </span>
                        {routeLoading ? (
                          <p className="text-slate-400 text-xs flex items-center gap-1.5">
                            <Icon icon="lucide:loader-2" className="animate-spin text-sm" />
                            Calculating road route...
                          </p>
                        ) : (
                          <div className="flex gap-4 text-xs">
                            <div>
                              <span className="text-[9px] text-slate-400 uppercase block">Road Distance</span>
                              <span className="font-mono font-bold text-slate-200">{distanceKm} km</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 uppercase block">Drive Time</span>
                              <span className="font-mono font-bold text-teal-300">{durationMins} mins</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {trackingData.expectedDeliveryTime && (
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Expected Deadline</span>
                        <p className="text-teal-400 font-mono font-bold mt-0.5">
                          {new Date(trackingData.expectedDeliveryTime).toLocaleString()}
                        </p>
                      </div>
                    )}

                    {trackingData.driver && (
                      <div className="pt-2 border-t border-slate-800">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Assigned Vehicle</span>
                        <div className="flex items-center gap-2 mt-1 text-slate-200">
                          <Icon
                            icon={
                              trackingData.driver.vehicleType === "BIKE"
                                ? "solar:scooter-bold-duotone"
                                : trackingData.driver.vehicleType === "VAN"
                                ? "solar:bus-bold-duotone"
                                : trackingData.driver.vehicleType === "TRUCK"
                                ? "solar:delivery-bold-duotone"
                                : "solar:wheel-bold-duotone"
                            }
                            className="text-teal-400 text-lg"
                          />
                          <span className="font-bold uppercase text-xs">{trackingData.driver.vehicleType}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({trackingData.driver.licenseNumber})</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* POD Certificate Preview if Delivered */}
                {trackingData.status === "DELIVERED" && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-xl text-xs space-y-2">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block flex items-center gap-1.5">
                      <Icon icon="solar:verified-check-bold" className="text-emerald-400 text-base" />
                      Verified Handoff Completed
                    </span>

                    {trackingData.signaturePhotoUrl && (
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase block">Recipient Signature</span>
                        <img
                          src={trackingData.signaturePhotoUrl}
                          alt="Signature"
                          className="max-h-[50px] object-contain bg-slate-950 p-1 rounded mt-1 border border-slate-800"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

