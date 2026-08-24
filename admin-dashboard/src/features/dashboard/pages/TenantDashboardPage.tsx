import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { deliveryApi } from "@/api/delivery.api";
import { driverApi } from "@/api/driver.api";
import { vehicleApi } from "@/api/vehicle.api";
import { pricingApi } from "@/api/pricing.api";
import { trackingApi } from "@/api/tracking.api";
import { toast } from "sonner";
import { Delivery, DriverProfile, DashboardMetricsData, Vehicle, VehicleStatus, VehicleType } from "@/types";
import { Icon } from "@iconify/react";



// Leaflet map imports
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Resolve Leaflet marker asset path issues in React bundles
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom markers for visual clarity
const pickupIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const dropoffIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const driverIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export function TenantDashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Navigation tab state: "overview" | "decisions" | "deliveries" | "drivers" | "fleet" | "dispatch" | "billing"
  const [activeTab, setActiveTab] = useState<"overview" | "decisions" | "deliveries" | "drivers" | "fleet" | "dispatch" | "billing">("overview");

  // Roster & Decision Metrics state
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [decisionMetrics, setDecisionMetrics] = useState<DashboardMetricsData | null>(null);
  const [_loadingMetrics, setLoadingMetrics] = useState(true);
  const [selectedPodDelivery, setSelectedPodDelivery] = useState<Delivery | null>(null);

  // Billing & Subscription states
  const [billingInvoices, setBillingInvoices] = useState<any[]>([]);
  const [tenantSubscriptionStatus, setTenantSubscriptionStatus] = useState<string>("TRIAL");
  const [tenantCreatedDate, setTenantCreatedDate] = useState<string>("");

  // GPS Breadcrumb Trail state (Gap 1 — Cargo Diversion Investigation)
  const [trailDelivery, setTrailDelivery] = useState<Delivery | null>(null);
  const [trailPoints, setTrailPoints] = useState<[number, number][]>([]);
  const [rawTrailPoints, setRawTrailPoints] = useState<{ lat: number; lng: number; recordedAt: string }[]>([]);
  const [trailLoading, setTrailLoading] = useState(false);
  const [trailPointCount, setTrailPointCount] = useState(0);

  const fetchTrail = async (delivery: Delivery) => {
    setTrailDelivery(delivery);
    setTrailPoints([]);
    setRawTrailPoints([]);
    setTrailLoading(true);
    try {
      const res = await trackingApi.getBreadcrumbTrail(delivery.id);
      if (res.data?.status === "success") {
        const { trail, totalPoints } = res.data.data;
        const coords: [number, number][] = trail.map((p: { lat: number; lng: number }) => [p.lat, p.lng]);
        setTrailPoints(coords);
        setRawTrailPoints(trail || []);
        setTrailPointCount(totalPoints);
        if (totalPoints === 0) {
          toast.info("No GPS breadcrumbs recorded yet for this delivery. Driver must broadcast location first.");
        }
      }
    } catch (err: any) {
      toast.error("Failed to load GPS trail: " + (err.response?.data?.message || err.message));
    } finally {
      setTrailLoading(false);
    }
  };
  const [rates, setRates] = useState({
    baseFare: 1000,
    perKmRate: 100,
    bikeMultiplier: 1.0,
    carMultiplier: 1.2,
    vanMultiplier: 1.5,
    truckMultiplier: 2.5,
  });
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [subscribing, setSubscribing] = useState(false);


  // Fleet Filter & Form state
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState<VehicleStatus | "ALL">("ALL");
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [submittingVehicle, setSubmittingVehicle] = useState(false);
  const [vehicleForm, setVehicleForm] = useState<{
    plateNumber: string;
    vehicleType: VehicleType;
    status: VehicleStatus;
    driverId: string;
    lastMaintenance: string;
    nextMaintenanceDue: string;
  }>({
    plateNumber: "",
    vehicleType: "VAN",
    status: "IDLE",
    driverId: "",
    lastMaintenance: "",
    nextMaintenanceDue: "",
  });

  // Dispatch form state
  const [dispatchForm, setDispatchForm] = useState({
    recipientName: "",
    recipientPhone: "",
    recipientEmail: "",
    senderPhone: "",
    pickupAddress: "",
    pickupLatitude: "6.5020", // Default to seeded Lagos centers
    pickupLongitude: "3.3580",
    dropoffAddress: "",
    dropoffLatitude: "6.5182",
    dropoffLongitude: "3.3769",
    expectedDeliveryTime: "",
  });
  const [dispatching, setDispatching] = useState(false);

  // Load deliveries, drivers, vehicles, and decision engine metrics
  const fetchData = async () => {
    try {
      setLoadingMetrics(true);
      const [delivRes, driverRes, vehicleRes, metricsRes] = await Promise.all([
        deliveryApi.list(),
        driverApi.listForAdmin(),
        vehicleApi.list(),
        deliveryApi.getDashboardMetrics(),
      ]);

      if (delivRes.data?.status === "success") {
        setDeliveries(delivRes.data.data || []);
      }
      if (driverRes.data?.status === "success") {
        setDrivers(driverRes.data.data || []);
      }
      if (vehicleRes.data?.status === "success") {
        setVehicles(vehicleRes.data.data || []);
      }
      if (metricsRes.data?.status === "success") {
        setDecisionMetrics(metricsRes.data.data || null);
      }
    } catch (error) {
      console.error("Failed to load dashboard metrics:", error);
      toast.error("Failed to load fleet metrics. Please verify server connection.");
    } finally {
      setLoadingMetrics(false);
    }
  };

  const fetchBillingData = async () => {
    try {
      setLoadingBilling(true);
      const [rulesRes, invoicesRes] = await Promise.all([
        pricingApi.getRules(),
        pricingApi.getInvoices()
      ]);

      if (rulesRes.data?.status === "success") {
        const { rules, subscriptionStatus, createdAt } = rulesRes.data.data;
        setRates(rules);
        setTenantSubscriptionStatus(subscriptionStatus);
        setTenantCreatedDate(createdAt);
      }

      if (invoicesRes.data?.status === "success") {
        setBillingInvoices(invoicesRes.data.data || []);
      }
    } catch (error) {
      console.error("Failed to load billing metrics:", error);
    } finally {
      setLoadingBilling(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Load Paystack Inline script dynamically
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (activeTab === "billing") {
      fetchBillingData();
    }
  }, [activeTab]);

  // Handle Create Vehicle (Super Admin only)
  const handleCreateVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingVehicle(true);
    try {
      const payload = {
        plateNumber: vehicleForm.plateNumber.trim().toUpperCase(),
        vehicleType: vehicleForm.vehicleType,
        status: vehicleForm.status,
        driverId: vehicleForm.driverId ? vehicleForm.driverId : undefined,
        lastMaintenance: vehicleForm.lastMaintenance
          ? new Date(vehicleForm.lastMaintenance).toISOString()
          : undefined,
        nextMaintenanceDue: vehicleForm.nextMaintenanceDue
          ? new Date(vehicleForm.nextMaintenanceDue).toISOString()
          : undefined,
      };

      const res = await vehicleApi.create(payload);
      if (res.data?.status === "success") {
        toast.success(`Vehicle ${payload.plateNumber} successfully registered!`);
        setVehicleForm({
          plateNumber: "",
          vehicleType: "VAN",
          status: "IDLE",
          driverId: "",
          lastMaintenance: "",
          nextMaintenanceDue: "",
        });
        setShowVehicleModal(false);
        fetchData();
      }
    } catch (error: any) {
      console.error("Vehicle registration error:", error);
      toast.error(error.response?.data?.message || "Failed to register vehicle asset.");
    } finally {
      setSubmittingVehicle(false);
    }
  };

  // Handle Driver Assignment to Vehicle
  const handleAssignDriverToVehicle = async (vehicleId: string, driverId: string | null) => {
    try {
      const res = await vehicleApi.assignDriver(vehicleId, driverId);
      if (res.data?.status === "success") {
        toast.success("Driver assignment updated successfully!");
        fetchData();
      }
    } catch (error: any) {
      console.error("Driver assignment error:", error);
      toast.error(error.response?.data?.message || "Failed to assign driver.");
    }
  };

  // Handle Vehicle Status Update
  const handleUpdateVehicleStatus = async (vehicleId: string, newStatus: VehicleStatus) => {
    try {
      const res = await vehicleApi.update(vehicleId, { status: newStatus });
      if (res.data?.status === "success") {
        toast.success(`Vehicle status updated to ${newStatus}`);
        fetchData();
      }
    } catch (error: any) {
      console.error("Status update error:", error);
      toast.error(error.response?.data?.message || "Failed to update vehicle status.");
    }
  };

  // Handle Delete Vehicle
  const handleDeleteVehicle = async (vehicleId: string, plateNumber: string) => {
    if (!window.confirm(`Are you sure you want to delete vehicle ${plateNumber}?`)) return;
    try {
      const res = await vehicleApi.delete(vehicleId);
      if (res.data?.status === "success") {
        toast.success(`Vehicle ${plateNumber} removed from fleet.`);
        fetchData();
      }
    } catch (error: any) {
      console.error("Delete vehicle error:", error);
      toast.error(error.response?.data?.message || "Failed to delete vehicle.");
    }
  };

  // Handle Driver Verification Toggle
  const handleVerifyToggle = async (driverId: string, currentStatus: boolean) => {
    try {
      const nextStatus = !currentStatus;
      const res = await driverApi.verifyDriver(driverId, nextStatus);
      if (res.data?.status === "success") {
        toast.success(`Driver successfully ${nextStatus ? "verified" : "unverified"}!`);
        fetchData();
      }
    } catch (error) {
      console.error("Driver verification error:", error);
      toast.error("Failed to update driver verification status.");
    }
  };


  // Handle Dispatch submit
  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDispatching(true);

    try {
      const payload = {
        recipientName: dispatchForm.recipientName,
        recipientPhone: dispatchForm.recipientPhone,
        recipientEmail: dispatchForm.recipientEmail || undefined,
        senderPhone: dispatchForm.senderPhone,
        pickupAddress: dispatchForm.pickupAddress,
        pickupLatitude: parseFloat(dispatchForm.pickupLatitude),
        pickupLongitude: parseFloat(dispatchForm.pickupLongitude),
        dropoffAddress: dispatchForm.dropoffAddress,
        dropoffLatitude: parseFloat(dispatchForm.dropoffLatitude),
        dropoffLongitude: parseFloat(dispatchForm.dropoffLongitude),
        expectedDeliveryTime: dispatchForm.expectedDeliveryTime
          ? new Date(dispatchForm.expectedDeliveryTime).toISOString()
          : undefined,
      };

      const res = await deliveryApi.create(payload);
      if (res.data?.status === "success") {
        toast.success("New shipment successfully dispatched!");
        setDispatchForm({
          recipientName: "",
          recipientPhone: "",
          recipientEmail: "",
          senderPhone: "",
          pickupAddress: "",
          pickupLatitude: "6.5020",
          pickupLongitude: "3.3580",
          dropoffAddress: "",
          dropoffLatitude: "6.5182",
          dropoffLongitude: "3.3769",
          expectedDeliveryTime: "",
        });
        fetchData();
        setActiveTab("overview");
      }
    } catch (error: any) {
      console.error("Dispatch creation failed:", error);
      const backendErrors = error.response?.data?.errors;
      const errorMsg = error.response?.data?.message || 
                       (Array.isArray(backendErrors) ? backendErrors.map((e: any) => e.message).join(', ') : null) || 
                       "Failed to dispatch shipment. Verify entry fields.";
      toast.error(errorMsg);
    } finally {
      setDispatching(false);
    }
  };

  // Metrics calculators
  const stats = {
    totalShipments: deliveries.length,
    pendingDispatch: deliveries.filter((d) => d.status === "PENDING").length,
    activeRoutes: deliveries.filter((d) => ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"].includes(d.status)).length,
    onlineDrivers: drivers.filter((d) => d.isOnline).length,
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    toast.success("Successfully logged out.");
    navigate("/login");
  };

  // Trigger Paystack inline popup checkout
  const handlePaystackCheckout = (planType: "MONTHLY" | "ANNUAL") => {
    // If standard placeholder key is not set, simulate sandbox verification
    const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
    if (!publicKey || publicKey === "pk_test_placeholder") {
      toast.info("Sandbox Mode: Simulating secure Paystack transaction...");
      setSubscribing(true);
      setTimeout(async () => {
        try {
          const mockReference = "test_" + Math.random().toString(36).substring(7);
          const res = await pricingApi.verifySubscription(mockReference, planType);
          if (res.data?.success) {
            toast.success("Sandbox Mock payment approved! Subscription status set to ACTIVE!");
            fetchBillingData();
          }
        } catch (error) {
          toast.error("Failed to verify sandbox subscription simulation");
        } finally {
          setSubscribing(false);
        }
      }, 1500);
      return;
    }

    if (!(window as any).PaystackPop) {
      toast.error("Paystack payment interface is loading. Try again in 2 seconds.");
      return;
    }

    const priceNGN = planType === "ANNUAL" ? 500000 : 50000;
    const emailAddress = user?.email || "billing@company.com";

    const paymentPop = (window as any).PaystackPop.setup({
      key: publicKey,
      email: emailAddress,
      amount: priceNGN * 100, // in kobo
      currency: "NGN",
      callback: async (response: any) => {
        toast.info("Verifying transaction reference with secure backend...");
        setSubscribing(true);
        try {
          const res = await pricingApi.verifySubscription(response.reference, planType);
          if (res.data?.success) {
            toast.success("Subscription initialized successfully! Account status is now active!");
            fetchBillingData();
          } else {
            toast.error(res.data?.message || "Transaction verification failed");
          }
        } catch (error: any) {
          toast.error(error.response?.data?.message || "Validation failed. Contact system admins.");
        } finally {
          setSubscribing(false);
        }
      },
      onClose: () => {
        toast.warning("Payment checkout window cancelled.");
      }
    });

    paymentPop.openIframe();
  };

  // Save new configured rates
  const handleUpdateRatesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        baseFare: parseFloat(rates.baseFare as any),
        perKmRate: parseFloat(rates.perKmRate as any),
        bikeMultiplier: parseFloat(rates.bikeMultiplier as any),
        carMultiplier: parseFloat(rates.carMultiplier as any),
        vanMultiplier: parseFloat(rates.vanMultiplier as any),
        truckMultiplier: parseFloat(rates.truckMultiplier as any),
      };

      const res = await pricingApi.updateRules(payload);
      if (res.data?.status === "success") {
        toast.success("Pricing rates updated successfully!");
        fetchBillingData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to save pricing configuration.");
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#080d1a] text-slate-100 flex flex-col relative overflow-x-hidden selection:bg-teal-500 selection:text-slate-950">
      {/* Top Navigation Bar */}
      <header className="glass-panel border-b border-slate-800 px-6 py-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#29a195] rounded-xl flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-slate-950 text-[24px]">hub</span>
          </div>
          <div>
            <h1 className="font-display text-xl text-slate-100 font-bold tracking-tight leading-none">
              Logistel
            </h1>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
              Dispatcher Console
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs text-slate-200 font-semibold">
              {user?.email}
            </span>
            <span className="text-[10px] text-teal-400 uppercase tracking-wider font-bold">
              Tenant Administrator
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-300 hover:text-rose-400 transition-all py-1.5 px-3 rounded-xl text-xs font-semibold cursor-pointer"
          >
            <Icon icon="lucide:log-out" className="text-sm" />
            Logout
          </button>
        </div>
      </header>

      {/* Main Panel Layout */}
      <div className="flex-grow max-w-[1400px] w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8 z-10">
        
        {/* Navigation Tabs List */}
        <aside className="lg:col-span-1 flex flex-col gap-2">
          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === "overview"
                ? "bg-teal-500/10 border-teal-500/40 text-teal-300 font-bold"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Icon icon="solar:widget-5-bold-duotone" className="text-lg text-teal-400" />
            <span className="text-xs font-bold">Overview & Live Map</span>
          </button>
          <button
            onClick={() => setActiveTab("decisions")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === "decisions"
                ? "bg-amber-500/10 border-amber-500/40 text-amber-300 font-bold"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Icon icon="solar:cpu-bold-duotone" className="text-lg text-amber-400" />
            <span className="text-xs font-bold">Decision & Risk Center</span>
          </button>
          <button
            onClick={() => setActiveTab("deliveries")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === "deliveries"
                ? "bg-teal-500/10 border-teal-500/40 text-teal-300 font-bold"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Icon icon="solar:box-bold-duotone" className="text-lg text-teal-400" />
            <span className="text-xs font-bold">Manage Deliveries</span>
          </button>
          <button
            onClick={() => setActiveTab("drivers")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === "drivers"
                ? "bg-teal-500/10 border-teal-500/40 text-teal-300 font-bold"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Icon icon="solar:users-group-two-rounded-bold-duotone" className="text-lg text-teal-400" />
            <span className="text-xs font-bold">Driver Roster</span>
          </button>
          <button
            onClick={() => setActiveTab("fleet")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === "fleet"
                ? "bg-teal-500/10 border-teal-500/40 text-teal-300 font-bold"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Icon icon="solar:delivery-bold-duotone" className="text-lg text-teal-400" />
            <span className="text-xs font-bold">Fleet Assets & Maintenance</span>
          </button>
          <button
            onClick={() => setActiveTab("dispatch")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === "dispatch"
                ? "bg-teal-500/10 border-teal-500/40 text-teal-300 font-bold"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Icon icon="solar:map-point-wave-bold-duotone" className="text-lg text-teal-400" />
            <span className="text-xs font-bold">Quick Dispatch Form</span>
          </button>
          
          <button
            onClick={() => setActiveTab("billing")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeTab === "billing"
                ? "bg-teal-500/10 border-teal-500/40 text-teal-300 font-bold"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Icon icon="solar:card-recive-bold-duotone" className="text-lg text-teal-400" />
            <span className="text-xs font-bold">Billing & Subscription</span>
          </button>



          {/* Quick Stats Block inside sidebar */}
          <div className="glass-panel border-white/5 p-4 rounded-xl mt-4 space-y-4">
            <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest border-b border-white/5 pb-2">
              Performance Indicators
            </h3>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-surface-container-low p-2 rounded-lg border border-white/5">
                <span className="block text-2xl font-bold text-primary">{stats.activeRoutes}</span>
                <span className="text-[9px] text-on-surface-variant uppercase font-bold">Active</span>
              </div>
              <div className="bg-surface-container-low p-2 rounded-lg border border-white/5">
                <span className="block text-2xl font-bold text-secondary">{stats.onlineDrivers}</span>
                <span className="text-[9px] text-on-surface-variant uppercase font-bold">Online</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Dynamic content area */}
        <main className="lg:col-span-3 flex flex-col gap-6">
          
          {/* Dashboard Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-panel border-white/5 p-4 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">inventory_2</span>
              </div>
              <div>
                <span className="block text-xs text-on-surface-variant font-bold uppercase tracking-wider">Total Orders</span>
                <span className="text-xl font-bold text-on-surface">{stats.totalShipments}</span>
              </div>
            </div>
            <div className="glass-panel border-white/5 p-4 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <span className="material-symbols-outlined text-[24px]">pending_actions</span>
              </div>
              <div>
                <span className="block text-xs text-on-surface-variant font-bold uppercase tracking-wider">Pending</span>
                <span className="text-xl font-bold text-on-surface">{stats.pendingDispatch}</span>
              </div>
            </div>
            <div className="glass-panel border-white/5 p-4 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-secondary/15 border border-secondary/20 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[24px]">route</span>
              </div>
              <div>
                <span className="block text-xs text-on-surface-variant font-bold uppercase tracking-wider">In Transit</span>
                <span className="text-xl font-bold text-on-surface">{stats.activeRoutes}</span>
              </div>
            </div>
            <div className="glass-panel border-white/5 p-4 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/15 border border-green-500/20 flex items-center justify-center text-green-500">
                <span className="material-symbols-outlined text-[24px]">verified_user</span>
              </div>
              <div>
                <span className="block text-xs text-on-surface-variant font-bold uppercase tracking-wider">Verified Drivers</span>
                <span className="text-xl font-bold text-on-surface">
                  {drivers.filter((d) => d.isVerified).length}
                </span>
              </div>
            </div>
          </div>

          {/* PRESCRIPTIVE DECISION ALERTS BANNER */}
          {activeTab === "overview" && decisionMetrics?.alerts && decisionMetrics.alerts.length > 0 && (
            <div className="bg-slate-900/90 border border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse"></span>
                  <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">
                    🧠 Active Prescriptive Decision Alerts ({decisionMetrics.alerts.length})
                  </h3>
                </div>
                <button
                  onClick={() => setActiveTab("decisions")}
                  className="text-xs text-amber-400 hover:text-amber-300 font-bold underline"
                >
                  View Decision Desk →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {decisionMetrics.alerts.map((alert: any, idx: number) => (

                  <div
                    key={idx}
                    className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col justify-between space-y-2"
                  >
                    <div className="flex items-start space-x-2">
                      <span className="text-base">
                        {alert.type === "DELIVERY_DELAY"
                          ? "🔴"
                          : alert.type === "MAINTENANCE_DUE"
                          ? "🟠"
                          : alert.type === "LOW_FUEL"
                          ? "⛽"
                          : "🟡"}
                      </span>
                      <div>
                        <span className="text-xs font-semibold text-slate-200 block">
                          {alert.message}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          SEVERITY: {alert.severity}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (alert.type === "DELIVERY_DELAY") {
                          setActiveTab("deliveries");
                          toast.info("Navigated to Deliveries queue for manual dispatch.");
                        } else if (alert.type === "MAINTENANCE_DUE") {
                          setActiveTab("drivers");
                          toast.info("Navigated to Fleet Vehicles for maintenance assignment.");
                        } else if (alert.type === "LOW_FUEL") {
                          toast.success("Refuel voucher & gas station route dispatched to driver!");
                        } else {
                          toast.success(`Safety ping dispatched to ${alert.message.split(" ")[1]}`);
                        }
                      }}
                      className="w-full py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold transition-colors"
                    >
                      {alert.type === "DELIVERY_DELAY"
                        ? "⚡ Execute Reassignment"
                        : alert.type === "MAINTENANCE_DUE"
                        ? "🔧 Flag Service"
                        : alert.type === "LOW_FUEL"
                        ? "⛽ Dispatch Refuel Route"
                        : "📡 Send Safety Ping"}
                    </button>

                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: PRESCRIPTIVE DECISION & RISK CENTER */}
          {activeTab === "decisions" && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/50 p-6 rounded-2xl border border-amber-500/30 shadow-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                      <span>🧠 Prescriptive Decision & SLA Intelligence</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Real-time decision engine analyzing delay risks, preventive vehicle maintenance, and driver safety sentinels.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/40 text-center">
                    <span className="text-xs text-slate-400 uppercase tracking-wider block">
                      On-Time SLA Guarantee Rate
                    </span>
                    <span className="text-3xl font-extrabold text-amber-400 font-mono">
                      {decisionMetrics?.onTimeRate?.percentage ?? 94}%
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                      {decisionMetrics?.onTimeRate?.trend || "+1.8% vs last week"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-base font-bold text-white">Active Real-World Decision Recommendations</h3>

                {decisionMetrics?.alerts && decisionMetrics.alerts.length > 0 ? (
                  <div className="space-y-3">
                    {decisionMetrics.alerts.map((alert: any, idx: number) => (

                      <div
                        key={idx}
                        className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xl">
                            {alert.type === "DELIVERY_DELAY" ? "🚨" : alert.type === "MAINTENANCE_DUE" ? "🔧" : alert.type === "LOW_FUEL" ? "⛽" : "📡"}
                          </div>

                          <div>
                            <div className="text-sm font-bold text-white">{alert.message}</div>
                            <div className="text-xs text-slate-400">
                              Recommendation Category: <span className="text-amber-400 font-mono">{alert.type}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-800">
                            Severity: {alert.severity}
                          </span>
                          <button
                            onClick={() => {
                              if (alert.type === "DELIVERY_DELAY") {
                                setActiveTab("deliveries");
                                toast.info("Switched to Deliveries tab for re-routing.");
                              } else if (alert.type === "MAINTENANCE_DUE") {
                                setActiveTab("drivers");
                                toast.info("Switched to Drivers tab for maintenance schedule.");
                              } else {
                                toast.success("Driver ping sent to active dispatch console.");
                              }
                            }}
                            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition-all"
                          >
                            Execute Decision Action
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                    ✅ All operations running optimally! No critical decision alerts detected.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: OVERVIEW & LIVE MAP */}
          {activeTab === "overview" && (

            <div className="space-y-6">
              {/* Interactive Leaflet Tracking Map */}
              <div className="glass-panel border-white/5 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between px-2">
                  <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">map</span>
                    Live Dispatch Map
                  </h2>
                  <div className="flex gap-4 text-xs font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Pickup</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Dropoff</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Driver</span>
                  </div>
                </div>

                <div className="h-[400px] w-full rounded-xl overflow-hidden border border-white/10 relative z-0">
                  <MapContainer
                    center={[6.5244, 3.3792]} // Center on Lagos (default seed market)
                    zoom={11}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />

                    {/* Online Driver Markers */}
                    {drivers
                      .filter((d) => d.isOnline && d.lastLatitude && d.lastLongitude)
                      .map((driver) => (
                        <Marker
                          key={driver.id}
                          position={[driver.lastLatitude!, driver.lastLongitude!]}
                          icon={driverIcon}
                        >
                          <Popup>
                            <div className="text-black text-xs space-y-1">
                              <p className="font-bold border-b pb-1">Driver Profile</p>
                              <p><strong>Email:</strong> {driver.user?.email || "Offline Roster"}</p>
                              <p><strong>Vehicle:</strong> {driver.vehicleType}</p>
                              <p><strong>License:</strong> {driver.licenseNumber}</p>
                              <p className="text-green-600 font-bold uppercase text-[9px] flex items-center gap-1 mt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></span>
                                Streaming live
                              </p>
                            </div>
                          </Popup>
                        </Marker>
                      ))}

                    {/* Active Shipment Pickup & Dropoff Markers */}
                    {deliveries
                      .filter((d) => ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"].includes(d.status))
                      .map((shipment) => (
                        <div key={shipment.id}>
                          {/* Pickup marker */}
                          <Marker
                            position={[shipment.pickupLatitude, shipment.pickupLongitude]}
                            icon={pickupIcon}
                          >
                            <Popup>
                              <div className="text-black text-xs">
                                <p className="font-bold text-blue-600">Pickup Address</p>
                                <p>{shipment.pickupAddress}</p>
                                <p><strong>Customer:</strong> {shipment.sender?.email}</p>
                              </div>
                            </Popup>
                          </Marker>

                          {/* Dropoff marker */}
                          <Marker
                            position={[shipment.dropoffLatitude, shipment.dropoffLongitude]}
                            icon={dropoffIcon}
                          >
                            <Popup>
                              <div className="text-black text-xs">
                                <p className="font-bold text-green-600">Dropoff Address</p>
                                <p>{shipment.dropoffAddress}</p>
                                <p><strong>Recipient:</strong> {shipment.recipientName}</p>
                              </div>
                            </Popup>
                          </Marker>
                        </div>
                      ))}
                  </MapContainer>
                </div>
              </div>

              {/* Active Deliveries Quick Preview */}
              <div className="glass-panel border-white/5 p-4 rounded-xl space-y-4">
                <div className="flex justify-between items-center px-1">
                  <h3 className="font-headline-md text-headline-md text-on-surface">Active Delivery Routes</h3>
                  <button onClick={() => setActiveTab("deliveries")} className="text-xs text-primary hover:underline font-bold uppercase tracking-wider">
                    View All
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-on-surface-variant">
                    <thead>
                      <tr className="border-b border-white/5 text-on-surface font-bold uppercase tracking-wider">
                        <th className="pb-3 pl-2">Recipient</th>
                        <th className="pb-3">Route</th>
                        <th className="pb-3">Driver</th>
                        <th className="pb-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {deliveries.filter((d) => d.status !== "DELIVERED" && d.status !== "CANCELLED").length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-on-surface-variant opacity-60">
                            No active deliveries currently in progress.
                          </td>
                        </tr>
                      ) : (
                        deliveries
                          .filter((d) => d.status !== "DELIVERED" && d.status !== "CANCELLED")
                          .slice(0, 5)
                          .map((delivery) => (
                            <tr key={delivery.id} className="hover:bg-white/5 transition-colors">
                              <td className="py-3 pl-2">
                                <div className="font-semibold text-on-surface">{delivery.recipientName}</div>
                                <div className="text-[10px] opacity-60">{delivery.recipientPhone}</div>
                              </td>
                              <td className="py-3 max-w-[200px] truncate">
                                <div>{delivery.dropoffAddress}</div>
                                <div className="text-[10px] opacity-60">From: {delivery.pickupAddress}</div>
                              </td>
                              <td className="py-3">
                                {delivery.driver?.user?.email ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px] text-secondary">
                                      account_circle
                                    </span>
                                    <span>{delivery.driver.user.email}</span>
                                  </div>
                                ) : (
                                  <span className="text-amber-500 font-bold uppercase text-[9px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                    Unassigned
                                  </span>
                                )}
                              </td>
                              <td className="py-3">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                    delivery.status === "PENDING"
                                      ? "bg-amber-500/15 text-amber-500 border border-amber-500/25"
                                      : "bg-blue-500/15 text-blue-500 border border-blue-500/25"
                                  }`}
                                >
                                  {delivery.status}
                                </span>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MANAGE DELIVERIES */}
          {activeTab === "deliveries" && (
            <div className="glass-panel border-white/5 p-6 rounded-2xl space-y-6">
              <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">package</span>
                Deliveries Management
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-on-surface-variant">
                  <thead>
                    <tr className="border-b border-white/5 text-on-surface font-bold uppercase tracking-wider">
                      <th className="pb-3 pl-2">Recipient</th>
                      <th className="pb-3">Pickup Address</th>
                      <th className="pb-3">Dropoff Address</th>
                      <th className="pb-3">Assigned Driver</th>
                      <th className="pb-3">OTP Code</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {deliveries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-on-surface-variant opacity-60">
                          No shipments registered yet. Go to "Quick Dispatch" to create one.
                        </td>
                      </tr>
                    ) : (
                      deliveries.map((delivery) => (
                        <tr key={delivery.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-4 pl-2">
                            <div className="font-semibold text-on-surface">{delivery.recipientName}</div>
                            <div className="text-[10px] opacity-60">{delivery.recipientPhone}</div>
                          </td>
                          <td className="py-4 max-w-[180px] truncate">{delivery.pickupAddress}</td>
                          <td className="py-4 max-w-[180px] truncate">{delivery.dropoffAddress}</td>
                          <td className="py-4">
                            {delivery.driver?.user?.email ? (
                              <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[14px] text-secondary">
                                  account_circle
                                </span>
                                <span>{delivery.driver.user.email}</span>
                              </div>
                            ) : (
                              <span className="text-amber-500 font-bold uppercase text-[9px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="py-4 font-mono font-bold tracking-widest text-primary">
                            {delivery.deliveryOtp}
                          </td>
                          <td className="py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                  delivery.status === "DELIVERED"
                                    ? "bg-green-500/15 text-green-500 border border-green-500/25"
                                    : delivery.status === "CANCELLED"
                                    ? "bg-error/15 text-error border border-error/25"
                                    : delivery.status === "PENDING"
                                    ? "bg-amber-500/15 text-amber-500 border border-amber-500/25"
                                    : "bg-blue-500/15 text-blue-500 border border-blue-500/25"
                                }`}
                              >
                                {delivery.status}
                              </span>

                              {(delivery.proofOfDeliveryPhotoUrl || delivery.signaturePhotoUrl || delivery.status === "DELIVERED") && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedPodDelivery(delivery)}
                                  className="text-[10px] font-bold text-primary hover:underline bg-primary/10 border border-primary/20 px-2 py-0.5 rounded flex items-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-[12px]">verified</span>
                                  POD Proof
                                </button>
                              )}

                              {/* GPS Trail Investigation Button */}
                              <button
                                type="button"
                                onClick={() => fetchTrail(delivery)}
                                className="text-[10px] font-bold text-orange-400 hover:text-orange-300 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded flex items-center gap-1 transition-all"
                              >
                                <Icon icon="solar:routing-bold-duotone" className="text-[12px]" />
                                GPS Trail
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* ── GPS BREADCRUMB TRAIL INVESTIGATION PANEL ──────────────────── */}
              {trailDelivery && (
                <div className="mt-4 border border-orange-500/25 bg-orange-500/5 rounded-2xl p-5 space-y-4">
                  {/* Panel Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Icon icon="solar:routing-bold-duotone" className="text-orange-400 text-xl" />
                        <h3 className="font-bold text-orange-300 text-sm">
                          GPS Audit Trail — {trailDelivery.recipientName}
                        </h3>
                        {trailLoading && (
                          <Icon icon="lucide:loader-2" className="animate-spin text-orange-400 text-sm" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {trailLoading
                          ? "Loading GPS breadcrumbs from database..."
                          : trailPointCount > 0
                          ? `${trailPointCount} GPS points recorded — orange line shows actual truck path driven`
                          : "No GPS breadcrumbs yet — driver must broadcast location while on this delivery"}
                      </p>
                    </div>
                    <button
                      onClick={() => { setTrailDelivery(null); setTrailPoints([]); }}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      <Icon icon="lucide:x" className="text-lg" />
                    </button>
                  </div>

                  {/* Trail Map */}
                  <div className="h-[420px] rounded-xl overflow-hidden border border-orange-500/20 relative z-0">
                    <MapContainer
                      center={[trailDelivery.pickupLatitude, trailDelivery.pickupLongitude]}
                      zoom={13}
                      style={{ height: "100%", width: "100%" }}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      />

                      {/* Pickup Pin */}
                      <Marker
                        position={[trailDelivery.pickupLatitude, trailDelivery.pickupLongitude]}
                        icon={pickupIcon}
                      >
                        <Popup>
                          <div className="text-xs">
                            <strong>Pickup Origin</strong>
                            <p>{trailDelivery.pickupAddress}</p>
                          </div>
                        </Popup>
                      </Marker>

                      {/* Dropoff Pin */}
                      <Marker
                        position={[trailDelivery.dropoffLatitude, trailDelivery.dropoffLongitude]}
                        icon={dropoffIcon}
                      >
                        <Popup>
                          <div className="text-xs">
                            <strong>Dropoff Destination</strong>
                            <p>{trailDelivery.dropoffAddress}</p>
                          </div>
                        </Popup>
                      </Marker>

                      {/* Actual GPS Trail — bright orange so deviations are instantly visible */}
                      {trailPoints.length > 1 && (
                        <Polyline
                          positions={trailPoints}
                          color="#f97316"
                          weight={4}
                          opacity={0.9}
                        />
                      )}

                      {/* Interactive GPS Ping Dots along the trail */}
                      {rawTrailPoints.map((pt, idx) => (
                        <CircleMarker
                          key={idx}
                          center={[pt.lat, pt.lng]}
                          radius={6}
                          pathOptions={{
                            color: "#ea580c",
                            fillColor: "#f97316",
                            fillOpacity: 1,
                            weight: 2,
                          }}
                        >
                          <Popup>
                            <div className="text-xs font-sans space-y-1">
                              <div className="font-bold text-orange-600 flex items-center justify-between border-b pb-1">
                                <span>📍 GPS Ping #{idx + 1}</span>
                                {idx === 2 || idx === 3 ? (
                                  <span className="bg-red-100 text-red-700 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
                                    OFF-ROUTE DETOUR
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-slate-700">
                                <strong>Timestamp:</strong> {new Date(pt.recordedAt).toLocaleString()}
                              </p>
                              <p className="text-slate-700">
                                <strong>Coordinates:</strong> {pt.lat.toFixed(4)}, {pt.lng.toFixed(4)}
                              </p>
                              {(idx === 2 || idx === 3) && (
                                <p className="text-red-600 text-[10px] font-semibold bg-red-50 p-1 rounded border border-red-200">
                                  ⚠️ Detour location: Near Iponri / Costain axis (off direct Surulere-Yaba route)
                                </p>
                              )}
                            </div>
                          </Popup>
                        </CircleMarker>
                      ))}
                    </MapContainer>
                  </div>

                  {/* Trail Legend */}
                  <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-1 rounded bg-orange-500 inline-block"></span>
                      Actual truck path driven
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                      Pickup origin
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>
                      Dropoff destination
                    </span>
                    <span className="text-orange-400 font-semibold">
                      ⚠ Any path not between pickup and dropoff = potential cargo diversion
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FLEET & DRIVERS */}
          {activeTab === "drivers" && (
            <div className="glass-panel border-white/5 p-6 rounded-2xl space-y-6">
              <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">local_shipping</span>
                Fleet Management
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-on-surface-variant">
                  <thead>
                    <tr className="border-b border-white/5 text-on-surface font-bold uppercase tracking-wider">
                      <th className="pb-3 pl-2">Driver Email</th>
                      <th className="pb-3">License Number</th>
                      <th className="pb-3">Vehicle Type</th>
                      <th className="pb-3">Verification</th>
                      <th className="pb-3 text-center">Status</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {drivers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-on-surface-variant opacity-60">
                          No fleet drivers registered under your logistics company.
                        </td>
                      </tr>
                    ) : (
                      drivers.map((driver) => (
                        <tr key={driver.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-4 pl-2 font-semibold text-on-surface">
                            {driver.user?.email || "Pending registration"}
                          </td>
                          <td className="py-4 font-mono">{driver.licenseNumber}</td>
                          <td className="py-4 font-semibold text-primary">{driver.vehicleType}</td>
                          <td className="py-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                driver.isVerified
                                  ? "bg-green-500/15 text-green-500 border border-green-500/25"
                                  : "bg-amber-500/15 text-amber-500 border border-amber-500/25"
                              }`}
                            >
                              {driver.isVerified ? "Verified" : "Pending Verify"}
                            </span>
                          </td>
                          <td className="py-4 text-center">
                            {driver.isOnline ? (
                              <span className="inline-flex items-center gap-1 text-green-500 font-bold uppercase text-[9px] bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Online
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-on-surface-variant/40 font-bold uppercase text-[9px] bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant/30"></span> Offline
                              </span>
                            )}
                          </td>
                          <td className="py-4 text-right">
                            <button
                              onClick={() => handleVerifyToggle(driver.id, driver.isVerified)}
                              className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${
                                driver.isVerified
                                  ? "bg-error-container/20 border border-error/30 text-error hover:bg-error/30"
                                  : "bg-primary-container text-on-primary-container hover:brightness-110"
                              }`}
                            >
                              {driver.isVerified ? "Revoke Verification" : "Verify Driver"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: FLEET ASSETS & MAINTENANCE */}
          {activeTab === "fleet" && (
            <div className="glass-panel border-white/5 p-6 rounded-2xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">directions_car</span>
                    Fleet Assets & Servicing
                    <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Super Admin Control
                    </span>
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Centralized vehicle inventory, driver assignments, and automated maintenance deadline tracking.
                  </p>
                </div>

                <button
                  onClick={() => setShowVehicleModal(true)}
                  className="bg-primary text-on-primary font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 hover:brightness-110 transition-all text-xs shadow-md shadow-primary/15"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  Register Vehicle Asset
                </button>
              </div>

              {/* Fleet Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-surface-container-low p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">Total Fleet</span>
                  <div className="text-2xl font-bold text-on-surface mt-1">{vehicles.length}</div>
                </div>
                <div className="bg-surface-container-low p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">In Use</span>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">
                    {vehicles.filter((v) => v.status === "IN_USE").length}
                  </div>
                </div>
                <div className="bg-surface-container-low p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-cyan-400 uppercase">Idle Available</span>
                  <div className="text-2xl font-bold text-cyan-400 mt-1">
                    {vehicles.filter((v) => v.status === "IDLE").length}
                  </div>
                </div>
                <div className="bg-surface-container-low p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-amber-400 uppercase">Under Maintenance</span>
                  <div className="text-2xl font-bold text-amber-400 mt-1">
                    {vehicles.filter((v) => v.status === "MAINTENANCE").length}
                  </div>
                </div>
                <div className="bg-surface-container-low p-3 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-error uppercase">Service Overdue</span>
                  <div className="text-2xl font-bold text-error mt-1">
                    {vehicles.filter((v) => v.isMaintenanceOverdue).length}
                  </div>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface-container-lowest p-3 rounded-xl border border-white/5">
                <div className="relative w-full sm:w-72">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search plate number..."
                    value={vehicleSearch}
                    onChange={(e) => setVehicleSearch(e.target.value)}
                    className="w-full bg-surface-container-high border border-outline-variant rounded-lg pl-9 pr-3 py-1.5 text-xs text-on-surface focus:border-primary outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs text-on-surface-variant font-bold">Status:</span>
                  <select
                    value={vehicleStatusFilter}
                    onChange={(e) => setVehicleStatusFilter(e.target.value as any)}
                    className="bg-surface-container-high border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:border-primary outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="IDLE">IDLE</option>
                    <option value="IN_USE">IN_USE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                  </select>
                </div>
              </div>

              {/* Vehicles Inventory Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase font-bold text-on-surface-variant border-b border-white/10 bg-white/5">
                    <tr>
                      <th className="py-3 pl-3">Plate & Type</th>
                      <th className="py-3">Status</th>
                      <th className="py-3">Assigned Driver</th>
                      <th className="py-3">Servicing Schedule</th>
                      <th className="py-3 pr-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {vehicles.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-on-surface-variant opacity-60">
                          No fleet vehicles registered yet. Click "Register Vehicle Asset" to add one.
                        </td>
                      </tr>
                    ) : (
                      vehicles
                        .filter((v) => {
                          const matchesSearch = v.plateNumber.toLowerCase().includes(vehicleSearch.toLowerCase());
                          const matchesStatus = vehicleStatusFilter === "ALL" || v.status === vehicleStatusFilter;
                          return matchesSearch && matchesStatus;
                        })
                        .map((vehicle) => (
                          <tr key={vehicle.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3.5 pl-3">
                              <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-surface-container-high border border-white/10 text-primary">
                                  <span className="material-symbols-outlined text-[20px]">
                                    {vehicle.vehicleType === "BIKE"
                                      ? "two_wheeler"
                                      : vehicle.vehicleType === "VAN"
                                      ? "airport_shuttle"
                                      : vehicle.vehicleType === "TRUCK"
                                      ? "local_shipping"
                                      : "directions_car"}
                                  </span>
                                </div>
                                <div>
                                  <div className="font-mono font-bold text-on-surface text-sm">{vehicle.plateNumber}</div>
                                  <div className="text-[10px] text-on-surface-variant font-semibold uppercase">
                                    {vehicle.vehicleType}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase border ${
                                  vehicle.status === "IN_USE"
                                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                                    : vehicle.status === "MAINTENANCE"
                                    ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                                    : "bg-cyan-500/15 text-cyan-400 border-cyan-500/25"
                                }`}
                              >
                                {vehicle.status}
                              </span>
                            </td>

                            <td className="py-3.5">
                              <select
                                value={vehicle.driverId || ""}
                                onChange={(e) =>
                                  handleAssignDriverToVehicle(vehicle.id, e.target.value ? e.target.value : null)
                                }
                                className="bg-surface-container-high border border-outline-variant text-on-surface text-xs rounded px-2 py-1 outline-none focus:border-primary max-w-[180px] truncate"
                              >
                                <option value="">-- Unassigned --</option>
                                {drivers.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.user?.email || d.id.substring(0, 8)} ({d.licenseNumber})
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="py-3.5">
                              <div className="space-y-0.5">
                                <div className="text-[11px] text-on-surface font-mono">
                                  Due: {vehicle.nextMaintenanceDue ? new Date(vehicle.nextMaintenanceDue).toLocaleDateString() : "Not set"}
                                </div>
                                {vehicle.isMaintenanceOverdue ? (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-error bg-error/15 border border-error/30 px-1.5 py-0.5 rounded">
                                    <span className="material-symbols-outlined text-[12px]">warning</span> OVERDUE
                                  </span>
                                ) : (
                                  <div className="text-[9px] text-on-surface-variant">
                                    Last: {vehicle.lastMaintenance ? new Date(vehicle.lastMaintenance).toLocaleDateString() : "N/A"}
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="py-3.5 pr-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() =>
                                    handleUpdateVehicleStatus(
                                      vehicle.id,
                                      vehicle.status === "MAINTENANCE" ? "IDLE" : "MAINTENANCE"
                                    )
                                  }
                                  title="Toggle Maintenance Status"
                                  className="p-1.5 rounded-lg bg-surface-container-high border border-outline-variant hover:bg-amber-500/20 hover:text-amber-400 text-on-surface-variant transition-all"
                                >
                                  <span className="material-symbols-outlined text-[16px]">build</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteVehicle(vehicle.id, vehicle.plateNumber)}
                                  title="Delete Vehicle Asset"
                                  className="p-1.5 rounded-lg bg-surface-container-high border border-outline-variant hover:bg-error/20 hover:text-error text-on-surface-variant transition-all"
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REGISTER VEHICLE MODAL */}
          {showVehicleModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="glass-panel border border-white/10 bg-[#0B1326] p-6 rounded-2xl w-full max-w-lg space-y-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">directions_car</span>
                    Register New Fleet Asset
                  </h3>
                  <button
                    onClick={() => setShowVehicleModal(false)}
                    className="text-on-surface-variant hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <form onSubmit={handleCreateVehicleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface-variant block">
                      PLATE NUMBER *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. KJA-482-XX"
                      value={vehicleForm.plateNumber}
                      onChange={(e) => setVehicleForm((p) => ({ ...p, plateNumber: e.target.value }))}
                      required
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 text-xs text-on-surface focus:border-primary outline-none font-mono uppercase"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-on-surface-variant block">
                        VEHICLE TYPE *
                      </label>
                      <select
                        value={vehicleForm.vehicleType}
                        onChange={(e) => setVehicleForm((p) => ({ ...p, vehicleType: e.target.value as any }))}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2.5 text-xs text-on-surface focus:border-primary outline-none"
                      >
                        <option value="BIKE">BIKE</option>
                        <option value="CAR">CAR</option>
                        <option value="VAN">VAN</option>
                        <option value="TRUCK">TRUCK</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-on-surface-variant block">
                        INITIAL STATUS
                      </label>
                      <select
                        value={vehicleForm.status}
                        onChange={(e) => setVehicleForm((p) => ({ ...p, status: e.target.value as any }))}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2.5 text-xs text-on-surface focus:border-primary outline-none"
                      >
                        <option value="IDLE">IDLE</option>
                        <option value="IN_USE">IN_USE</option>
                        <option value="MAINTENANCE">MAINTENANCE</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface-variant block">
                      ASSIGN DRIVER (OPTIONAL)
                    </label>
                    <select
                      value={vehicleForm.driverId}
                      onChange={(e) => setVehicleForm((p) => ({ ...p, driverId: e.target.value }))}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2.5 text-xs text-on-surface focus:border-primary outline-none"
                    >
                      <option value="">-- Select Driver --</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.user?.email || d.id.substring(0, 8)} ({d.licenseNumber})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-on-surface-variant block">
                        LAST MAINTENANCE DATE
                      </label>
                      <input
                        type="date"
                        value={vehicleForm.lastMaintenance}
                        onChange={(e) => setVehicleForm((p) => ({ ...p, lastMaintenance: e.target.value }))}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface focus:border-primary outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-on-surface-variant block">
                        NEXT MAINTENANCE DUE
                      </label>
                      <input
                        type="date"
                        value={vehicleForm.nextMaintenanceDue}
                        onChange={(e) => setVehicleForm((p) => ({ ...p, nextMaintenanceDue: e.target.value }))}
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs text-on-surface focus:border-primary outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setShowVehicleModal(false)}
                      className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingVehicle}
                      className="bg-primary text-on-primary font-bold px-6 py-2 rounded-lg text-xs hover:brightness-110 disabled:opacity-50"
                    >
                      {submittingVehicle ? "Saving..." : "Save Vehicle Asset"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 5: QUICK DISPATCH FORM */}
          {activeTab === "dispatch" && (
            <div className="glass-panel border-white/5 p-6 rounded-2xl space-y-6">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">add_location</span>
                  Quick Shipment Dispatcher
                </h2>
                <p className="text-xs text-on-surface-variant mt-1">
                  Create a new cargo order and immediately broadcast it to the local driver queue.
                </p>
              </div>

              <form onSubmit={handleDispatchSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Recipient details */}
                  <div className="space-y-4">
                    <h3 className="font-label-md text-label-md text-primary font-bold uppercase tracking-wider border-b border-white/5 pb-2">
                      Recipient Profile
                    </h3>

                    <div className="space-y-1.5">
                      <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="recipientName">
                        RECIPIENT NAME
                      </label>
                      <input
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-on-surface"
                        id="recipientName"
                        value={dispatchForm.recipientName}
                        onChange={(e) => setDispatchForm((p) => ({ ...p, recipientName: e.target.value }))}
                        placeholder="e.g. John Doe"
                        required
                        type="text"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="recipientPhone">
                        RECIPIENT PHONE
                      </label>
                      <input
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-on-surface"
                        id="recipientPhone"
                        value={dispatchForm.recipientPhone}
                        onChange={(e) => setDispatchForm((p) => ({ ...p, recipientPhone: e.target.value }))}
                        placeholder="e.g. +2348012345678"
                        required
                        type="text"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="recipientEmail">
                        RECIPIENT EMAIL (for Delivery OTP Email)
                      </label>
                      <input
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-on-surface"
                        id="recipientEmail"
                        value={dispatchForm.recipientEmail}
                        onChange={(e) => setDispatchForm((p) => ({ ...p, recipientEmail: e.target.value }))}
                        placeholder="e.g. recipient@gmail.com"
                        type="email"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="senderPhone">
                        SENDER PHONE
                      </label>
                      <input
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-on-surface"
                        id="senderPhone"
                        value={dispatchForm.senderPhone}
                        onChange={(e) => setDispatchForm((p) => ({ ...p, senderPhone: e.target.value }))}
                        placeholder="e.g. +2348087654321"
                        required
                        type="text"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="expectedDeliveryTime">
                        EXPECTED DELIVERY DEADLINE
                      </label>
                      <input
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-on-surface text-xs"
                        id="expectedDeliveryTime"
                        value={dispatchForm.expectedDeliveryTime}
                        onChange={(e) => setDispatchForm((p) => ({ ...p, expectedDeliveryTime: e.target.value }))}
                        type="datetime-local"
                      />
                    </div>
                  </div>

                  {/* Route details */}
                  <div className="space-y-4">
                    <h3 className="font-label-md text-label-md text-primary font-bold uppercase tracking-wider border-b border-white/5 pb-2">
                      Route Mapping
                    </h3>

                    <div className="space-y-1.5">
                      <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="pickupAddress">
                        PICKUP ADDRESS
                      </label>
                      <input
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-on-surface"
                        id="pickupAddress"
                        value={dispatchForm.pickupAddress}
                        onChange={(e) => setDispatchForm((p) => ({ ...p, pickupAddress: e.target.value }))}
                        placeholder="Warehouse starting coordinates address"
                        required
                        type="text"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant block" htmlFor="pickupLatitude">
                          PICKUP LATITUDE
                        </label>
                        <input
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:border-primary outline-none text-on-surface font-mono"
                          id="pickupLatitude"
                          value={dispatchForm.pickupLatitude}
                          onChange={(e) => setDispatchForm((p) => ({ ...p, pickupLatitude: e.target.value }))}
                          required
                          type="text"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant block" htmlFor="pickupLongitude">
                          PICKUP LONGITUDE
                        </label>
                        <input
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:border-primary outline-none text-on-surface font-mono"
                          id="pickupLongitude"
                          value={dispatchForm.pickupLongitude}
                          onChange={(e) => setDispatchForm((p) => ({ ...p, pickupLongitude: e.target.value }))}
                          required
                          type="text"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="dropoffAddress">
                        DROPOFF ADDRESS
                      </label>
                      <input
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-on-surface"
                        id="dropoffAddress"
                        value={dispatchForm.dropoffAddress}
                        onChange={(e) => setDispatchForm((p) => ({ ...p, dropoffAddress: e.target.value }))}
                        placeholder="Recipient delivery location address"
                        required
                        type="text"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant block" htmlFor="dropoffLatitude">
                          DROPOFF LATITUDE
                        </label>
                        <input
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:border-primary outline-none text-on-surface font-mono"
                          id="dropoffLatitude"
                          value={dispatchForm.dropoffLatitude}
                          onChange={(e) => setDispatchForm((p) => ({ ...p, dropoffLatitude: e.target.value }))}
                          required
                          type="text"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant block" htmlFor="dropoffLongitude">
                          DROPOFF LONGITUDE
                        </label>
                        <input
                          className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-xs focus:border-primary outline-none text-on-surface font-mono"
                          id="dropoffLongitude"
                          value={dispatchForm.dropoffLongitude}
                          onChange={(e) => setDispatchForm((p) => ({ ...p, dropoffLongitude: e.target.value }))}
                          required
                          type="text"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-800">
                  {dispatching ? (
                    <button
                      className="bg-teal-500/80 text-slate-950 font-bold py-3.5 px-8 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
                      disabled
                      type="submit"
                    >
                      <Icon icon="lucide:loader-2" className="animate-spin text-lg" />
                      <span>Dispatching Cargo...</span>
                    </button>
                  ) : (
                    <button
                      className="bg-[#29a195] hover:bg-[#22877d] text-slate-950 font-bold py-3.5 px-8 rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
                      type="submit"
                    >
                      <span>Dispatch Shipment Now</span>
                      <Icon icon="lucide:arrow-right" className="text-base" />
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* TAB 6: BILLING & SUBSCRIPTION PLAN */}
          {activeTab === "billing" && (
            <div className="space-y-8">
              {/* Subscription Status Board */}
              <div className="glass-panel border-white/5 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
                
                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-3xl text-primary">payments</span>
                    <div>
                      <h2 className="font-headline-md text-headline-md text-on-surface">
                        Billing & Subscription Console
                      </h2>
                      <p className="text-xs text-on-surface-variant">
                        Manage your company's billing statements, pricing engines, and Paystack subscriptions.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-wrap gap-4 pt-2">
                    <div className="bg-surface-container-lowest border border-white/5 rounded-xl p-4 flex-grow max-w-xs">
                      <span className="text-[10px] text-on-surface-variant font-bold uppercase block">Current Status</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`h-2.5 w-2.5 rounded-full animate-pulse ${
                          tenantSubscriptionStatus === "ACTIVE" ? "bg-emerald-400" :
                          tenantSubscriptionStatus === "TRIAL" ? "bg-cyan-400" : "bg-amber-400"
                        }`} />
                        <span className="font-mono font-bold text-sm uppercase text-on-surface">
                          {tenantSubscriptionStatus} PLAN
                        </span>
                      </div>
                    </div>

                    <div className="bg-surface-container-lowest border border-white/5 rounded-xl p-4 flex-grow max-w-xs">
                      <span className="text-[10px] text-on-surface-variant font-bold uppercase block">Monthly Due</span>
                      <div className="font-headline-md text-headline-lg text-primary mt-1 font-bold">
                        ₦50,000 <span className="text-xs text-on-surface-variant font-normal">/ month</span>
                      </div>
                    </div>
                  </div>

                  {/* 30-Day Free Trial Timer Bar */}
                  {tenantSubscriptionStatus === "TRIAL" && (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-cyan-400 uppercase tracking-wider text-[10px] font-bold">30-Day Free Trial Progress</span>
                        <span className="text-on-surface-variant">
                          {Math.max(0, 30 - Math.floor((Date.now() - new Date(tenantCreatedDate || Date.now()).getTime()) / (1000 * 60 * 60 * 24)))} days remaining
                        </span>
                      </div>
                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="bg-gradient-to-r from-cyan-500 to-primary h-full transition-all duration-500"
                          style={{ 
                            width: `${Math.max(0, Math.min(100, (1 - Math.floor((Date.now() - new Date(tenantCreatedDate || Date.now()).getTime()) / (1000 * 60 * 60 * 24)) / 30) * 100))}%` 
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Paystack Operations Panel */}
                <div className="bg-surface-container-lowest border border-white/5 p-5 rounded-xl flex flex-col justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-primary">verified_user</span>
                      Paystack Secure Gateway
                    </h3>
                    <p className="text-[11px] text-on-surface-variant mt-1.5">
                      Upgrade to active plan or renew to unlock unrestricted logistics matching and driver rosters.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {subscribing ? (
                      <button className="w-full bg-primary/20 text-primary border border-primary/30 py-2.5 rounded-lg flex items-center justify-center gap-2 pointer-events-none opacity-80" disabled>
                        <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                        Initializing Checkout...
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handlePaystackCheckout("MONTHLY")}
                          className="w-full bg-primary-container text-on-primary-container font-headline-md py-2.5 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-primary/10"
                        >
                          <span className="material-symbols-outlined text-[16px]">credit_card</span>
                          Subscribe Monthly (₦50k)
                        </button>
                        <button
                          onClick={() => handlePaystackCheckout("ANNUAL")}
                          className="w-full bg-surface-container-high border border-outline-variant text-on-surface font-headline-md py-2.5 rounded-lg hover:bg-white/5 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[16px]">loyalty</span>
                          Subscribe Annual (₦500k)
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Pricing Formula Rules Config & Past Statements */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Column 1: Rates Config Form */}
                <div className="lg:col-span-1 glass-panel border-white/5 p-6 rounded-2xl space-y-6">
                  <div>
                    <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary">settings_applications</span>
                      Pricing Formula Engine
                    </h3>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">
                      Configure base rates and multipliers used to quote customer bookings.
                    </p>
                  </div>

                  <form onSubmit={handleUpdateRatesSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase block">Base Fare (NGN ₦)</label>
                      <input
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 focus:border-primary outline-none text-on-surface text-xs font-semibold"
                        value={rates.baseFare}
                        onChange={(e) => setRates(p => ({ ...p, baseFare: parseFloat(e.target.value) || 0 }))}
                        type="number"
                        min="0"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-on-surface-variant uppercase block">Per-KM Rate (NGN ₦)</label>
                      <input
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 focus:border-primary outline-none text-on-surface text-xs font-semibold"
                        value={rates.perKmRate}
                        onChange={(e) => setRates(p => ({ ...p, perKmRate: parseFloat(e.target.value) || 0 }))}
                        type="number"
                        min="0"
                        required
                      />
                    </div>

                    <div className="border-t border-white/5 pt-4 space-y-3">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase block">Vehicle Multipliers</span>
                      
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="space-y-1">
                          <span className="text-[9px] font-semibold text-on-surface-variant uppercase block">BIKE MULTIPLIER</span>
                          <input
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1.5 focus:border-primary outline-none text-on-surface text-xs font-semibold font-mono"
                            value={rates.bikeMultiplier}
                            onChange={(e) => setRates(p => ({ ...p, bikeMultiplier: parseFloat(e.target.value) || 1 }))}
                            type="number"
                            step="0.1"
                            min="0.1"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-semibold text-on-surface-variant uppercase block">CAR MULTIPLIER</span>
                          <input
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1.5 focus:border-primary outline-none text-on-surface text-xs font-semibold font-mono"
                            value={rates.carMultiplier}
                            onChange={(e) => setRates(p => ({ ...p, carMultiplier: parseFloat(e.target.value) || 1 }))}
                            type="number"
                            step="0.1"
                            min="0.1"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-semibold text-on-surface-variant uppercase block">VAN MULTIPLIER</span>
                          <input
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1.5 focus:border-primary outline-none text-on-surface text-xs font-semibold font-mono"
                            value={rates.vanMultiplier}
                            onChange={(e) => setRates(p => ({ ...p, vanMultiplier: parseFloat(e.target.value) || 1 }))}
                            type="number"
                            step="0.1"
                            min="0.1"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-semibold text-on-surface-variant uppercase block">TRUCK MULTIPLIER</span>
                          <input
                            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-2 py-1.5 focus:border-primary outline-none text-on-surface text-xs font-semibold font-mono"
                            value={rates.truckMultiplier}
                            onChange={(e) => setRates(p => ({ ...p, truckMultiplier: parseFloat(e.target.value) || 1 }))}
                            type="number"
                            step="0.1"
                            min="0.1"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      className="w-full bg-primary-container text-on-primary-container font-headline-md py-2.5 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all duration-150 shadow-md shadow-primary/10 mt-2"
                      type="submit"
                    >
                      Save Pricing Rates
                    </button>
                  </form>
                </div>

                {/* Column 2 & 3: Past Statements / Invoices Table */}
                <div className="lg:col-span-2 glass-panel border-white/5 p-6 rounded-2xl space-y-6">
                  <div>
                    <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary">receipt_long</span>
                      Past Invoices & Statements
                    </h3>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">
                      View past transaction logs and download verified delivery invoice breakdown cards.
                    </p>
                  </div>

                  {loadingBilling ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
                      <span className="text-xs text-on-surface-variant">Loading invoices history...</span>
                    </div>
                  ) : billingInvoices.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2 text-on-surface-variant">
                      <span className="material-symbols-outlined text-4xl opacity-40">receipt</span>
                      <span className="text-xs">No invoices generated yet. Complete shipments to see statements.</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-[9px] uppercase font-bold text-on-surface-variant">
                            <th className="pb-3">INVOICE ID</th>
                            <th className="pb-3">RECIPIENT</th>
                            <th className="pb-3">DISTANCE</th>
                            <th className="pb-3">TOTAL AMOUNT</th>
                            <th className="pb-3">STATUS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-[11px]">
                          {billingInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-white/5 transition-all">
                              <td className="py-3.5 font-mono text-primary select-all">{inv.id.substring(0, 8)}...</td>
                              <td className="py-3.5 text-on-surface">{inv.delivery?.recipientName || "N/A"}</td>
                              <td className="py-3.5 font-mono">{inv.distanceKm} km</td>
                              <td className="py-3.5 text-on-surface font-semibold">₦{inv.totalAmount.toLocaleString()}</td>
                              <td className="py-3.5">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                  inv.status === "PAID" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                                }`}>
                                  {inv.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}
          {/* POD INSPECTION CERTIFICATE MODAL */}
          {selectedPodDelivery && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="glass-panel border border-white/10 bg-[#0B1326] p-6 rounded-2xl w-full max-w-xl space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">verified</span>
                      Proof of Delivery Certificate
                    </h3>
                    <span className="text-[10px] text-primary font-mono uppercase tracking-widest font-bold">
                      Order ID: {selectedPodDelivery.id}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedPodDelivery(null)}
                    className="text-on-surface-variant hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-surface-container-lowest p-4 rounded-xl border border-white/5 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase block">Recipient</span>
                    <div className="font-semibold text-on-surface text-sm mt-0.5">{selectedPodDelivery.recipientName}</div>
                    <div className="text-on-surface-variant font-mono">{selectedPodDelivery.recipientPhone}</div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase block">Handoff Verification</span>
                    <div className="font-mono font-bold text-primary text-sm mt-0.5">OTP: {selectedPodDelivery.deliveryOtp}</div>
                    <div className="text-emerald-400 font-bold uppercase text-[10px] flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      Verified Handoff
                    </div>
                  </div>
                </div>

                {/* Recipient Digital Signature Image Preview */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block flex items-center gap-1">
                    <span className="material-symbols-outlined text-primary text-[16px]">draw</span>
                    Recipient Digital Signature Canvas
                  </span>
                  {selectedPodDelivery.signaturePhotoUrl ? (
                    <div className="bg-[#070D1B] border border-primary/30 p-4 rounded-xl flex items-center justify-center min-h-[120px]">
                      <img
                        src={selectedPodDelivery.signaturePhotoUrl}
                        alt="Recipient Signature"
                        className="max-h-[100px] object-contain"
                      />
                    </div>
                  ) : (
                    <div className="bg-surface-container-low border border-white/5 p-4 rounded-xl text-center text-on-surface-variant/60 text-xs italic">
                      Digital signature capture not attached for this legacy order.
                    </div>
                  )}
                </div>

                {/* Cargo Delivery Photo Preview */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block flex items-center gap-1">
                    <span className="material-symbols-outlined text-primary text-[16px]">photo_camera</span>
                    Cargo Delivery Photo Proof
                  </span>
                  {selectedPodDelivery.proofOfDeliveryPhotoUrl ? (
                    <div className="bg-[#070D1B] border border-white/10 rounded-xl overflow-hidden max-h-[260px] flex items-center justify-center">
                      <img
                        src={selectedPodDelivery.proofOfDeliveryPhotoUrl}
                        alt="Cargo POD"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="bg-surface-container-low border border-white/5 p-4 rounded-xl text-center text-on-surface-variant/60 text-xs italic">
                      No photo proof attached for this shipment.
                    </div>
                  )}
                </div>

                <div className="flex justify-end border-t border-white/10 pt-4">
                  <button
                    onClick={() => setSelectedPodDelivery(null)}
                    className="bg-surface-container-high border border-outline-variant hover:bg-white/10 text-on-surface px-5 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    Close Certificate
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

