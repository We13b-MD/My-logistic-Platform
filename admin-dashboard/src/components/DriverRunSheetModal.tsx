import React, { useState, useMemo } from "react";
import { Delivery, DriverProfile } from "@/types";
import { Icon } from "@iconify/react";

interface DriverRunSheetModalProps {
  drivers: DriverProfile[];
  deliveries: Delivery[];
  selectedDriverId?: string | null;
  companyName?: string;
  subdomain?: string;
  onClose: () => void;
}

export const DriverRunSheetModal: React.FC<DriverRunSheetModalProps> = ({
  drivers,
  deliveries,
  selectedDriverId,
  companyName = "Logistel Fleet",
  subdomain = "app",
  onClose,
}) => {
  const [activeDriverId, setActiveDriverId] = useState<string>(
    selectedDriverId || (drivers.length > 0 ? drivers[0].id : "")
  );
  const [runDate, setRunDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Find active driver profile
  const currentDriver = useMemo(() => {
    return drivers.find((d) => d.id === activeDriverId) || null;
  }, [drivers, activeDriverId]);

  // Filter deliveries assigned to this driver
  const driverDeliveries = useMemo(() => {
    if (!activeDriverId) return [];
    return deliveries.filter((d) => d.driverId === activeDriverId);
  }, [deliveries, activeDriverId]);

  // Calculations
  const totalStops = driverDeliveries.length;
  const completedStops = driverDeliveries.filter((d) => d.status === "DELIVERED").length;
  const totalValue = driverDeliveries.reduce((sum, d) => sum + (d.estimatedPrice || 0), 0);
  const totalKm = driverDeliveries.reduce((sum, d) => sum + (d.distanceKm || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto print:border-none print:shadow-none print:w-full print:max-w-none print:rounded-none">
        
        {/* Screen Controls Header (Hidden on Print) */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-slate-900 text-white border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Icon icon="solar:clipboard-list-bold-duotone" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">Daily Driver Run Sheet & Manifest</h3>
              <p className="text-xs text-slate-400">Formal dispatch trip manifest and parcel custody voucher</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Driver Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Driver:</label>
              <select
                value={activeDriverId}
                onChange={(e) => setActiveDriverId(e.target.value)}
                className="bg-slate-800 text-white border border-slate-700 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.user?.email || d.id.substring(0, 8)} ({d.vehicleType})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Date:</label>
              <input
                type="date"
                value={runDate}
                onChange={(e) => setRunDate(e.target.value)}
                className="bg-slate-800 text-white border border-slate-700 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
            >
              <Icon icon="solar:printer-bold" className="w-4 h-4" />
              Print Manifest
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <Icon icon="solar:close-circle-bold" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Run Sheet Content */}
        <div id="printable-runsheet-content" className="p-6 md:p-8 bg-white text-slate-900 print:p-4 font-sans">
          
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-sm">
                  L
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                    {companyName}
                  </h1>
                  <p className="text-[11px] font-semibold text-slate-500">
                    {subdomain}.logistel.com • Enterprise Fleet Operations
                  </p>
                </div>
              </div>
              <div className="mt-2 inline-block bg-slate-900 text-white px-2.5 py-0.5 rounded text-[11px] font-mono font-bold tracking-wider">
                DAILY DISPATCH RUN SHEET & DELIVERY MANIFEST
              </div>
            </div>

            <div className="text-right text-xs">
              <p className="text-[10px] uppercase font-bold text-slate-400">Run Manifest Date</p>
              <p className="font-bold text-slate-900 text-sm">
                {new Date(runDate).toLocaleDateString("en-US", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                Printed: {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>

          {/* Driver & Run Metadata Bar */}
          <div className="grid grid-cols-4 gap-3 bg-slate-50 border border-slate-200 p-3 rounded-lg text-xs mb-5">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Carrier</span>
              <span className="font-bold text-slate-900">{currentDriver?.user?.email || "Unassigned"}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Vehicle Asset</span>
              <span className="font-semibold text-slate-800">
                {currentDriver?.vehicleType || "STANDARD"} • Lic: {currentDriver?.licenseNumber || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Stops & Route</span>
              <span className="font-bold text-slate-900">
                {totalStops} Parcels ({completedStops} Done) • {totalKm.toFixed(1)} km
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Manifest Fare Value</span>
              <span className="font-black text-slate-900 text-sm">₦{Math.round(totalValue).toLocaleString()}</span>
            </div>
          </div>

          {/* Deliveries Sequence Table */}
          {driverDeliveries.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl my-4">
              <Icon icon="solar:box-minimalistic-broken" className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-600">No deliveries currently assigned to this driver.</p>
              <p className="text-xs text-slate-400 mt-1">Assign deliveries to this carrier to populate their daily run sheet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-300 rounded-lg mb-6">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Tracking ID</th>
                    <th className="py-2.5 px-3">Recipient & Contact</th>
                    <th className="py-2.5 px-3">Dropoff Destination</th>
                    <th className="py-2.5 px-3 text-right">Fare</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center w-32">Recipient Sign / OTP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {driverDeliveries.map((delivery, index) => (
                    <tr key={delivery.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-500">{index + 1}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                        {delivery.id.slice(0, 8)}...
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-900 block">{delivery.recipientName}</span>
                        <span className="text-[11px] text-slate-500 font-mono">{delivery.recipientPhone}</span>
                      </td>
                      <td className="py-2.5 px-3 max-w-xs">
                        <p className="font-medium text-slate-800 line-clamp-2 leading-snug">
                          {delivery.dropoffAddress}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        ₦{Math.round(delivery.estimatedPrice || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            delivery.status === "DELIVERED"
                              ? "bg-emerald-100 text-emerald-800"
                              : delivery.status === "IN_TRANSIT"
                              ? "bg-cyan-100 text-cyan-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {delivery.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="h-7 border border-dashed border-slate-300 rounded bg-slate-50/50 flex items-center justify-center text-[9px] text-slate-400">
                          {delivery.status === "DELIVERED" ? "✓ Verified" : "Sign / Stamp"}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Morning Handover & Evening Reconciliation Custody Sign-Off */}
          <div className="grid grid-cols-2 gap-5 border-2 border-slate-900 rounded-xl p-4 bg-slate-50/60 text-xs">
            {/* Morning Depot Departure Handover */}
            <div className="border-r border-slate-300 pr-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <h4 className="font-black uppercase text-slate-800 text-[11px] tracking-wider">
                  Morning Depot Handover (Departure)
                </h4>
              </div>
              <p className="text-[10px] text-slate-600 leading-normal mb-4">
                I, <strong>{currentDriver?.user?.email || "the assigned carrier"}</strong>, acknowledge receipt of{" "}
                <strong>{totalStops} parcels</strong> in sealed and undamaged condition for transport.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-3">
                <div className="border-b border-dashed border-slate-400 pb-1 text-center">
                  <span className="text-[9px] text-slate-400 block">Driver Signature</span>
                </div>
                <div className="border-b border-dashed border-slate-400 pb-1 text-center">
                  <span className="text-[9px] text-slate-400 block">Departure Time & Dispatcher Sign</span>
                </div>
              </div>
            </div>

            {/* Evening Hub Return & Reconciliation */}
            <div className="pl-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                <h4 className="font-black uppercase text-slate-800 text-[11px] tracking-wider">
                  Evening Hub Reconciliation (Close Shift)
                </h4>
              </div>
              <p className="text-[10px] text-slate-600 leading-normal mb-4">
                Total delivered: ______ | Returned to Depot: ______ | Cash Collected: ₦______ remitted.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-3">
                <div className="border-b border-dashed border-slate-400 pb-1 text-center">
                  <span className="text-[9px] text-slate-400 block">Supervisor Signature</span>
                </div>
                <div className="border-b border-dashed border-slate-400 pb-1 text-center">
                  <span className="text-[9px] text-slate-400 block">Reconciliation Timestamp</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Notes */}
          <div className="mt-4 text-[9px] text-slate-400 text-center">
            Logistel Platform • Formal Delivery Run Sheet • All assigned items must be returned or verified by OTP upon shift completion.
          </div>
        </div>

      </div>
    </div>
  );
};
