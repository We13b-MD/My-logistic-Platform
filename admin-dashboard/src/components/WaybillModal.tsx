import React, { useState } from "react";
import { Delivery } from "@/types";
import { Icon } from "@iconify/react";

interface WaybillModalProps {
  delivery: Delivery | null;
  companyName?: string;
  subdomain?: string;
  onClose: () => void;
}

export const WaybillModal: React.FC<WaybillModalProps> = ({
  delivery,
  companyName = "Logistel Fleet",
  subdomain = "app",
  onClose,
}) => {
  const [format, setFormat] = useState<"a4" | "thermal">("a4");

  if (!delivery) return null;

  const trackingRef = delivery.id.toUpperCase();
  const trackingUrl = `${window.location.origin}/track/${delivery.id}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    trackingUrl
  )}&margin=4`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      {/* Modal Container */}
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto print:border-none print:shadow-none print:w-full print:max-w-none print:rounded-none">
        
        {/* Screen Controls Header (Hidden on Print) */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Icon icon="solar:document-text-bold-duotone" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">Print Waybill & Shipping Label</h3>
              <p className="text-xs text-slate-400">Official consignment voucher • Waybill #{delivery.id.slice(0, 8)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Format Toggle */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setFormat("a4")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  format === "a4" ? "bg-cyan-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                A4 Consignment
              </button>
              <button
                type="button"
                onClick={() => setFormat("thermal")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  format === "thermal" ? "bg-cyan-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                4x6 Thermal Label
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
            >
              <Icon icon="solar:printer-bold" className="w-4 h-4" />
              Print / Save PDF
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

        {/* Printable Area */}
        <div id="printable-waybill-content" className="p-6 md:p-8 bg-white text-slate-900 print:p-4">
          
          {format === "a4" ? (
            /* ==================== A4 FORMAL CONSIGNMENT NOTE ==================== */
            <div className="border-2 border-slate-900 rounded-xl p-6 text-slate-900 max-w-3xl mx-auto space-y-6 print:border-2 print:border-black">
              {/* Header */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
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
                        {subdomain}.logistel.com • Enterprise Logistics Dispatch
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 inline-block bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-1 rounded text-xs font-mono font-bold">
                    WAYBILL CONSIGNMENT NOTE
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <img
                    src={qrCodeUrl}
                    alt="Tracking QR Code"
                    className="w-20 h-20 border border-slate-300 p-1 rounded bg-white"
                  />
                  <p className="text-[10px] text-slate-500 font-mono mt-1">Scan for Live GPS Tracking</p>
                  <p className="text-xs font-mono font-bold text-slate-900 mt-0.5">#{trackingRef.slice(0, 16)}</p>
                </div>
              </div>

              {/* Waybill Metadata Grid */}
              <div className="grid grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Date Issued</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(delivery.createdAt).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Dispatch Status</span>
                  <span className="font-bold text-cyan-700 uppercase">{delivery.status}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Vehicle Mode</span>
                  <span className="font-semibold text-slate-800">
                    {delivery.driver?.vehicleType || "STANDARD COURIER"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Calculated Fare</span>
                  <span className="font-black text-slate-900 text-sm">
                    ₦{Math.round(delivery.estimatedPrice || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Two Column: Sender vs Recipient */}
              <div className="grid grid-cols-2 gap-4">
                {/* Sender Card */}
                <div className="border border-slate-300 rounded-lg p-4 bg-slate-50/50">
                  <div className="flex items-center gap-2 mb-2 pb-1 border-b border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                      Origin / Sender
                    </h4>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Sender Phone:</span>
                      <span className="font-semibold text-slate-900">{delivery.senderPhone}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Pickup Address:</span>
                      <p className="font-medium text-slate-800 leading-snug">{delivery.pickupAddress}</p>
                    </div>
                  </div>
                </div>

                {/* Recipient Card */}
                <div className="border border-slate-300 rounded-lg p-4 bg-slate-50/50">
                  <div className="flex items-center gap-2 mb-2 pb-1 border-b border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                      Destination / Receiver
                    </h4>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Recipient Name:</span>
                      <span className="font-bold text-slate-900">{delivery.recipientName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Phone Number:</span>
                      <span className="font-semibold text-slate-900">{delivery.recipientPhone}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Dropoff Address:</span>
                      <p className="font-medium text-slate-800 leading-snug">{delivery.dropoffAddress}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security & Transit Handshake Notice */}
              <div className="border border-amber-300 bg-amber-50/60 rounded-lg p-3 flex items-start gap-3">
                <div className="p-1 rounded bg-amber-100 text-amber-800 font-bold text-xs mt-0.5">
                  🔐 SECURITY OTP
                </div>
                <div className="text-xs text-amber-950">
                  <p className="font-semibold">Cryptographic OTP Verification Handshake Required</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    This parcel cannot be released until the recipient inspects package seal integrity and presents the 6-digit confidential delivery OTP code directly to the carrier.
                  </p>
                </div>
              </div>

              {/* Tri-Party Chain of Custody Signatures */}
              <div className="border-t-2 border-slate-900 pt-4">
                <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">
                  Chain of Custody & Legal Proof of Dispatch
                </h5>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div className="border border-slate-300 rounded p-2.5 bg-slate-50 text-center">
                    <div className="h-10 border-b border-dashed border-slate-300 mb-1"></div>
                    <span className="text-[10px] font-bold text-slate-700 block">Dispatcher Signature</span>
                    <span className="text-[9px] text-slate-400">Package Sealed & Dispatched</span>
                  </div>
                  <div className="border border-slate-300 rounded p-2.5 bg-slate-50 text-center">
                    <div className="h-10 border-b border-dashed border-slate-300 mb-1"></div>
                    <span className="text-[10px] font-bold text-slate-700 block">Carrier / Rider Signature</span>
                    <span className="text-[9px] text-slate-400">Accepted Goods in Transit</span>
                  </div>
                  <div className="border border-slate-300 rounded p-2.5 bg-slate-50 text-center">
                    <div className="h-10 border-b border-dashed border-slate-300 mb-1"></div>
                    <span className="text-[10px] font-bold text-slate-700 block">Recipient Signature</span>
                    <span className="text-[9px] text-slate-400">Received Sealed & In Good Condition</span>
                  </div>
                </div>
              </div>

              {/* Footer Terms */}
              <div className="text-[9px] text-slate-400 text-center pt-2 border-t border-slate-200">
                Logistel Platform Enterprise Waybill • Standard Conditions of Carriage Apply • System Verified
              </div>
            </div>
          ) : (
            /* ==================== 4x6 COMPACT THERMAL LABEL ==================== */
            <div className="border-2 border-slate-950 rounded-lg p-4 text-slate-950 max-w-sm mx-auto font-sans print:border-2 print:border-black">
              {/* Thermal Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-950 pb-2 mb-3">
                <div>
                  <h2 className="text-base font-black tracking-tight uppercase leading-none">{companyName}</h2>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-slate-600">EXPRESS DISPATCH</span>
                </div>
                <span className="text-xs font-mono font-black border border-black px-1.5 py-0.5 rounded">
                  {delivery.driver?.vehicleType || "BIKE"}
                </span>
              </div>

              {/* Barcode / Tracking Box */}
              <div className="text-center py-2 border-b-2 border-slate-950 bg-slate-50 my-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tracking Number</p>
                <p className="text-lg font-mono font-black tracking-widest text-slate-900 mt-0.5">
                  {trackingRef.slice(0, 18)}
                </p>
                <img
                  src={qrCodeUrl}
                  alt="QR Code"
                  className="w-24 h-24 mx-auto mt-2 border border-black p-1 bg-white"
                />
              </div>

              {/* Ship To Section */}
              <div className="py-2 border-b-2 border-slate-950">
                <span className="text-[10px] font-black uppercase text-slate-500 block">SHIP TO (RECIPIENT):</span>
                <p className="text-sm font-black text-slate-900 mt-0.5">{delivery.recipientName}</p>
                <p className="text-xs font-bold text-slate-800">{delivery.recipientPhone}</p>
                <p className="text-xs font-medium text-slate-700 mt-1 leading-snug">{delivery.dropoffAddress}</p>
              </div>

              {/* From Section */}
              <div className="py-2 border-b-2 border-slate-950 text-xs">
                <span className="text-[10px] font-black uppercase text-slate-500 block">FROM (ORIGIN):</span>
                <p className="font-bold text-slate-800">{delivery.senderPhone}</p>
                <p className="text-[11px] text-slate-600 line-clamp-2">{delivery.pickupAddress}</p>
              </div>

              {/* Thermal Footer */}
              <div className="pt-2 flex items-center justify-between text-[10px] font-mono">
                <span>EST: ₦{Math.round(delivery.estimatedPrice || 0).toLocaleString()}</span>
                <span className="font-bold bg-black text-white px-1.5 py-0.5 rounded">OTP REQUIRED</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
