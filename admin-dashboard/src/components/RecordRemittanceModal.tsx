import React, { useState } from "react";
import { DriverProfile } from "@/types";
import { driverApi } from "@/api/driver.api";
import { toast } from "sonner";
import { Icon } from "@iconify/react";

interface RecordRemittanceModalProps {
  drivers: DriverProfile[];
  defaultDriverId?: string | null;
  onSuccess: () => void;
  onClose: () => void;
}

export const RecordRemittanceModal: React.FC<RecordRemittanceModalProps> = ({
  drivers,
  defaultDriverId,
  onSuccess,
  onClose,
}) => {
  const [driverId, setDriverId] = useState<string>(
    defaultDriverId || (drivers.length > 0 ? drivers[0].id : "")
  );
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!driverId) {
      toast.error("Please select a driver");
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid remittance amount greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      await driverApi.recordRemittance(driverId, {
        amount: numAmount,
        paymentMethod,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Cash remittance recorded successfully!");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to record remittance");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Icon icon="solar:wallet-money-bold-duotone" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">Record Driver Remittance</h3>
              <p className="text-xs text-slate-400">Cash / POS settlement & cashier ledger</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <Icon icon="solar:close-circle-bold" className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Select Driver / Carrier <span className="text-rose-500">*</span>
            </label>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.user?.email || d.id.substring(0, 8)} ({d.vehicleType})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Remitted Amount (₦) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">₦</span>
              <input
                type="number"
                step="any"
                min="1"
                placeholder="e.g. 25000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3.5 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Payment Method <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "CASH", label: "Cash Handover", icon: "solar:wad-of-money-bold" },
                { id: "BANK_TRANSFER", label: "Bank Transfer", icon: "solar:card-transfer-bold" },
                { id: "POS", label: "Office POS", icon: "solar:card-bold" },
              ].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    paymentMethod === m.id
                      ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-400 font-semibold"
                      : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Icon icon={m.icon} className="w-4 h-4 mb-1" />
                  <span className="text-[11px]">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Transaction Ref / Receipt # <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. GTB-TRF-9821 or POS Slip #44"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Dispatcher / Cashier Notes <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Reconciled full evening run balance."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Icon icon="solar:restart-bold" className="w-4 h-4 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Icon icon="solar:check-circle-bold" className="w-4 h-4" />
                  Confirm Remittance
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
