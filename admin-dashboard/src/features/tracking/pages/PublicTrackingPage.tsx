import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { trackingApi } from "@/api/tracking.api";
import { toast } from "sonner";
import { DeliveryStatus } from "@/types";

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

  // 5-Step Progress Bar status order mapping
  const steps: { key: DeliveryStatus; label: string; icon: string }[] = [
    { key: "PENDING", label: "Order Placed", icon: "inventory_2" },
    { key: "ASSIGNED", label: "Courier Assigned", icon: "badge" },
    { key: "PICKED_UP", label: "Cargo Collected", icon: "local_shipping" },
    { key: "IN_TRANSIT", label: "Out for Delivery", icon: "near_me" },
    { key: "DELIVERED", label: "Delivered", icon: "task_alt" },
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
    <div
      className="min-h-screen w-full text-on-surface flex flex-col font-body-md relative overflow-x-hidden"
      style={{
        backgroundColor: "#0B1326",
        backgroundImage: `
          radial-gradient(at 0% 0%, rgba(13, 148, 136, 0.12) 0px, transparent 50%),
          radial-gradient(at 100% 100%, rgba(3, 181, 211, 0.08) 0px, transparent 50%)
        `,
      }}
    >
      {/* Top Header */}
      <header className="glass-panel border-b border-white/10 px-6 py-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[32px]">local_shipping</span>
          <div>
            <h1 className="font-headline-md text-headline-md text-primary font-bold tracking-tight leading-none">
              Logistel
            </h1>
            <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold">
              Live Package Tracking Portal
            </span>
          </div>
        </div>

        <button
          onClick={() => navigate("/login")}
          className="text-xs font-semibold text-primary hover:underline border border-primary/20 bg-primary/10 px-3 py-1.5 rounded-lg"
        >
          Partner Login →
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-[1200px] w-full mx-auto px-4 py-8 space-y-6 z-10">
        {/* Search Bar Section */}
        <div className="glass-panel border-white/5 p-6 rounded-2xl space-y-4 max-w-2xl mx-auto text-center shadow-xl">
          <h2 className="font-headline-md text-xl text-on-surface font-bold">
            Track Your Package Live
          </h2>
          <p className="text-xs text-on-surface-variant">
            Enter your 6-digit confirmation PIN / OTP or Tracking Number below.
          </p>

          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 pt-2">
            <input
              type="text"
              placeholder="e.g. 542381 or Order ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-grow bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface focus:border-primary outline-none font-mono"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-on-primary font-bold px-6 py-3 rounded-xl text-sm hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              {loading ? (
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[18px]">search</span>
              )}
              Track Order
            </button>
          </form>

          {/* Quick Demo Code Suggestions */}
          <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-on-surface-variant">
            <span>Sample Demo Codes:</span>
            <button
              type="button"
              onClick={() => {
                setSearchInput("542381");
                fetchTracking("542381");
              }}
              className="font-mono text-primary font-bold hover:underline bg-primary/10 px-2 py-0.5 rounded"
            >
              542381
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchInput("983210");
                fetchTracking("983210");
              }}
              className="font-mono text-primary font-bold hover:underline bg-primary/10 px-2 py-0.5 rounded"
            >
              983210
            </button>
          </div>
        </div>

        {/* Error State */}
        {errorMsg && (
          <div className="bg-error/10 border border-error/30 text-error p-4 rounded-xl text-center text-xs max-w-2xl mx-auto flex items-center justify-center gap-2">
            <span className="material-symbols-outlined">warning</span>
            {errorMsg}
          </div>
        )}

        {/* Tracking Details & Map View */}
        {trackingData && (
          <div className="space-y-6">
            {/* Shipment Status Stepper / Progress Bar */}
            <div className="glass-panel border-white/5 p-6 rounded-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                  <span className="text-[10px] text-primary uppercase font-bold tracking-widest">
                    {trackingData.companyName}
                  </span>
                  <h3 className="font-headline-md text-lg text-on-surface font-bold">
                    Package for {trackingData.recipientName}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-on-surface-variant uppercase font-bold block">Status</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
                      trackingData.status === "DELIVERED"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                        : trackingData.status === "CANCELLED"
                        ? "bg-error/15 text-error border-error/25"
                        : "bg-cyan-500/15 text-cyan-400 border-cyan-500/25"
                    }`}
                  >
                    {trackingData.status}
                  </span>
                </div>
              </div>

              {/* 5-Step Stepper Line */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 relative">
                {steps.map((step) => {
                  const state = getStepStatus(step.key, trackingData.status);
                  return (
                    <div
                      key={step.key}
                      className={`flex flex-col items-center text-center p-3 rounded-xl border transition-all ${
                        state === "COMPLETED"
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : state === "ACTIVE"
                          ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300 font-bold shadow-[0_0_15px_rgba(6,182,212,0.15)] animate-pulse"
                          : "bg-surface-container-low border-white/5 text-on-surface-variant/50"
                      }`}
                    >
                      <div className="p-2 rounded-full mb-1.5 bg-surface-container-high">
                        <span className="material-symbols-outlined text-[20px]">{step.icon}</span>
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
              <div className="lg:col-span-2 glass-panel border-white/5 p-4 rounded-2xl h-[420px] relative overflow-hidden">
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

                  {/* Polyline connecting pickup & dropoff */}
                  <Polyline
                    positions={[
                      [trackingData.pickupLatitude, trackingData.pickupLongitude],
                      [trackingData.dropoffLatitude, trackingData.dropoffLongitude],
                    ]}
                    color="#00F2FE"
                    weight={3}
                    dashArray="5, 10"
                  />
                </MapContainer>
              </div>

              {/* Delivery Details Side Panel */}
              <div className="lg:col-span-1 glass-panel border-white/5 p-6 rounded-2xl space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <h4 className="font-label-md text-label-md text-primary font-bold uppercase tracking-wider border-b border-white/5 pb-2">
                    Shipment Locations
                  </h4>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] text-on-surface-variant font-bold uppercase block">Pickup Origin</span>
                      <p className="text-on-surface font-semibold mt-0.5">{trackingData.pickupAddress}</p>
                    </div>

                    <div>
                      <span className="text-[10px] text-on-surface-variant font-bold uppercase block">Destination Dropoff</span>
                      <p className="text-on-surface font-semibold mt-0.5">{trackingData.dropoffAddress}</p>
                    </div>

                    {trackingData.expectedDeliveryTime && (
                      <div>
                        <span className="text-[10px] text-on-surface-variant font-bold uppercase block">Expected Deadline</span>
                        <p className="text-primary font-mono font-bold mt-0.5">
                          {new Date(trackingData.expectedDeliveryTime).toLocaleString()}
                        </p>
                      </div>
                    )}

                    {trackingData.driver && (
                      <div className="pt-2 border-t border-white/5">
                        <span className="text-[10px] text-on-surface-variant font-bold uppercase block">Assigned Vehicle</span>
                        <div className="flex items-center gap-2 mt-1 text-on-surface">
                          <span className="material-symbols-outlined text-primary text-[18px]">
                            {trackingData.driver.vehicleType === "BIKE"
                              ? "two_wheeler"
                              : trackingData.driver.vehicleType === "VAN"
                              ? "airport_shuttle"
                              : trackingData.driver.vehicleType === "TRUCK"
                              ? "local_shipping"
                              : "directions_car"}
                          </span>
                          <span className="font-bold uppercase text-xs">{trackingData.driver.vehicleType}</span>
                          <span className="text-[10px] text-on-surface-variant font-mono">({trackingData.driver.licenseNumber})</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* POD Certificate Preview if Delivered */}
                {trackingData.status === "DELIVERED" && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-xs space-y-2">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      Verified Handoff Completed
                    </span>

                    {trackingData.signaturePhotoUrl && (
                      <div>
                        <span className="text-[9px] text-on-surface-variant uppercase block">Recipient Signature</span>
                        <img
                          src={trackingData.signaturePhotoUrl}
                          alt="Signature"
                          className="max-h-[50px] object-contain bg-[#070D1B] p-1 rounded mt-0.5 border border-white/10"
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
