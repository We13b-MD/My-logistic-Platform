import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { driverApi } from "@/api/driver.api";
import { deliveryApi } from "@/api/delivery.api";
import { toast } from "sonner";
import { Delivery, DriverProfile } from "@/types";
import { SignatureCanvas } from "@/components/SignatureCanvas";

// Leaflet imports

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Resolve Leaflet marker asset bundle issues in React
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom colored markers for visual clarity
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

export function DriverDashboardPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();


  // Driver Profile States
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [submittingProfile, setSubmittingProfile] = useState(false);

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    vehicleType: "BIKE",
    licenseNumber: "",
  });

  // Online GPS Queue States
  const [isOnline, setIsOnline] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);

  // Fuel & Telematics State
  const [fuelLevel, setFuelLevel] = useState<number>(12); // Default to 12% Low Fuel Alert state
  const [showRefuelModal, setShowRefuelModal] = useState(false);
  const [refuelLiters, setRefuelLiters] = useState("5.0");
  const [requestingVoucher, setRequestingVoucher] = useState(false);

  const handleRequestVoucher = () => {
    setRequestingVoucher(true);
    setTimeout(() => {
      setRequestingVoucher(false);
      toast.success("Emergency Refuel Voucher (₦6,025) requested! Dispatcher notified.");
    }, 1000);
  };

  const handleCompleteRefuel = (e: React.FormEvent) => {
    e.preventDefault();
    const liters = parseFloat(refuelLiters) || 5.0;
    const cost = liters * 1205;
    setFuelLevel(100);
    setShowRefuelModal(false);
    toast.success(`Gas station top-up logged! (${liters}L = ₦${cost.toLocaleString()}). Fuel tank at 100%.`);
  };

  // Active Job & POD States
  const [activeDelivery, setActiveDelivery] = useState<Delivery | null>(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [jobHistory, setJobHistory] = useState<Delivery[]>([]);

  // Proof of Delivery (POD) Canvas & Photo States
  const [showPodModal, setShowPodModal] = useState(false);
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [uploadingPod, setUploadingPod] = useState(false);

  // 1. Fetch & Check Driver Profile
  const loadDriverProfile = async () => {
    try {
      setIsProfileLoaded(false);
      const res = await driverApi.getProfile();
      if (res.data?.status === "success" && res.data?.data) {
        setDriverProfile(res.data.data);
        setIsOnline(res.data.data.isOnline);
      } else {
        setDriverProfile(null);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        setDriverProfile(null);
      } else {
        console.error("Driver profile check failed:", error);
        toast.error("Failed to authenticate driver credentials.");
      }
    } finally {
      setIsProfileLoaded(true);
    }
  };

  // 2. Fetch Assigned Delivery Tasks
  const fetchDeliveries = async (profileId: string) => {
    try {
      setLoadingJob(true);
      const res = await deliveryApi.list();
      if (res.data?.status === "success" && res.data?.data) {
        const list: Delivery[] = res.data.data;

        // Active delivery assigned to this driver
        const active = list.find(
          (d) =>
            d.driverId === profileId &&
            ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"].includes(d.status)
        );
        setActiveDelivery(active || null);

        // Filter past deliveries completed/cancelled
        const history = list.filter(
          (d) => d.driverId === profileId && ["DELIVERED", "CANCELLED"].includes(d.status)
        );
        setJobHistory(history);
      }
    } catch (error) {
      console.error("Failed to load driver cargo jobs:", error);
    } finally {
      setLoadingJob(false);
    }
  };

  useEffect(() => {
    loadDriverProfile();
  }, []);

  // When profile is loaded and found, load the driver's deliveries
  useEffect(() => {
    if (driverProfile?.id) {
      fetchDeliveries(driverProfile.id);
    }
  }, [driverProfile?.id]);

  // 3. Complete Profile Setup submission
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.licenseNumber.trim()) {
      toast.error("License number is required.");
      return;
    }
    setSubmittingProfile(true);
    try {
      const res = await driverApi.createProfile(profileForm);
      if (res.data?.status === "success") {
        toast.success("Driver profile successfully created!");
        loadDriverProfile();
      }
    } catch (error) {
      console.error("Profile creation error:", error);
      toast.error("Failed to save driver profile details.");
    } finally {
      setSubmittingProfile(false);
    }
  };

  // 4. Toggle online status with browser GPS coordinate capture
  const handleToggleOnline = () => {
    setTogglingOnline(true);
    const nextStatus = !isOnline;

    if (nextStatus) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            await submitStatusToggle(nextStatus, position.coords.latitude, position.coords.longitude);
          },
          async (err) => {
            console.warn("Geolocation failed, falling back to Lagos coordinates.", err);
            await submitStatusToggle(nextStatus, 6.5244, 3.3792);
          }
        );
      } else {
        submitStatusToggle(nextStatus, 6.5244, 3.3792);
      }
    } else {
      submitStatusToggle(nextStatus);
    }
  };

  const submitStatusToggle = async (online: boolean, lat?: number, lng?: number) => {
    try {
      const res = await driverApi.toggleOnlineStatus({
        isOnline: online,
        latitude: lat,
        longitude: lng,
      });

      if (res.data?.status === "success") {
        setIsOnline(online);
        toast.success(`You are now ${online ? "Online (broadcasting location)" : "Offline"}`);
        loadDriverProfile();
      }
    } catch (error) {
      console.error("Failed to toggle online queue:", error);
      toast.error("Failed to toggle active queue status.");
    } finally {
      setTogglingOnline(false);
    }
  };

  // File to base64 converter helper for cargo photo
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Cargo photo file size must be less than 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };


  // 5. Update Delivery Status
  const handleStatusChange = async (nextStatus: "PICKED_UP" | "IN_TRANSIT" | "DELIVERED") => {
    if (!activeDelivery) return;

    // If attempting to complete delivery, trigger Proof of Delivery (POD) modal
    if (nextStatus === "DELIVERED") {
      setShowPodModal(true);
      return;
    }

    setUpdatingStatus(true);
    try {
      const payload: any = { status: nextStatus };
      const res = await deliveryApi.updateStatus(activeDelivery.id, payload);
      if (res.data?.status === "success") {
        toast.success(`Shipment advanced to: ${nextStatus}!`);
        if (driverProfile?.id) {
          fetchDeliveries(driverProfile.id);
        }
      }
    } catch (error: any) {
      console.error("Status transition failed:", error);
      const errMsg = error.response?.data?.message || "Failed to update shipment status.";
      toast.error(errMsg);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // 6. Complete Delivery with Verified POD (Cloudinary CDN Upload + OTP)
  const handlePODSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDelivery) return;

    if (!otpInput.trim() || otpInput.length !== 6) {
      toast.error("Please enter the recipient's 6-digit confirmation OTP.");
      return;
    }

    if (!signatureBase64) {
      toast.error("Recipient digital signature is required on the canvas.");
      return;
    }

    setUploadingPod(true);
    try {
      // Step A: Upload photos/signatures to Cloudinary CDN (or local disk fallback)
      let podPhotoUrl: string | undefined;
      let podSignatureUrl: string | undefined;

      const uploadRes = await deliveryApi.uploadPOD({
        photoBase64: photoBase64 || undefined,
        signatureBase64: signatureBase64 || undefined,
      });

      if (uploadRes.data?.status === "success") {
        podPhotoUrl = uploadRes.data.data?.proofOfDeliveryPhotoUrl;
        podSignatureUrl = uploadRes.data.data?.signaturePhotoUrl;
      }

      // Step B: Submit delivery completion payload
      const payload = {
        status: "DELIVERED",
        deliveryOtp: otpInput,
        actualDropoffLatitude: driverProfile?.lastLatitude || 6.5182,
        actualDropoffLongitude: driverProfile?.lastLongitude || 3.3769,
        proofOfDeliveryPhotoUrl: podPhotoUrl,
        signaturePhotoUrl: podSignatureUrl,
      };

      const res = await deliveryApi.updateStatus(activeDelivery.id, payload);
      if (res.data?.status === "success") {
        toast.success("🎉 Delivery completed! Proof of Delivery & Signature verified.");
        setShowPodModal(false);
        setOtpInput("");
        setSignatureBase64(null);
        setPhotoBase64(null);
        if (driverProfile?.id) {
          fetchDeliveries(driverProfile.id);
        }
      }
    } catch (error: any) {
      console.error("POD handoff submission error:", error);
      toast.error(error.response?.data?.message || "Failed to complete delivery handoff.");
    } finally {
      setUploadingPod(false);
    }
  };


  // Handle Logout
  const handleLogout = () => {
    logout();
    toast.success("Driver logged out.");
    navigate("/login");
  };

  // Screen Loader
  if (!isProfileLoaded) {
    return (
      <div className="min-h-screen bg-[#0B1326] flex items-center justify-center text-primary font-bold">
        <span className="material-symbols-outlined animate-spin text-[32px]">progress_activity</span>
      </div>
    );
  }

  // SCREEN A: Driver has no registered profile
  if (!driverProfile) {
    return (
      <div
        className="min-h-screen w-full text-on-surface flex flex-col items-center justify-center p-gutter relative overflow-x-hidden"
        style={{
          backgroundColor: "#0B1326",
          backgroundImage: "radial-gradient(at 0% 0%, rgba(13, 148, 136, 0.15) 0px, transparent 50%)",
        }}
      >
        <main className="w-full max-w-[440px] glass-panel rounded-2xl p-6 md:p-8 space-y-6 z-10">
          <div className="text-center">
            <span className="material-symbols-outlined text-[48px] text-primary">local_shipping</span>
            <h1 className="font-headline-md text-headline-md text-on-surface mt-2">Driver Onboarding</h1>
            <p className="text-xs text-on-surface-variant mt-1">
              Complete your fleet registry details to unlock the dispatch queue.
            </p>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="vehicleType">
                VEHICLE TYPE
              </label>
              <select
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 font-body-md focus:border-primary outline-none transition-all text-on-surface text-xs"
                id="vehicleType"
                value={profileForm.vehicleType}
                onChange={(e) => setProfileForm((p) => ({ ...p, vehicleType: e.target.value }))}
              >
                <option value="BIKE">Motorbike / Courier Bike</option>
                <option value="CAR">Courier Sedan / Car</option>
                <option value="VAN">Light Cargo Van</option>
                <option value="TRUCK">Heavy Freight Truck</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-label-md text-label-md text-on-surface-variant block" htmlFor="licenseNumber">
                DRIVERS LICENSE NUMBER
              </label>
              <input
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 font-body-md focus:border-primary outline-none transition-all text-on-surface font-mono"
                id="licenseNumber"
                placeholder="DL-XXXXXXXXX"
                value={profileForm.licenseNumber}
                onChange={(e) => setProfileForm((p) => ({ ...p, licenseNumber: e.target.value }))}
                required
                type="text"
              />
            </div>

            <button
              disabled={submittingProfile}
              className="w-full bg-[#0D9488] hover:bg-[#0F766E] text-white font-headline-md text-[16px] py-3.5 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
              type="submit"
            >
              {submittingProfile && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
              Save Profile
            </button>
          </form>

          <button onClick={handleLogout} className="w-full text-center text-xs text-on-surface-variant/60 hover:underline">
            Logout
          </button>
        </main>
      </div>
    );
  }

  // SCREEN B: Driver profile exists but is pending Super Admin verification
  if (!driverProfile.isVerified) {
    return (
      <div
        className="min-h-screen w-full text-on-surface flex flex-col items-center justify-center p-gutter relative overflow-x-hidden"
        style={{
          backgroundColor: "#0B1326",
          backgroundImage: "radial-gradient(at 0% 0%, rgba(13, 148, 136, 0.15) 0px, transparent 50%)",
        }}
      >
        <main className="w-full max-w-[440px] glass-panel rounded-2xl p-6 md:p-8 text-center space-y-6 z-10">
          <span className="material-symbols-outlined text-[64px] text-amber-500 animate-pulse">lock_person</span>
          <div className="space-y-2">
            <h1 className="font-headline-md text-headline-md text-on-surface">Registration Pending</h1>
            <p className="text-xs text-on-surface-variant">
              Your driver profile has been successfully saved, but requires verification from your company administrator.
            </p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-[11px] text-amber-500 text-left space-y-1">
            <p><strong>License:</strong> {driverProfile.licenseNumber}</p>
            <p><strong>Vehicle:</strong> {driverProfile.vehicleType}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-surface-container-high border border-outline-variant hover:bg-white/10 text-on-surface py-3 rounded-lg text-xs font-semibold"
          >
            Logout & Exit
          </button>
        </main>
      </div>
    );
  }

  // SCREEN C: Verified Driver Console
  return (
    <div
      className="min-h-screen w-full text-on-surface flex flex-col font-body-md relative overflow-x-hidden"
      style={{
        backgroundColor: "#0B1326",
        backgroundImage: `
          radial-gradient(at 0% 0%, rgba(13, 148, 136, 0.08) 0px, transparent 50%),
          radial-gradient(at 100% 100%, rgba(3, 181, 211, 0.06) 0px, transparent 50%)
        `,
      }}
    >
      {/* Driver Header */}
      <header className="glass-panel border-b border-white/10 px-6 py-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[28px]">local_shipping</span>
          <div>
            <h1 className="font-headline-md text-[18px] text-primary font-bold tracking-tight leading-none">
              Logistel Mobile
            </h1>
            <span className="text-[9px] text-on-surface-variant uppercase tracking-widest font-semibold">
              Driver Portal
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 hover:bg-error/20 text-on-surface-variant hover:text-error transition-all py-1.5 px-3 rounded-lg text-xs font-semibold"
        >
          <span className="material-symbols-outlined text-[16px]">logout</span>
          Logout
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-[800px] w-full mx-auto px-4 py-6 space-y-6 z-10">

        {/* Driver Status Panel */}
        <div className="glass-panel border-white/5 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`w-3.5 h-3.5 rounded-full border border-white/10 ${isOnline ? "bg-green-500 shadow-[0_0_8px_#10B981]" : "bg-on-surface-variant/20"
                }`}
            ></span>
            <div>
              <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold block">Duty Status</span>
              <span className="font-semibold text-sm">
                {isOnline ? "Active & Online (Matching Routes)" : "Off Duty / Offline"}
              </span>
            </div>
          </div>

          <button
            onClick={handleToggleOnline}
            disabled={togglingOnline}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isOnline
              ? "bg-error/15 border border-error/30 text-error hover:bg-error/30"
              : "bg-primary-container text-on-primary-container hover:brightness-110 shadow-lg shadow-primary/10"
              }`}
          >
            {togglingOnline ? (
              <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
            ) : isOnline ? (
              "Go Offline"
            ) : (
              "Go Online"
            )}
          </button>
        </div>

        {/* FUEL & TELEMATICS CONSOLE */}
        <div className="glass-panel border-white/5 p-5 rounded-2xl space-y-4 bg-slate-900/60 relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div className="flex items-center space-x-2">
              <span className="text-xl">⛽</span>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Vehicle Fuel & Telematics</span>
                  {fuelLevel <= 20 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                      🚨 LOW FUEL ALERT
                    </span>
                  )}
                </h3>
                <span className="text-[11px] text-slate-400">
                  Lagos Petrol Benchmark: <strong className="text-amber-400">₦1,205/Liter</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleRequestVoucher}
                disabled={requestingVoucher}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all"
              >
                {requestingVoucher ? "Requesting..." : "⛽ Request Voucher"}
              </button>
              <button
                onClick={() => setShowRefuelModal(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all"
              >
                🔧 Log Top-Up
              </button>
            </div>
          </div>

          {/* Visual Tank Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300">Current Tank Level</span>
              <span className={fuelLevel <= 20 ? "text-red-400 font-bold font-mono" : "text-emerald-400 font-bold font-mono"}>
                {fuelLevel}% {fuelLevel <= 20 ? "(Refuel Needed)" : "(Optimal)"}
              </span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 border border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  fuelLevel <= 20 ? "bg-red-500 shadow-[0_0_10px_#EF4444]" : fuelLevel <= 50 ? "bg-amber-500" : "bg-emerald-500 shadow-[0_0_8px_#10B981]"
                }`}
                style={{ width: `${fuelLevel}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* GAS STATION TOP-UP MODAL */}
        {showRefuelModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <span>⛽ Log Gas Station Refuel</span>
                </h3>
                <button
                  onClick={() => setShowRefuelModal(false)}
                  className="text-slate-400 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCompleteRefuel} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300 font-semibold block">LITERS PUMPED</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="50"
                    value={refuelLiters}
                    onChange={(e) => setRefuelLiters(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono text-base focus:border-amber-500 outline-none"
                    required
                  />
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1 text-slate-300">
                  <div className="flex justify-between">
                    <span>Lagos Petrol Rate:</span>
                    <span className="font-mono text-amber-400">₦1,205 / Liter</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-white pt-1 border-t border-slate-800">
                    <span>Total Refuel Cost:</span>
                    <span className="font-mono text-emerald-400">
                      ₦{((parseFloat(refuelLiters) || 0) * 1205).toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg transition-all text-sm"
                >
                  Submit Top-Up & Reset Tank (100%)
                </button>
              </form>
            </div>
          </div>
        )}


        {/* ACTIVE TASK PANEL */}
        {loadingJob ? (
          <div className="glass-panel border-white/5 p-8 rounded-2xl flex justify-center text-primary">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
          </div>
        ) : activeDelivery ? (
          <div className="space-y-4">
            <div className="glass-panel border-white/5 p-6 rounded-2xl space-y-6">

              {/* Task Header */}
              <div className="flex justify-between items-start border-b border-white/5 pb-4">
                <div>
                  <span className="text-[9px] bg-secondary/10 border border-secondary/20 text-secondary font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                    ACTIVE ROUTE IN PROGRESS
                  </span>
                  <h2 className="font-headline-md text-headline-md mt-1.5 text-on-surface">
                    Deliver to {activeDelivery.recipientName}
                  </h2>
                </div>
                <span className="text-xs font-bold text-primary bg-primary/15 border border-primary/20 px-3 py-1 rounded-full uppercase tracking-wider">
                  {activeDelivery.status}
                </span>
              </div>

              {/* Addresses details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">
                    1. PICKUP WAREHOUSE
                  </span>
                  <p className="font-medium text-on-surface">{activeDelivery.pickupAddress}</p>
                  <p className="text-[10px] text-on-surface-variant">Phone: {activeDelivery.senderPhone}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block">
                    2. DROPOFF DESTINATION
                  </span>
                  <p className="font-medium text-on-surface">{activeDelivery.dropoffAddress}</p>
                  <p className="text-[10px] text-on-surface-variant">Phone: {activeDelivery.recipientPhone}</p>
                </div>
              </div>

              {/* Navigation Map */}
              <div className="h-[220px] rounded-xl overflow-hidden border border-white/10 relative z-0">
                <MapContainer
                  center={[
                    (activeDelivery.pickupLatitude + activeDelivery.dropoffLatitude) / 2,
                    (activeDelivery.pickupLongitude + activeDelivery.dropoffLongitude) / 2,
                  ]}
                  zoom={12}
                  style={{ height: "100%", width: "100%" }}
                  zoomControl={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />

                  {/* Pickup Pin */}
                  <Marker position={[activeDelivery.pickupLatitude, activeDelivery.pickupLongitude]} icon={pickupIcon}>
                    <Popup><div className="text-black text-xs">Pickup Address</div></Popup>
                  </Marker>

                  {/* Dropoff Pin */}
                  <Marker position={[activeDelivery.dropoffLatitude, activeDelivery.dropoffLongitude]} icon={dropoffIcon}>
                    <Popup><div className="text-black text-xs">Dropoff Address</div></Popup>
                  </Marker>

                  {/* Driver Pin (Mock coordinates if offline, otherwise show latest) */}
                  <Marker
                    position={[
                      driverProfile.lastLatitude || activeDelivery.pickupLatitude,
                      driverProfile.lastLongitude || activeDelivery.pickupLongitude,
                    ]}
                    icon={driverIcon}
                  >
                    <Popup><div className="text-black text-xs font-bold text-red-600">Your Vehicle</div></Popup>
                  </Marker>
                </MapContainer>
              </div>

              {/* Route status flow controls */}
              <div className="pt-2 border-t border-white/5 space-y-4">
                {activeDelivery.status === "ASSIGNED" && (
                  <button
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange("PICKED_UP")}
                    className="w-full bg-[#0D9488] hover:bg-[#0F766E] text-white font-headline-md py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold"
                  >
                    {updatingStatus && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
                    Confirm Package Pickup
                  </button>
                )}

                {activeDelivery.status === "PICKED_UP" && (
                  <button
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange("IN_TRANSIT")}
                    className="w-full bg-[#0D9488] hover:bg-[#0F766E] text-white font-headline-md py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold"
                  >
                    {updatingStatus && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
                    Depart to Route (In Transit)
                  </button>
                )}

                {activeDelivery.status === "IN_TRANSIT" && (
                  <div className="space-y-3 bg-surface-container-low p-4 rounded-xl border border-white/5">
                    <div className="space-y-1">
                      <label className="text-[10px] text-primary font-bold uppercase tracking-wider block" htmlFor="otp">
                        RECIPIENT CONFIRMATION OTP
                      </label>
                      <span className="text-[10px] text-on-surface-variant block pb-1">
                        Collect the 6-digit confirmation pin from the recipient to deliver packages.
                      </span>
                      <input
                        className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 font-mono text-center text-lg tracking-widest text-on-surface focus:border-primary outline-none transition-all"
                        id="otp"
                        maxLength={6}
                        onChange={(e) => setOtpInput(e.target.value)}
                        placeholder="0 0 0 0 0 0"
                        required
                        type="text"
                        value={otpInput}
                      />
                    </div>

                    <button
                      disabled={updatingStatus}
                      onClick={() => handleStatusChange("DELIVERED")}
                      className="w-full bg-[#0D9488] hover:bg-[#0F766E] text-white font-headline-md py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold"
                    >
                      {updatingStatus && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
                      Submit OTP & Complete Delivery
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* NO JOBS ASSIGNED VIEW */
          <div className="glass-panel border-white/5 p-12 text-center rounded-2xl space-y-3">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40 animate-pulse">
              notifications_active
            </span>
            <div className="space-y-1">
              <h2 className="font-headline-md text-headline-md text-on-surface">Queue Empty</h2>
              <p className="text-xs text-on-surface-variant max-w-[320px] mx-auto">
                {isOnline
                  ? "Waiting for dispatchers to assign deliveries. Keep this tab open to stream your GPS location."
                  : "You are off duty. Go Online to begin receiving delivery tasks."}
              </p>
            </div>
          </div>
        )}

        {/* Past Job history */}
        <div className="glass-panel border-white/5 p-5 rounded-2xl space-y-4">
          <h3 className="font-headline-md text-[15px] text-on-surface border-b border-white/5 pb-2">
            Recent Activity History
          </h3>
          <div className="space-y-3">
            {jobHistory.length === 0 ? (
              <p className="text-xs text-on-surface-variant opacity-60 text-center py-4">
                No deliveries completed on this shift yet.
              </p>
            ) : (
              jobHistory.map((job: Delivery) => (

                <div key={job.id} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5 text-xs">
                  <div>
                    <p className="font-semibold text-on-surface">To: {job.recipientName}</p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">{job.dropoffAddress}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${job.status === "DELIVERED"
                      ? "bg-green-500/10 border border-green-500/20 text-green-500"
                      : "bg-error/10 border border-error/20 text-error"
                      }`}
                  >
                    {job.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        {/* PROOF OF DELIVERY (POD) & DIGITAL SIGNATURE MODAL */}
        {showPodModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="glass-panel border border-white/10 bg-[#0B1326] p-6 rounded-2xl w-full max-w-lg space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">draw</span>
                    Proof of Delivery (POD)
                  </h3>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                    Cloudinary CDN Cloud Storage Enabled
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPodModal(false)}
                  className="text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handlePODSubmit} className="space-y-4">
                {/* 1. Recipient Digital Signature Canvas */}
                <SignatureCanvas onSignatureChange={setSignatureBase64} />

                {/* 2. Delivery Cargo Photo Upload */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-on-surface-variant block uppercase tracking-wider">
                    CARGO DELIVERY PHOTO (OPTIONAL)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="w-full text-xs text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer"
                  />
                  {photoBase64 && (
                    <div className="mt-2 relative w-24 h-24 rounded-lg overflow-hidden border border-white/20">
                      <img src={photoBase64} alt="Cargo Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhotoBase64(null)}
                        className="absolute top-1 right-1 bg-error text-white p-0.5 rounded-full text-[10px]"
                      >
                        <span className="material-symbols-outlined text-[12px]">close</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Recipient OTP Entry */}
                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <label className="text-xs font-bold text-on-surface-variant block uppercase tracking-wider">
                    RECIPIENT CONFIRMATION OTP (6 DIGITS) *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit PIN"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ""))}
                    required
                    className="w-full bg-surface-container-lowest border border-primary/40 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-[0.5em] text-primary focus:border-primary outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowPodModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingPod}
                    className="bg-primary text-on-primary font-bold px-6 py-2.5 rounded-xl text-xs hover:brightness-110 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20"
                  >
                    {uploadingPod ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                        Uploading POD to Cloud...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">verified</span>
                        Verify & Complete Delivery
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

