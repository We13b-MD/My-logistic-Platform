import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { deliveryApi } from "@/api/delivery.api";
import { trackingApi } from "@/api/tracking.api";
import { toast } from "sonner";
import { Delivery, DeliveryStatus } from "@/types";
import { Icon } from "@iconify/react";
import { useOsrmRoute } from "@/utils/useOsrmRoute";

// Leaflet map imports
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

// Lagos Center Presets for Quick Booking Selection
const LAGOS_LOCATIONS = [
  { name: "Surulere Mall, Surulere", lat: 6.502, lng: 3.358 },
  { name: "Herbert Macaulay Way, Yaba", lat: 6.5182, lng: 3.3769 },
  { name: "Computer Village, Ikeja", lat: 6.5983, lng: 3.3421 },
  { name: "Maryland Mall, Ikorodu Road", lat: 6.5684, lng: 3.3704 },
  { name: "Victoria Island Admiralty, VI", lat: 6.4281, lng: 3.4219 },
  { name: "Lekki Phase 1 Gate, Lekki", lat: 6.4474, lng: 3.4723 },
];

export function CustomerDashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<"track" | "book" | "history">("track");
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);

  // Live driver location tracking state
  const [liveDriverPos, setLiveDriverPos] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // OSRM real-road route — reacts to whichever delivery is selected
  const {
    routeCoords: osrmRouteCoords,
    distanceKm: osrmDistanceKm,
    durationMins: osrmDurationMins,
    loading: osrmRouteLoading,
  } = useOsrmRoute(
    selectedDelivery?.pickupLatitude,
    selectedDelivery?.pickupLongitude,
    selectedDelivery?.dropoffLatitude,
    selectedDelivery?.dropoffLongitude
  );

  // Booking Form State
  const [bookingForm, setBookingForm] = useState({
    recipientName: "",
    recipientPhone: "",
    recipientEmail: user?.email || "",
    senderPhone: "",
    pickupPreset: "0",
    dropoffPreset: "1",
    pickupAddress: LAGOS_LOCATIONS[0].name,
    pickupLat: LAGOS_LOCATIONS[0].lat.toString(),
    pickupLng: LAGOS_LOCATIONS[0].lng.toString(),
    dropoffAddress: LAGOS_LOCATIONS[1].name,
    dropoffLat: LAGOS_LOCATIONS[1].lat.toString(),
    dropoffLng: LAGOS_LOCATIONS[1].lng.toString(),
    expectedDeliveryTime: "",
  });
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  // Search in History
  const [historySearch, setHistorySearch] = useState("");

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const res = await deliveryApi.list();
      if (res.data?.status === "success") {
        const list: Delivery[] = res.data.data || [];
        setDeliveries(list);
        if (list.length > 0 && !selectedDelivery) {
          setSelectedDelivery(list[0]);
        }
      }
    } catch (error) {
      console.error("Failed to load customer deliveries:", error);
      toast.error("Failed to load your orders. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  // Poll live driver location when a delivery is selected and in progress
  useEffect(() => {
    if (!selectedDelivery) return;

    const fetchLiveLocation = async () => {
      try {
        const res = await trackingApi.getDeliveryDriverLocation(selectedDelivery.id);
        if (res.data?.status === "success" && res.data?.data?.driver) {
          const { latitude, longitude } = res.data.data.driver;
          if (latitude && longitude) {
            setLiveDriverPos({ latitude, longitude });
          }
        }
      } catch (err) {
        // Driver position unavailable or no driver assigned yet
        setLiveDriverPos(null);
      }
    };

    fetchLiveLocation();
    const interval = setInterval(fetchLiveLocation, 8000); // poll every 8 seconds
    return () => clearInterval(interval);
  }, [selectedDelivery]);

  // Estimate Fare preview calculation
  const calculateDistance = () => {
    const lat1 = parseFloat(bookingForm.pickupLat);
    const lon1 = parseFloat(bookingForm.pickupLng);
    const lat2 = parseFloat(bookingForm.dropoffLat);
    const lon2 = parseFloat(bookingForm.dropoffLng);

    if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 5.0;

    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return Math.max(1, Math.round(d * 10) / 10);
  };

  const estimatedDistanceKm = calculateDistance();
  const estimatedFare = Math.round(1200 + estimatedDistanceKm * 250);

  // Handle Booking Submit
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingSubmitting(true);

    try {
      const payload = {
        recipientName: bookingForm.recipientName,
        recipientPhone: bookingForm.recipientPhone,
        recipientEmail: bookingForm.recipientEmail,
        senderPhone: bookingForm.senderPhone,
        pickupAddress: bookingForm.pickupAddress,
        pickupLatitude: parseFloat(bookingForm.pickupLat),
        pickupLongitude: parseFloat(bookingForm.pickupLng),
        dropoffAddress: bookingForm.dropoffAddress,
        dropoffLatitude: parseFloat(bookingForm.dropoffLat),
        dropoffLongitude: parseFloat(bookingForm.dropoffLng),
        expectedDeliveryTime: bookingForm.expectedDeliveryTime
          ? new Date(bookingForm.expectedDeliveryTime).toISOString()
          : undefined,
      };

      const res = await deliveryApi.create(payload);
      if (res.data?.status === "success") {
        toast.success("Shipment order successfully placed!");
        setBookingForm({
          recipientName: "",
          recipientPhone: "",
          recipientEmail: "",
          senderPhone: "",
          pickupPreset: "0",
          dropoffPreset: "1",
          pickupAddress: LAGOS_LOCATIONS[0].name,
          pickupLat: LAGOS_LOCATIONS[0].lat.toString(),
          pickupLng: LAGOS_LOCATIONS[0].lng.toString(),
          dropoffAddress: LAGOS_LOCATIONS[1].name,
          dropoffLat: LAGOS_LOCATIONS[1].lat.toString(),
          dropoffLng: LAGOS_LOCATIONS[1].lng.toString(),
          expectedDeliveryTime: "",
        });
        await fetchDeliveries();
        setActiveTab("track");
      }
    } catch (error: any) {
      console.error("Failed to place delivery order:", error);
      const backendErrors = error.response?.data?.errors;
      const errorMsg = error.response?.data?.message || 
                       (Array.isArray(backendErrors) ? backendErrors.map((e: any) => e.message).join(', ') : null) || 
                       "Failed to book delivery order.";
      toast.error(errorMsg);
    } finally {
      setBookingSubmitting(false);
    }
  };

  const getStatusBadgeClass = (status: DeliveryStatus) => {
    switch (status) {
      case "DELIVERED":
        return "bg-emerald-950/80 text-emerald-400 border-emerald-800/60";
      case "IN_TRANSIT":
      case "PICKED_UP":
        return "bg-cyan-950/80 text-cyan-400 border-cyan-800/60";
      case "ASSIGNED":
        return "bg-indigo-950/80 text-indigo-400 border-indigo-800/60";
      case "PENDING":
        return "bg-amber-950/80 text-amber-400 border-amber-800/60";
      case "CANCELLED":
        return "bg-rose-950/80 text-rose-400 border-rose-800/60";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const renderStatusStepper = (currentStatus?: DeliveryStatus) => {
    const steps: { label: string; status: DeliveryStatus }[] = [
      { label: "Booked", status: "PENDING" },
      { label: "Driver Assigned", status: "ASSIGNED" },
      { label: "Picked Up", status: "PICKED_UP" },
      { label: "In Transit", status: "IN_TRANSIT" },
      { label: "Delivered", status: "DELIVERED" },
    ];

    const order: Record<DeliveryStatus, number> = {
      PENDING: 0,
      ASSIGNED: 1,
      PICKED_UP: 2,
      IN_TRANSIT: 3,
      DELIVERED: 4,
      CANCELLED: -1,
    };

    const currentIdx = currentStatus ? order[currentStatus] ?? 0 : 0;

    return (
      <div className="w-full py-4">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-800 -z-0"></div>
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500 -z-0"
            style={{ width: `${(currentIdx / (steps.length - 1)) * 100}%` }}
          ></div>

          {steps.map((step, idx) => {
            const isPassed = idx <= currentIdx;
            const isCurrent = idx === currentIdx;

            return (
              <div key={step.status} className="flex flex-col items-center relative z-10">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCurrent
                      ? "bg-emerald-400 text-slate-950 ring-4 ring-emerald-400/30 scale-110"
                      : isPassed
                      ? "bg-indigo-500 text-white"
                      : "bg-slate-800 text-slate-500 border border-slate-700"
                  }`}
                >
                  {isPassed ? "✓" : idx + 1}
                </div>
                <span
                  className={`text-[10px] mt-1.5 font-medium whitespace-nowrap ${
                    isCurrent
                      ? "text-emerald-400 font-bold"
                      : isPassed
                      ? "text-slate-200"
                      : "text-slate-500"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* ─── Top Header Navbar ─── */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 py-4 flex items-center justify-between shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#29a195] flex items-center justify-center text-slate-950 font-bold shadow-md">
            <span className="material-symbols-outlined text-slate-950 text-[24px]">hub</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">
              Customer Portal & Tracking
            </h1>
            <p className="text-xs text-slate-400">Live Express Freight Tracking</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setActiveTab("book")}
            className="hidden sm:flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#29a195] hover:bg-[#22877d] text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-sm"
          >
            <Icon icon="lucide:plus" className="text-base" />
            <span>Book New Delivery</span>
          </button>

          {/* User info badge */}
          <div className="flex items-center space-x-3 bg-slate-800/80 px-3.5 py-1.5 rounded-lg border border-slate-700">
            <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-300 font-semibold flex items-center justify-center text-sm border border-teal-500/30">
              {user?.email?.[0]?.toUpperCase() || "C"}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold text-slate-200 truncate max-w-[140px]">
                {user?.email}
              </div>
              <div className="text-[10px] text-teal-400 font-mono tracking-wider">
                {user?.role}
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="px-3 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs font-semibold transition-all"
          >
            Logout
          </button>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab("track")}
            className={`pb-3 transition-colors border-b-2 flex items-center space-x-2 ${
              activeTab === "track"
                ? "border-teal-400 text-teal-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>📍 Live Package Tracker</span>
          </button>

          <button
            onClick={() => setActiveTab("book")}
            className={`pb-3 transition-colors border-b-2 flex items-center space-x-2 ${
              activeTab === "book"
                ? "border-teal-400 text-teal-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>📝 Book New Delivery</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`pb-3 transition-colors border-b-2 flex items-center space-x-2 ${
              activeTab === "history"
                ? "border-teal-400 text-teal-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>📦 Order History ({deliveries.length})</span>
          </button>
        </div>

        {/* ─── TAB 1: LIVE PACKAGE TRACKER ─── */}
        {activeTab === "track" && (
          <div className="space-y-6">
            {deliveries.length === 0 ? (
              <div className="bg-slate-900 p-12 rounded-2xl border border-slate-800 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-2xl">
                  📦
                </div>
                <h3 className="text-lg font-bold text-white">No Active Shipments Found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  You haven't placed any delivery orders yet. Click below to schedule your first package pickup!
                </p>
                <button
                  onClick={() => setActiveTab("book")}
                  className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all"
                >
                  Book Your First Delivery
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Panel: Package Selector & Security OTP */}
                <div className="lg:col-span-5 space-y-5">
                  {/* Select Package Dropdown */}
                  <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                      Select Package to Track
                    </label>
                    <select
                      value={selectedDelivery?.id || ""}
                      onChange={(e) => {
                        const found = deliveries.find((d) => d.id === e.target.value);
                        if (found) setSelectedDelivery(found);
                      }}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-teal-400"
                    >
                      {deliveries.map((del) => (
                        <option key={del.id} value={del.id}>
                          Order #{del.id.slice(0, 8)} — To: {del.recipientName} ({del.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedDelivery && (
                    <>
                      {/* Security Delivery OTP Card */}
                      <div className="bg-gradient-to-br from-indigo-950 to-slate-900 p-5 rounded-2xl border border-indigo-800/60 shadow-xl space-y-3 relative overflow-hidden">
                        <div className="absolute -right-4 -bottom-4 w-28 h-28 bg-indigo-500/10 rounded-full blur-xl"></div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                            🔒 Delivery Verification OTP
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-900 text-indigo-200 border border-indigo-700">
                            Secret Code
                          </span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-indigo-900/50">
                          <div>
                            <span className="text-[11px] text-slate-400 block">
                              Give code to driver upon arrival:
                            </span>
                            <span className="text-3xl font-mono font-black tracking-widest text-emerald-400">
                              {selectedDelivery.deliveryOtp}
                            </span>
                          </div>
                          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 text-2xl border border-emerald-500/20">
                            🔑
                          </div>
                        </div>
                      </div>

                      {/* Package Details Summary Card */}
                      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Shipment Overview
                          </span>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(
                              selectedDelivery.status
                            )}`}
                          >
                            {selectedDelivery.status}
                          </span>
                        </div>

                        {/* Progress Stepper */}
                        {renderStatusStepper(selectedDelivery.status)}

                        {/* Pickup & Dropoff details */}
                        <div className="space-y-3 pt-2 text-xs border-t border-slate-800">
                          <div className="flex items-start space-x-3">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1 flex-shrink-0"></span>
                            <div>
                              <span className="text-slate-400 block">Pickup Location</span>
                              <span className="font-medium text-slate-200">
                                {selectedDelivery.pickupAddress}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-start space-x-3">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 flex-shrink-0"></span>
                            <div>
                              <span className="text-slate-400 block">Dropoff Location</span>
                              <span className="font-medium text-slate-200">
                                {selectedDelivery.dropoffAddress}
                              </span>
                            </div>
                          </div>

                          <div className="pt-2 flex justify-between text-slate-400 text-[11px] border-t border-slate-800">
                            <span>Recipient: {selectedDelivery.recipientName}</span>
                            <span>Phone: {selectedDelivery.recipientPhone}</span>
                          </div>

                          {/* OSRM Road Distance & ETA */}
                          {(osrmDistanceKm !== null || osrmRouteLoading) && (
                            <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-3 space-y-1 mt-2">
                              <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                <Icon icon="solar:routing-bold-duotone" className="text-sm" />
                                Road Route Info
                              </span>
                              {osrmRouteLoading ? (
                                <p className="text-slate-400 text-xs flex items-center gap-1.5">
                                  <Icon icon="lucide:loader-2" className="animate-spin text-sm" />
                                  Calculating road route...
                                </p>
                              ) : (
                                <div className="flex gap-4 text-xs">
                                  <div>
                                    <span className="text-[9px] text-slate-400 uppercase block">Road Distance</span>
                                    <span className="font-mono font-bold text-slate-200">{osrmDistanceKm} km</span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-slate-400 uppercase block">Drive Time</span>
                                    <span className="font-mono font-bold text-teal-300">{osrmDurationMins} mins</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Right Panel: Interactive Live Tracking Map */}
                <div className="lg:col-span-7">
                  <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl h-[550px] relative">
                    {selectedDelivery ? (
                      <MapContainer
                        center={[
                          selectedDelivery.pickupLatitude,
                          selectedDelivery.pickupLongitude,
                        ]}
                        zoom={12}
                        style={{ height: "100%", width: "100%" }}
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        {/* Pickup Marker */}
                        <Marker
                          position={[
                            selectedDelivery.pickupLatitude,
                            selectedDelivery.pickupLongitude,
                          ]}
                          icon={pickupIcon}
                        >
                          <Popup>
                            <div className="text-xs font-sans">
                              <strong>Pickup Location</strong>
                              <br />
                              {selectedDelivery.pickupAddress}
                            </div>
                          </Popup>
                        </Marker>

                        {/* Dropoff Marker */}
                        <Marker
                          position={[
                            selectedDelivery.dropoffLatitude,
                            selectedDelivery.dropoffLongitude,
                          ]}
                          icon={dropoffIcon}
                        >
                          <Popup>
                            <div className="text-xs font-sans">
                              <strong>Dropoff Location</strong>
                              <br />
                              {selectedDelivery.dropoffAddress}
                            </div>
                          </Popup>
                        </Marker>

                        {/* Live Driver Position Marker */}
                        {liveDriverPos && (
                          <Marker
                            position={[liveDriverPos.latitude, liveDriverPos.longitude]}
                            icon={driverIcon}
                          >
                            <Popup>
                              <div className="text-xs font-sans">
                                <strong>Live Driver Position</strong>
                                <br />
                                Order #{selectedDelivery.id.slice(0, 8)}
                              </div>
                            </Popup>
                          </Marker>
                        )}

                        {/* OSRM Real-Road Route Polyline */}
                        {osrmRouteCoords.length > 1 ? (
                          <Polyline
                            positions={osrmRouteCoords}
                            color="#0D9488"
                            weight={4}
                            opacity={0.85}
                          />
                        ) : (
                          // Fallback straight-line while OSRM loads
                          <Polyline
                            positions={[
                              [
                                selectedDelivery.pickupLatitude,
                                selectedDelivery.pickupLongitude,
                              ],
                              liveDriverPos
                                ? [liveDriverPos.latitude, liveDriverPos.longitude]
                                : [
                                    selectedDelivery.dropoffLatitude,
                                    selectedDelivery.dropoffLongitude,
                                  ],
                              [
                                selectedDelivery.dropoffLatitude,
                                selectedDelivery.dropoffLongitude,
                              ],
                            ]}
                            color="#0D9488"
                            weight={3}
                            dashArray="8, 8"
                            opacity={0.5}
                          />
                        )}
                      </MapContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500">
                        Select a shipment to load tracking map
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: BOOK NEW DELIVERY ─── */}
        {activeTab === "book" && (
          <div className="max-w-3xl mx-auto bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <span>📝 Schedule Express Delivery</span>
              </h2>
              <p className="text-xs text-slate-400">
                Enter shipment addresses and recipient details to book instant courier dispatch.
              </p>
            </div>

            <form onSubmit={handleBookingSubmit} className="space-y-6">
              {/* Recipient Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Recipient Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Babatunde Ogunlesi"
                    value={bookingForm.recipientName}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, recipientName: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-teal-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Recipient Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +2348012345678"
                    value={bookingForm.recipientPhone}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, recipientPhone: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-teal-400"
                  />
                </div>
              </div>

              {/* Recipient Email for OTP delivery */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Recipient Email Address (for Delivery OTP Email)
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. recipient@gmail.com"
                  value={bookingForm.recipientEmail}
                  onChange={(e) =>
                    setBookingForm({ ...bookingForm, recipientEmail: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-teal-400"
                />
              </div>

              {/* Sender Phone */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Your Sender Phone Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +2348098765432"
                  value={bookingForm.senderPhone}
                  onChange={(e) =>
                    setBookingForm({ ...bookingForm, senderPhone: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-teal-400"
                />
              </div>

              {/* Pickup Location Preset Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Pickup Location (Lagos Center Preset)
                </label>
                <select
                  value={bookingForm.pickupPreset}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value);
                    const loc = LAGOS_LOCATIONS[idx];
                    setBookingForm({
                      ...bookingForm,
                      pickupPreset: e.target.value,
                      pickupAddress: loc.name,
                      pickupLat: loc.lat.toString(),
                      pickupLng: loc.lng.toString(),
                    });
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-teal-400"
                >
                  {LAGOS_LOCATIONS.map((loc, idx) => (
                    <option key={idx} value={idx}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropoff Location Preset Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Dropoff Location (Lagos Center Preset)
                </label>
                <select
                  value={bookingForm.dropoffPreset}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value);
                    const loc = LAGOS_LOCATIONS[idx];
                    setBookingForm({
                      ...bookingForm,
                      dropoffPreset: e.target.value,
                      dropoffAddress: loc.name,
                      dropoffLat: loc.lat.toString(),
                      dropoffLng: loc.lng.toString(),
                    });
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-teal-400"
                >
                  {LAGOS_LOCATIONS.map((loc, idx) => (
                    <option key={idx} value={idx}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Estimated Delivery Fare Box */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">Estimated Distance</span>
                  <span className="text-sm font-bold text-slate-200">
                    ~{estimatedDistanceKm} km
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Estimated Delivery Fee</span>
                  <span className="text-xl font-extrabold text-teal-400 font-mono">
                    ₦{estimatedFare.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={bookingSubmitting}
                className="w-full py-3.5 rounded-xl bg-[#29a195] hover:bg-[#22877d] text-slate-950 font-bold text-sm transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
              >
                {bookingSubmitting ? (
                  <>
                    <Icon icon="lucide:loader-2" className="animate-spin text-lg" />
                    <span>Processing Shipment...</span>
                  </>
                ) : (
                  <>
                    <span>Dispatch Delivery Order Now</span>
                    <Icon icon="lucide:arrow-right" className="text-base" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ─── TAB 3: ORDER HISTORY ─── */}
        {activeTab === "history" && (
          <div className="space-y-6">
            {/* Search filter */}
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <input
                type="text"
                placeholder="Search history by recipient name, order ID, or address..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-teal-400"
              />
            </div>

            {/* History Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              {loading ? (
                <div className="p-8 text-center text-slate-400">Loading order history...</div>
              ) : deliveries.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No order history available</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-6 py-4">Order ID</th>
                        <th className="px-6 py-4">Recipient</th>
                        <th className="px-6 py-4">Pickup / Dropoff</th>
                        <th className="px-6 py-4 text-center">Verification OTP</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {deliveries
                        .filter(
                          (d) =>
                            d.id.toLowerCase().includes(historySearch.toLowerCase()) ||
                            d.recipientName
                              .toLowerCase()
                              .includes(historySearch.toLowerCase()) ||
                            d.pickupAddress
                              .toLowerCase()
                              .includes(historySearch.toLowerCase())
                        )
                        .map((del) => (
                          <tr key={del.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-6 py-4 font-mono text-teal-300">
                              #{del.id.slice(0, 8)}
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-white">
                                {del.recipientName}
                              </div>
                              <div className="text-xs text-slate-400">{del.recipientPhone}</div>
                            </td>
                            <td className="px-6 py-4 text-xs space-y-1">
                              <div className="text-slate-300 truncate max-w-xs">
                                📍 {del.pickupAddress}
                              </div>
                              <div className="text-slate-400 truncate max-w-xs">
                                🏁 {del.dropoffAddress}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center font-mono font-bold text-emerald-400">
                              {del.deliveryOtp}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(
                                  del.status
                                )}`}
                              >
                                {del.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right text-xs text-slate-400">
                              {new Date(del.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
