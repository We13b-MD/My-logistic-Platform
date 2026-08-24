import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { trackingApi } from "@/api/tracking.api";
import { toast } from "sonner";
import { DeliveryStatus } from "@/types";
import { Icon } from "@iconify/react";
import { useOsrmRoute } from "@/utils/useOsrmRoute";

// Leaflet map imports
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
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

const driverIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export function PublicTrackingPage() {
  const { code: urlCode } = useParams<{ code?: string }>();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState(urlCode || "");
  const [loading, setLoading] = useState(false);
  const [trackingData, setTrackingData] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const fetchTracking = async (codeToFetch: string) => {
    if (!codeToFetch.trim()) return;
    setLoading(true);
    setErrorMsg(null);

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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#29a195] flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-slate-950 text-[24px]">hub</span>
          </div>
          <div>
            <h1 className="font-display text-lg text-slate-100 font-bold tracking-tight leading-none">
              Logistel
            </h1>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
              Live Package Tracking Portal
            </span>
          </div>
        </div>

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
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
                      trackingData.status === "DELIVERED"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                        : trackingData.status === "CANCELLED"
                        ? "bg-rose-500/15 text-rose-400 border-rose-500/25"
                        : "bg-teal-500/15 text-teal-300 border-teal-500/25"
                    }`}
                  >
                    {trackingData.status}
                  </span>
                </div>
              </div>

              {/* 5-Step Stepper Line */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 relative">
                {steps.map((step) => {
                  const state = getStepStatus(step.key, trackingData.status);
                  return (
                    <div
                      key={step.key}
                      className={`flex flex-col items-center text-center p-3.5 rounded-xl border transition-all ${
                        state === "COMPLETED"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : state === "ACTIVE"
                          ? "bg-teal-500/15 border-teal-500/40 text-teal-300 font-bold"
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
              <div className="lg:col-span-2 glass-panel border-slate-800 p-4 rounded-2xl h-[420px] relative overflow-hidden">
                <MapContainer
                  center={[trackingData.pickupLatitude, trackingData.pickupLongitude]}
                  zoom={12}
                  scrollWheelZoom={true}
                  className="w-full h-full rounded-xl z-0"
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                  />

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

                  {/* Driver Marker (If active) */}
                  {trackingData.driver?.latitude && trackingData.driver?.longitude && (
                    <Marker
                      position={[trackingData.driver.latitude, trackingData.driver.longitude]}
                      icon={driverIcon}
                    >
                      <Popup>
                        <div className="text-xs">
                          <strong>Active Courier Vehicle</strong>
                          <p>Type: {trackingData.driver.vehicleType}</p>
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

