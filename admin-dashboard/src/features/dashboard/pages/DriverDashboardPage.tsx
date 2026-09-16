import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { driverApi } from "@/api/driver.api";
import { deliveryApi } from "@/api/delivery.api";
import { toast } from "sonner";
import { Delivery, DriverProfile } from "@/types";
import { SignatureCanvas } from "@/components/SignatureCanvas";
import { Icon } from "@iconify/react";
import { LogistelLogo } from "@/components/LogistelLogo";
import { useOsrmRoute } from "@/utils/useOsrmRoute";
import { useNavigationAudio } from "@/utils/useNavigatorAudio";


// Leaflet imports
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
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


// Helper to smoothly pan and follow driver's vehicle while navigating
function MapRecenter({ lat, lng, isNavigating }: { lat?: number; lng?: number; isNavigating: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng && isNavigating) {
      map.panTo([lat, lng], { animate: true, duration: 1.2 });
    }
  }, [lat, lng, isNavigating, map]);
  return null;
}


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

  // Available Dispatch Pool States
  const [availableJobs, setAvailableJobs] = useState<Delivery[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // ─── Custom In-App Navigator States ───
  const [liveCoords, setLiveCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [liveMetersToTurn, setLiveMetersToTurn] = useState<number | null>(null);
  const [isNavigatingInApp, setIsNavigatingInApp] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [mapLayerType, setMapLayerType] = useState<"streets" | "satellite">("streets");

  // OSRM road route geometry for driver navigation with live distance, ETA & turn steps
  const { routeCoords, distanceKm, durationMins, durationRange, steps } = useOsrmRoute(
    activeDelivery?.status === "ASSIGNED"
      ? (liveCoords?.lat || driverProfile?.lastLatitude || activeDelivery?.pickupLatitude)
      : activeDelivery?.pickupLatitude,
    activeDelivery?.status === "ASSIGNED"
      ? (liveCoords?.lng || driverProfile?.lastLongitude || activeDelivery?.pickupLongitude)
      : activeDelivery?.pickupLongitude,
    activeDelivery?.status === "ASSIGNED"
      ? activeDelivery?.pickupLatitude
      : activeDelivery?.dropoffLatitude,
    activeDelivery?.status === "ASSIGNED"
      ? activeDelivery?.pickupLongitude
      : activeDelivery?.dropoffLongitude,
    driverProfile?.vehicleType
  );

  // Audio Guidance & Screen-Wake Engine
  const { speak, isMuted, toggleMute, isWakeLocked } = useNavigationAudio(isNavigatingInApp);
  const lastAnnouncedStepRef = useRef<number>(-1);

  // 1. Announce turn instruction ONCE per step (never repeats on every GPS movement)
  useEffect(() => {
    if (!isNavigatingInApp || !steps.length) {
      lastAnnouncedStepRef.current = -1;
      return;
    }

    const currentStep = steps[currentStepIndex];
    if (!currentStep) return;

    if (lastAnnouncedStepRef.current !== currentStepIndex) {
      lastAnnouncedStepRef.current = currentStepIndex;
      speak(currentStep.instruction);
    }
  }, [isNavigatingInApp, currentStepIndex, steps, speak]);

  // 2. Continuous real-time GPS distance countdown to turn junction and auto-advance
  useEffect(() => {
    if (!isNavigatingInApp || !steps.length) return;

    const currentStep = steps[currentStepIndex];
    if (!currentStep) return;

    const driverLat = liveCoords?.lat || driverProfile?.lastLatitude;
    const driverLng = liveCoords?.lng || driverProfile?.lastLongitude;
    if (driverLat && driverLng && currentStep.location) {
      const dLat = (driverLat - currentStep.location[0]) * 111320;
      const dLng = (driverLng - currentStep.location[1]) * 111320 * Math.cos((driverLat * Math.PI) / 180);
      const distToTurnMeters = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));

      // Update HUD banner countdown in real-time
      setLiveMetersToTurn(distToTurnMeters);

      // When driver is within 35m of the turn junction, auto-advance to next maneuver
      if (distToTurnMeters <= 35 && currentStepIndex < steps.length - 1) {
        setCurrentStepIndex((prev) => prev + 1);
      }
    }
  }, [isNavigatingInApp, currentStepIndex, steps, liveCoords?.lat, liveCoords?.lng, driverProfile?.lastLatitude, driverProfile?.lastLongitude]);









  // Approach A: Smart Default Navigation Launcher (Detects iOS, Android, or Desktop)
  const launchSmartNavigation = (provider?: "smart" | "google" | "waze" | "apple") => {
    if (!activeDelivery) return;

    // Determine current target destination (Pickup warehouse if not yet picked up, Dropoff if in transit)
    const isPickupTarget = activeDelivery.status === "ASSIGNED";
    const targetLat = isPickupTarget ? activeDelivery.pickupLatitude : activeDelivery.dropoffLatitude;
    const targetLng = isPickupTarget ? activeDelivery.pickupLongitude : activeDelivery.dropoffLongitude;
    const targetLabel = encodeURIComponent(isPickupTarget ? activeDelivery.pickupAddress : activeDelivery.dropoffAddress);

    // Device detection
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || "";
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const isAndroid = /android/i.test(userAgent);

    let chosen = provider || "smart";
    if (chosen === "smart") {
      chosen = isIOS ? "apple" : "google";
    }

    if (chosen === "waze") {
      // Waze deep link
      window.open(`https://waze.com/ul?ll=${targetLat},${targetLng}&navigate=yes`, "_blank");
      toast.success("Launching Waze Navigation...");
      return;
    }

    if (chosen === "apple") {
      // Apple Maps navigation intent (native on iOS, falls back gracefully)
      if (isIOS) {
        window.location.href = `maps://maps.apple.com/?daddr=${targetLat},${targetLng}&q=${targetLabel}&dirflg=d`;
      } else {
        window.open(`https://maps.apple.com/?daddr=${targetLat},${targetLng}&q=${targetLabel}&dirflg=d`, "_blank");
      }
      toast.success("Launching Apple Maps Navigation...");
      return;
    }

    // Google Maps navigation intent (Vehicle-aware: two-wheeler mode for bikes vs driving mode for cars/vans)
    const isBike = driverProfile?.vehicleType === "BIKE";
    const googleMode = isBike ? "l" : "d";
    const travelMode = isBike ? "two_wheeler" : "driving";

    if (isAndroid) {
      window.location.href = `google.navigation:q=${targetLat},${targetLng}&mode=${googleMode}`;
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}&travelmode=${travelMode}`, "_blank");
    }
    toast.success(`Launching Turn-by-Turn Navigation (${isBike ? "Motorbike" : "Car/Van"} Mode)...`);
  };

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

  // Tier 2 Enforced Telemetry: Automatically activate online state when assigned an active cargo delivery
  useEffect(() => {
    if (activeDelivery && !isOnline) {
      setIsOnline(true);
      submitStatusToggle(true);
    }
  }, [activeDelivery?.id]);

  // Automated Silent GPS Streaming Loop (Tier 2 Enforced Telemetry)
  useEffect(() => {
    const shouldTrack = isOnline || Boolean(activeDelivery);
    if (!shouldTrack) return;

    let watchId: number | null = null;
    let heartbeatInterval: any = null;

    const pushLocation = async (lat: number, lng: number) => {
      try {
        await driverApi.toggleOnlineStatus({
          isOnline: true,
          latitude: lat,
          longitude: lng,
        });
      } catch (err: any) {
        console.warn("[Telemetry] Silent background location push failed:", err.message);
      }
    };

    if (navigator.geolocation) {
      // Immediate initial GPS fix
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLiveCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          pushLocation(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.warn("[Telemetry] Initial GPS fix warning:", err.message);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );

      // 1. Live position watcher (emits on physical movement)
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setLiveCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          pushLocation(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.warn("[Telemetry] Geolocation watch warning:", err.message);
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
      );

      // 2. High-frequency 3-second heartbeat for continuous live navigation
      heartbeatInterval = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLiveCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            pushLocation(pos.coords.latitude, pos.coords.longitude);
          },
          (err) => {
            console.warn("[Telemetry] Heartbeat ping warning:", err.message);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }, 3000);
    }

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
    };
  }, [isOnline, activeDelivery?.id]);

  // Fetch unassigned available deliveries for online drivers
  const fetchAvailableJobs = async () => {
    try {
      setLoadingAvailable(true);
      const res = await deliveryApi.getAvailable();
      if (res.data?.status === "success" && Array.isArray(res.data?.data)) {
        setAvailableJobs(res.data.data);
      }
    } catch (error) {
      console.error("Failed to load available deliveries pool:", error);
    } finally {
      setLoadingAvailable(false);
    }
  };

  // Claim/Accept an available delivery job
  const handleClaimDelivery = async (deliveryId: string) => {
    setClaimingId(deliveryId);
    try {
      const res = await deliveryApi.claim(deliveryId);
      if (res.data?.status === "success") {
        toast.success("🎉 Delivery accepted! Loading route navigation...");
        if (driverProfile?.id) {
          await fetchDeliveries(driverProfile.id);
        }
        await fetchAvailableJobs();
      }
    } catch (error: any) {
      console.error("Failed to claim delivery:", error);
      toast.error(error.response?.data?.message || "Failed to accept delivery.");
    } finally {
      setClaimingId(null);
    }
  };

  // Poll available jobs when online and without active delivery
  useEffect(() => {
    if (isOnline && !activeDelivery) {
      fetchAvailableJobs();
      const interval = setInterval(fetchAvailableJobs, 6000);
      return () => clearInterval(interval);
    }
  }, [isOnline, activeDelivery]);

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
    if (activeDelivery && isOnline) {
      toast.error("Security Enforcement: You cannot go offline while assigned to an active delivery. Location is monitored by dispatch.");
      return;
    }
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
        <Icon icon="lucide:loader-2" className="animate-spin text-[32px]" />
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
            <Icon icon="solar:delivery-bold-duotone" className="text-[48px] text-primary mx-auto" />
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
              className="w-full bg-[#29a195] hover:bg-[#22877d] text-slate-950 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              type="submit"
            >
              {submittingProfile && <Icon icon="lucide:loader-2" className="animate-spin text-lg" />}
              <span>Save Profile</span>
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
          <Icon icon="solar:lock-password-unlocked-bold-duotone" className="text-[64px] text-amber-500 animate-pulse mx-auto" />
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
        <LogistelLogo
          size="md"
          title="Logistel Express"
          subtext="Driver Portal"
          titleClassName="text-primary"
        />

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 hover:bg-error/20 text-on-surface-variant hover:text-error transition-all py-1.5 px-3 rounded-lg text-xs font-semibold"
        >
          <Icon icon="solar:logout-2-bold" className="text-[16px]" />
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
                {activeDelivery
                  ? "On Active Cargo Dispatch (Telemetry Enforced)"
                  : isOnline
                    ? "Active & Online (Matching Routes)"
                    : "Off Duty / Offline"}
              </span>
            </div>
          </div>

          <button
            onClick={handleToggleOnline}
            disabled={togglingOnline || Boolean(activeDelivery)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeDelivery
              ? "bg-teal-500/20 text-teal-300 border border-teal-500/40 cursor-not-allowed"
              : isOnline
                ? "bg-error/15 border border-error/30 text-error hover:bg-error/30 cursor-pointer"
                : "bg-primary-container text-on-primary-container hover:brightness-110 shadow-lg shadow-primary/10 cursor-pointer"
              }`}
          >
            {togglingOnline ? (
              <Icon icon="lucide:loader-2" className="animate-spin text-[16px]" />
            ) : activeDelivery ? (
              <span className="flex items-center gap-1.5">
                <Icon icon="solar:lock-bold" className="text-xs" />
                <span>GPS Enforced</span>
              </span>
            ) : isOnline ? (
              "Go Offline"
            ) : (
              "Go Online"
            )}
          </button>
        </div>

        {/* Cargo Transit Telemetry Notice */}
        {activeDelivery && (
          <div className="bg-teal-950/40 border border-teal-500/30 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping shrink-0"></span>
              <div>
                <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wide flex items-center gap-1.5">
                  <Icon icon="solar:shield-check-bold" className="text-sm" />
                  Cargo Transit Security Telemetry Active
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Your device is automatically streaming real-time GPS telemetry to the admin dispatch radar. No manual broadcast needed.
                </p>
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end shrink-0 font-mono text-[10px]">
              <span className="text-teal-300 font-bold bg-teal-500/20 px-2 py-0.5 rounded border border-teal-500/30">
                10s AUTO-STREAM
              </span>
            </div>
          </div>
        )}

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
                className={`h-full rounded-full transition-all duration-500 ${fuelLevel <= 20 ? "bg-red-500 shadow-[0_0_10px_#EF4444]" : fuelLevel <= 50 ? "bg-amber-500" : "bg-emerald-500 shadow-[0_0_8px_#10B981]"
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
            <Icon icon="lucide:loader-2" className="animate-spin text-[24px]" />
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

              {/* Addresses details & Direct GPS Navigation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* 1. PICKUP WAREHOUSE */}
                <div className={`p-4 rounded-xl border transition-all ${activeDelivery.status === "ASSIGNED"
                  ? "bg-cyan-500/10 border-cyan-500/40 text-white shadow-lg shadow-cyan-500/5"
                  : "bg-slate-900/60 border-slate-800 text-slate-300"
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                      1. PICKUP WAREHOUSE
                    </span>
                    {activeDelivery.status === "ASSIGNED" && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse">
                        CURRENT TARGET
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-sm text-slate-100 mt-2">{activeDelivery.pickupAddress}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Contact: {activeDelivery.senderPhone || "Warehouse Dispatch"}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${activeDelivery.pickupLatitude},${activeDelivery.pickupLongitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center gap-1.5 shadow transition-all cursor-pointer"
                    >
                      <Icon icon="solar:routing-bold" className="text-sm" />
                      <span>GPS to Pickup</span>
                    </a>
                    {activeDelivery.senderPhone && (
                      <a
                        href={`tel:${activeDelivery.senderPhone}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all"
                      >
                        <Icon icon="solar:phone-calling-bold" className="text-xs text-emerald-400" />
                        <span>Call Pickup</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* 2. DROPOFF DESTINATION */}
                <div className={`p-4 rounded-xl border transition-all ${activeDelivery.status === "IN_TRANSIT" || activeDelivery.status === "PICKED_UP"
                  ? "bg-emerald-500/10 border-emerald-500/40 text-white shadow-lg shadow-emerald-500/5"
                  : "bg-slate-900/60 border-slate-800 text-slate-300"
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      2. DROPOFF DESTINATION
                    </span>
                    {(activeDelivery.status === "IN_TRANSIT" || activeDelivery.status === "PICKED_UP") && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                        CURRENT TARGET
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-sm text-slate-100 mt-2">{activeDelivery.dropoffAddress}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Recipient: {activeDelivery.recipientName} ({activeDelivery.recipientPhone})</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${activeDelivery.dropoffLatitude},${activeDelivery.dropoffLongitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 shadow transition-all cursor-pointer"
                    >
                      <Icon icon="solar:routing-bold" className="text-sm" />
                      <span>GPS to Dropoff</span>
                    </a>
                    {activeDelivery.recipientPhone && (
                      <a
                        href={`tel:${activeDelivery.recipientPhone}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all"
                      >
                        <Icon icon="solar:phone-calling-bold" className="text-xs text-emerald-400" />
                        <span>Call Recipient</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* ─── Custom In-App Turn-by-Turn Navigation Cockpit ─── */}
              <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-teal-950/40 border border-teal-500/30 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center gap-3.5 z-10">
                  <div className="w-12 h-12 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center justify-center text-2xl shadow-inner shrink-0">
                    <Icon icon={activeDelivery.status === "ASSIGNED" ? "solar:box-minimalistic-bold-duotone" : "solar:routing-2-bold-duotone"} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-widest font-extrabold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        {activeDelivery.status === "ASSIGNED" ? "Target: Pickup Hub" : "Target: Dropoff Client"}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {distanceKm ? `${distanceKm} km` : "Routing..."} • {durationRange ? `~${durationRange}` : durationMins ? `~${durationMins} mins` : "Calculating ETA..."}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-100 mt-1 truncate max-w-sm sm:max-w-md">
                      {activeDelivery.status === "ASSIGNED" ? activeDelivery.pickupAddress : activeDelivery.dropoffAddress}
                    </h3>
                  </div>
                </div>

                {/* Primary Action Button: Launch In-App Navigator */}
                <div className="flex items-center gap-2 z-10 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isNavigatingInApp) {
                        setCurrentStepIndex(0);
                        lastAnnouncedStepRef.current = -1;
                        setIsNavigatingInApp(true);
                      } else {
                        setIsNavigatingInApp(false);
                        setCurrentStepIndex(0);
                        setLiveMetersToTurn(null);
                      }
                    }}
                    className={`flex-1 sm:flex-initial px-5 py-3 rounded-xl font-extrabold text-xs shadow-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-95 ${isNavigatingInApp
                      ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20"
                      : "bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-400 hover:from-teal-400 hover:to-emerald-400 text-slate-950 shadow-teal-500/25"
                      }`}
                  >
                    <Icon icon={isNavigatingInApp ? "solar:close-circle-bold" : "solar:compass-bold"} className="text-lg" />
                    <span>{isNavigatingInApp ? "Exit Navigator HUD" : "Start In-App Navigation"}</span>
                  </button>

                  {/* Secondary Emergency Fallback to External Maps */}
                  <button
                    type="button"
                    onClick={() => launchSmartNavigation("smart")}
                    title="Emergency Backup: Open Google/Apple Maps"
                    className="px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Icon icon="solar:map-point-wave-bold" className="text-base text-cyan-400" />
                    <span className="hidden sm:inline">External Maps</span>
                  </button>
                </div>
              </div>

              {/* ─── LIVE MAP WITH IN-APP TURN-BY-TURN HUD ─── */}
              <div className={`rounded-xl overflow-hidden border border-white/10 relative z-0 shadow-lg transition-all ${isNavigatingInApp ? "h-[450px] ring-2 ring-teal-500/40" : "h-[300px]"
                }`}>
                {/* IN-APP TURN MANEUVER BANNER (When Navigating) */}
                {isNavigatingInApp && steps.length > 0 && steps[currentStepIndex] && (
                  <div className="absolute top-3 left-3 right-3 z-[1000] bg-slate-950/95 backdrop-blur-md border border-teal-500/50 rounded-xl p-3.5 shadow-2xl flex items-center justify-between gap-3 text-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-teal-500 text-slate-950 flex items-center justify-center text-xl shrink-0 font-extrabold shadow">
                        {steps[currentStepIndex].modifier?.includes("left") ? (
                          <Icon icon="solar:round-arrow-left-bold" />
                        ) : steps[currentStepIndex].modifier?.includes("right") ? (
                          <Icon icon="solar:round-arrow-right-bold" />
                        ) : steps[currentStepIndex].maneuverType === "arrive" ? (
                          <Icon icon="solar:flag-2-bold" />
                        ) : (
                          <Icon icon="solar:round-arrow-up-bold" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-mono font-bold text-teal-300 bg-teal-500/20 px-2 py-0.5 rounded border border-teal-500/30">
                            In {liveMetersToTurn !== null ? `${liveMetersToTurn}m` : steps[currentStepIndex].distanceMeters > 0 ? `${steps[currentStepIndex].distanceMeters}m` : "Ahead"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Turn {currentStepIndex + 1} of {steps.length}
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">
                            🏁 Trip Total: {distanceKm ? `${distanceKm} km` : "6 km"} • {durationRange ? `~${durationRange}` : durationMins ? `~${durationMins} mins` : "14 mins"}
                          </span>
                        </div>
                        <p className="font-bold text-xs sm:text-sm text-white truncate mt-0.5">
                          {steps[currentStepIndex].instruction}
                        </p>
                      </div>
                    </div>

                    {/* Audio Mute & Exit Navigation Controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={toggleMute}
                        title={isMuted ? "Unmute Voice Guidance" : "Mute Voice Guidance"}
                        className={`p-2 rounded-lg border transition-all cursor-pointer ${isMuted
                          ? "bg-red-500/20 text-red-400 border-red-500/30"
                          : "bg-teal-500/20 text-teal-300 border-teal-500/30"
                          }`}
                      >
                        <Icon icon={isMuted ? "solar:volume-cross-bold" : "solar:volume-loud-bold"} className="text-base" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsNavigatingInApp(false);
                          setCurrentStepIndex(0);
                          setLiveMetersToTurn(null);
                        }}
                        title="Close Navigator HUD"
                        className="p-2 rounded-lg bg-slate-800/80 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/30 text-xs transition-all cursor-pointer"
                      >
                        <Icon icon="solar:close-circle-bold" className="text-sm" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Satellite / Street Map Toggle & Wake Lock Badge */}
                <div className="absolute bottom-3 right-3 z-[1000] flex items-center gap-2">
                  {isWakeLocked && (
                    <span className="bg-slate-950/80 backdrop-blur-md border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 shadow">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Screen Awake
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setMapLayerType((t) => (t === "streets" ? "satellite" : "streets"))}
                    className="bg-slate-950/85 backdrop-blur-md border border-white/20 hover:border-teal-400 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1.5 cursor-pointer"
                  >
                    <Icon icon={mapLayerType === "streets" ? "solar:satellite-bold" : "solar:map-bold"} className="text-sm text-teal-400" />
                    <span>{mapLayerType === "streets" ? "Satellite" : "Street Map"}</span>
                  </button>
                </div>

                <MapContainer
                  center={[
                    (activeDelivery.pickupLatitude + activeDelivery.dropoffLatitude) / 2,
                    (activeDelivery.pickupLongitude + activeDelivery.dropoffLongitude) / 2,
                  ]}
                  zoom={13}
                  style={{ height: "100%", width: "100%" }}
                  zoomControl={false}
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url={
                      mapLayerType === "satellite"
                        ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    }
                  />

                  {/* Auto-Camera Follow Driver when In-App Nav is Active */}
                  <MapRecenter
                    lat={liveCoords?.lat || driverProfile?.lastLatitude || activeDelivery.pickupLatitude}
                    lng={liveCoords?.lng || driverProfile?.lastLongitude || activeDelivery.pickupLongitude}
                    isNavigating={isNavigatingInApp}
                  />

                  {/* Pickup Pin */}
                  <Marker position={[activeDelivery.pickupLatitude, activeDelivery.pickupLongitude]} icon={pickupIcon}>
                    <Popup><div className="text-black text-xs font-bold">1. Pickup: {activeDelivery.pickupAddress}</div></Popup>
                  </Marker>

                  {/* Dropoff Pin */}
                  <Marker position={[activeDelivery.dropoffLatitude, activeDelivery.dropoffLongitude]} icon={dropoffIcon}>
                    <Popup><div className="text-black text-xs font-bold">2. Dropoff: {activeDelivery.dropoffAddress}</div></Popup>
                  </Marker>

                  {/* Driver Pin (Glides dynamically with Live GPS) */}
                  <Marker
                    position={[
                      liveCoords?.lat || driverProfile?.lastLatitude || activeDelivery.pickupLatitude,
                      liveCoords?.lng || driverProfile?.lastLongitude || activeDelivery.pickupLongitude,
                    ]}
                    icon={driverIcon}
                  >
                    <Popup><div className="text-black text-xs font-bold text-red-600">Your Live GPS Location</div></Popup>
                  </Marker>

                  {/* OSRM Real-Road Route Polyline */}
                  {routeCoords.length > 1 ? (
                    <Polyline
                      positions={routeCoords}
                      color="#00F2FE"
                      weight={5}
                      opacity={0.9}
                    />
                  ) : (
                    <Polyline
                      positions={[
                        [activeDelivery.pickupLatitude, activeDelivery.pickupLongitude],
                        [activeDelivery.dropoffLatitude, activeDelivery.dropoffLongitude],
                      ]}
                      color="#00F2FE"
                      weight={3}
                      dashArray="5, 10"
                      opacity={0.5}
                    />
                  )}
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
                    {updatingStatus && <Icon icon="lucide:loader-2" className="animate-spin text-[16px]" />}
                    Confirm Package Pickup
                  </button>
                )}

                {activeDelivery.status === "PICKED_UP" && (
                  <button
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange("IN_TRANSIT")}
                    className="w-full bg-[#0D9488] hover:bg-[#0F766E] text-white font-headline-md py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold"
                  >
                    {updatingStatus && <Icon icon="lucide:loader-2" className="animate-spin text-[16px]" />}
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
                      {updatingStatus && <Icon icon="lucide:loader-2" className="animate-spin text-[16px]" />}
                      Submit OTP & Complete Delivery
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : isOnline ? (
          /* ONLINE: SHOW AVAILABLE DELIVERIES OR RADAR */
          availableJobs.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                  <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
                    <span>Available Dispatches Near You</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                      {availableJobs.length} Ready
                    </span>
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={fetchAvailableJobs}
                  disabled={loadingAvailable}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Icon icon="solar:restart-bold" className={`text-sm ${loadingAvailable ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {availableJobs.map((job) => (
                  <div
                    key={job.id}
                    className="glass-panel border-white/10 hover:border-teal-500/50 p-5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-teal-950/20 shadow-xl transition-all space-y-4 relative overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                          Order #{job.id.slice(0, 8)}
                        </span>
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                          Ready for Pickup
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">
                        Recipient: <strong className="text-slate-200">{job.recipientName}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* Pickup */}
                      <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 space-y-1">
                        <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-cyan-400" />
                          Pickup Hub
                        </span>
                        <p className="font-semibold text-slate-200 truncate">{job.pickupAddress}</p>
                        {job.senderPhone && (
                          <p className="text-[11px] text-slate-400">Sender Contact: {job.senderPhone}</p>
                        )}
                      </div>

                      {/* Dropoff */}
                      <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 space-y-1">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          Dropoff Destination
                        </span>
                        <p className="font-semibold text-slate-200 truncate">{job.dropoffAddress}</p>
                        <p className="text-[11px] text-slate-400">Recipient Phone: {job.recipientPhone}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        <Icon icon="solar:box-minimalistic-bold" className="text-teal-400 text-sm" />
                        <span>Instant Dispatch Task</span>
                      </div>

                      <button
                        type="button"
                        disabled={claimingId === job.id}
                        onClick={() => handleClaimDelivery(job.id)}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-teal-500/25 flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        {claimingId === job.id ? (
                          <>
                            <Icon icon="lucide:loader-2" className="animate-spin text-sm" />
                            <span>Accepting Job...</span>
                          </>
                        ) : (
                          <>
                            <Icon icon="solar:check-circle-bold" className="text-base" />
                            <span>Accept Delivery ⚡</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* NO AVAILABLE DELIVERIES IN QUEUE - RADAR SCANNING */
            <div className="glass-panel border-white/5 p-10 text-center rounded-2xl space-y-4 bg-slate-900/40">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-teal-500/30 animate-ping" />
                <div className="w-12 h-12 rounded-full bg-teal-500/10 border border-teal-500/40 flex items-center justify-center text-teal-400 text-2xl shadow-inner">
                  <Icon icon="solar:radar-2-bold" className="animate-spin" style={{ animationDuration: "4s" }} />
                </div>
              </div>
              <div className="space-y-1">
                <h2 className="font-headline-md text-headline-md text-on-surface">Radar Active: Scanning for Orders</h2>
                <p className="text-xs text-on-surface-variant max-w-[360px] mx-auto">
                  You are live in the dispatch queue. When customers place new delivery orders, they will appear here instantly for you to accept.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchAvailableJobs}
                disabled={loadingAvailable}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 border border-white/10 inline-flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Icon icon="solar:restart-bold" className={`text-sm ${loadingAvailable ? "animate-spin" : ""}`} />
                <span>Refresh Dispatch Radar</span>
              </button>
            </div>
          )
        ) : (
          /* OFFLINE VIEW */
          <div className="glass-panel border-white/5 p-12 text-center rounded-2xl space-y-4">
            <Icon icon="solar:shield-warning-bold-duotone" className="text-[48px] text-amber-400/60 mx-auto" />
            <div className="space-y-1">
              <h2 className="font-headline-md text-headline-md text-on-surface">You are Currently Offline</h2>
              <p className="text-xs text-on-surface-variant max-w-[340px] mx-auto">
                Toggle the switch above to <strong>"Go Online"</strong> to connect to the fleet radar and start receiving cargo deliveries.
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleOnline}
              disabled={togglingOnline}
              className="px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <Icon icon="solar:power-bold" className="text-sm" />
              <span>Go Online Now</span>
            </button>
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
                    <Icon icon="solar:pen-bold" className="text-primary text-[20px]" />
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
                  <Icon icon="solar:close-circle-bold" className="text-[20px]" />
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
                        <Icon icon="solar:close-circle-bold" className="text-[12px]" />
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
                        <Icon icon="lucide:loader-2" className="animate-spin text-[16px]" />
                        Uploading POD to Cloud...
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:verified-check-bold" className="text-[16px]" />
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

