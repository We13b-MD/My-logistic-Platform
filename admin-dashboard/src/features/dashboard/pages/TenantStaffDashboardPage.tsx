import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { deliveryApi } from "@/api/delivery.api";
import { driverApi } from "@/api/driver.api";
import { toast } from "sonner";
import { Delivery, DriverProfile, DeliveryStatus } from "@/types";

// Leaflet map imports
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
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

const driverIcon = new L.Icon({

  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const LAGOS_PRESETS = [
  { name: "Surulere Mall, Surulere", lat: 6.502, lng: 3.358 },
  { name: "Herbert Macaulay Way, Yaba", lat: 6.5182, lng: 3.3769 },
  { name: "Computer Village, Ikeja", lat: 6.5983, lng: 3.3421 },
  { name: "Maryland Mall, Ikorodu Road", lat: 6.5684, lng: 3.3704 },
  { name: "Victoria Island Admiralty, VI", lat: 6.4281, lng: 3.4219 },
];

export function TenantStaffDashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<"dispatch" | "drivers">("dispatch");
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Status filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Desk Dispatch Form
  const [showDeskDispatch, setShowDeskDispatch] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({
    recipientName: "",
    recipientPhone: "",
    senderPhone: "+2348011112222",
    pickupAddress: LAGOS_PRESETS[0].name,
    pickupLat: LAGOS_PRESETS[0].lat.toString(),
    pickupLng: LAGOS_PRESETS[0].lng.toString(),
    dropoffAddress: LAGOS_PRESETS[1].name,
    dropoffLat: LAGOS_PRESETS[1].lat.toString(),
    dropoffLng: LAGOS_PRESETS[1].lng.toString(),
  });
  const [submittingDispatch, setSubmittingDispatch] = useState(false);

  // Updating driver assignment or status override
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [delivRes, driverRes] = await Promise.all([
        deliveryApi.list(),
        driverApi.listForAdmin(),
      ]);

      if (delivRes.data?.status === "success") {
        setDeliveries(delivRes.data.data || []);
      }
      if (driverRes.data?.status === "success") {
        setDrivers(driverRes.data.data || []);
      }
    } catch (error) {
      console.error("Failed to load dispatcher data:", error);
      toast.error("Failed to load operational fleet data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Manual Status Transition Override
  const handleStatusOverride = async (deliveryId: string, nextStatus: DeliveryStatus) => {
    try {
      setUpdatingId(deliveryId);
      const res = await deliveryApi.updateStatus(deliveryId, { status: nextStatus });
      if (res.data?.status === "success") {
        toast.success(`Shipment #${deliveryId.slice(0, 8)} status updated to ${nextStatus}!`);
        fetchData();
      }
    } catch (error: any) {
      console.error("Status override failed:", error);
      toast.error(error.response?.data?.message || "Failed to update shipment status.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle Quick Phone Dispatch Submit
  const handleDeskDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingDispatch(true);

    try {
      const payload = {
        recipientName: dispatchForm.recipientName,
        recipientPhone: dispatchForm.recipientPhone,
        senderPhone: dispatchForm.senderPhone,
        pickupAddress: dispatchForm.pickupAddress,
        pickupLatitude: parseFloat(dispatchForm.pickupLat),
        pickupLongitude: parseFloat(dispatchForm.pickupLng),
        dropoffAddress: dispatchForm.dropoffAddress,
        dropoffLatitude: parseFloat(dispatchForm.dropoffLat),
        dropoffLongitude: parseFloat(dispatchForm.dropoffLng),
      };

      const res = await deliveryApi.create(payload);
      if (res.data?.status === "success") {
        toast.success("Order dispatched to queue successfully!");
        setDispatchForm({
          recipientName: "",
          recipientPhone: "",
          senderPhone: "+2348011112222",
          pickupAddress: LAGOS_PRESETS[0].name,
          pickupLat: LAGOS_PRESETS[0].lat.toString(),
          pickupLng: LAGOS_PRESETS[0].lng.toString(),
          dropoffAddress: LAGOS_PRESETS[1].name,
          dropoffLat: LAGOS_PRESETS[1].lat.toString(),
          dropoffLng: LAGOS_PRESETS[1].lng.toString(),
        });
        setShowDeskDispatch(false);
        fetchData();
      }
    } catch (error: any) {
      console.error("Desk dispatch error:", error);
      toast.error("Failed to create desk dispatch order.");
    } finally {
      setSubmittingDispatch(false);
    }
  };

  const filteredDeliveries = deliveries.filter((del) => {
    const matchesSearch =
      del.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      del.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      del.pickupAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      del.dropoffAddress.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || del.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* ─── Top Header Navbar ─── */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black text-xl">
            🎧
          </div>
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-amber-300">
              Dispatcher Mission Control
            </h1>
            <p className="text-xs text-slate-400">Operational Fleet & Order Dispatch Desk</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowDeskDispatch(!showDeskDispatch)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center space-x-1.5"
          >
            <span>{showDeskDispatch ? "Close Entry Form" : "+ Desk Phone Dispatch"}</span>
          </button>

          {/* User info badge */}
          <div className="flex items-center space-x-3 bg-slate-800/80 px-3.5 py-1.5 rounded-lg border border-slate-700">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 font-semibold flex items-center justify-center text-sm border border-amber-500/30">
              {user?.email?.[0]?.toUpperCase() || "D"}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold text-slate-200 truncate max-w-[140px]">
                {user?.email}
              </div>
              <div className="text-[10px] text-amber-400 font-mono tracking-wider">
                TENANT_SUB_ADMIN
              </div>
            </div>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
            title="Refresh Orders"
          >
            <svg
              className={`w-5 h-5 ${loading ? "animate-spin text-amber-400" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

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
        {/* Desk Phone Dispatch Drawer/Form */}
        {showDeskDispatch && (
          <div className="bg-slate-900 p-6 rounded-2xl border border-amber-500/40 shadow-2xl space-y-4 animate-fadeIn">
            <h3 className="text-base font-bold text-amber-300 flex items-center space-x-2">
              <span>📞 Phone-In Desk Order Entry</span>
            </h3>
            <form onSubmit={handleDeskDispatchSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Recipient Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Victor Okafor"
                  value={dispatchForm.recipientName}
                  onChange={(e) =>
                    setDispatchForm({ ...dispatchForm, recipientName: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Recipient Phone</label>
                <input
                  type="tel"
                  required
                  placeholder="+2348011223344"
                  value={dispatchForm.recipientPhone}
                  onChange={(e) =>
                    setDispatchForm({ ...dispatchForm, recipientPhone: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Pickup Preset</label>
                <select
                  value={dispatchForm.pickupAddress}
                  onChange={(e) => {
                    const loc = LAGOS_PRESETS.find((p) => p.name === e.target.value);
                    if (loc) {
                      setDispatchForm({
                        ...dispatchForm,
                        pickupAddress: loc.name,
                        pickupLat: loc.lat.toString(),
                        pickupLng: loc.lng.toString(),
                      });
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                >
                  {LAGOS_PRESETS.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={submittingDispatch}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition-all"
                >
                  {submittingDispatch ? "Dispatching..." : "Submit Dispatch Order"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab("dispatch")}
            className={`pb-3 transition-colors border-b-2 flex items-center space-x-2 ${
              activeTab === "dispatch"
                ? "border-amber-400 text-amber-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>📦 Dispatch & Order Queue ({filteredDeliveries.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("drivers")}
            className={`pb-3 transition-colors border-b-2 flex items-center space-x-2 ${
              activeTab === "drivers"
                ? "border-amber-400 text-amber-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>🏍️ Active Fleet Radar ({drivers.length})</span>
          </button>
        </div>

        {/* ─── TAB 1: DISPATCH BOARD ─── */}
        {activeTab === "dispatch" && (
          <div className="space-y-6">
            {/* Search & Status Filter */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
              <div className="md:col-span-8">
                <input
                  type="text"
                  placeholder="Search by order ID, recipient name, or address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="md:col-span-4">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-amber-400"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Assignment</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="PICKED_UP">Picked Up</option>
                  <option value="IN_TRANSIT">In Transit</option>
                  <option value="DELIVERED">Delivered</option>
                </select>
              </div>
            </div>

            {/* Dispatch Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              {loading ? (
                <div className="p-8 text-center text-slate-400">Loading order queue...</div>
              ) : filteredDeliveries.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No shipments found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-6 py-4">Shipment ID</th>
                        <th className="px-6 py-4">Recipient</th>
                        <th className="px-6 py-4">Pickup / Dropoff</th>
                        <th className="px-6 py-4 text-center">OTP Code</th>
                        <th className="px-6 py-4 text-center">Current Status</th>
                        <th className="px-6 py-4 text-right">Emergency Override</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredDeliveries.map((del) => (
                        <tr key={del.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4 font-mono text-amber-300 font-semibold">
                            #{del.id.slice(0, 8)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-white">{del.recipientName}</div>
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
                          <td className="px-6 py-4 text-right">
                            <select
                              value={del.status}
                              disabled={updatingId === del.id}
                              onChange={(e) =>
                                handleStatusOverride(del.id, e.target.value as DeliveryStatus)
                              }
                              className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                            >
                              <option value="PENDING">Set PENDING</option>
                              <option value="ASSIGNED">Set ASSIGNED</option>
                              <option value="PICKED_UP">Set PICKED_UP</option>
                              <option value="IN_TRANSIT">Set IN_TRANSIT</option>
                              <option value="DELIVERED">Set DELIVERED</option>
                              <option value="CANCELLED">Set CANCELLED</option>
                            </select>
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

        {/* ─── TAB 2: ACTIVE FLEET RADAR ─── */}
        {activeTab === "drivers" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Drivers List */}
            <div className="lg:col-span-5 bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-base font-bold text-white">Roster Drivers ({drivers.length})</h3>
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                {drivers.map((drv) => (
                  <div key={drv.id} className="p-4 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">{drv.user?.email}</div>
                      <div className="text-slate-400 mt-0.5">
                        Vehicle: <span className="text-amber-400 font-mono">{drv.vehicleType}</span>
                      </div>
                    </div>
                    <div>
                      {drv.isOnline ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-semibold">
                          ● Online
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          Offline
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Fleet Map */}
            <div className="lg:col-span-7 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl h-[500px]">
              <MapContainer
                center={[6.502, 3.358]}
                zoom={12}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {drivers
                  .filter((d) => d.lastLatitude && d.lastLongitude)
                  .map((d) => (
                    <Marker
                      key={d.id}
                      position={[d.lastLatitude!, d.lastLongitude!]}
                      icon={d.isOnline ? driverIcon : pickupIcon}
                    >
                      <Popup>
                        <div className="text-xs font-sans">
                          <strong>{d.user?.email}</strong>
                          <br />
                          Vehicle: {d.vehicleType}
                          <br />
                          Status: {d.isOnline ? "Online" : "Offline"}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
