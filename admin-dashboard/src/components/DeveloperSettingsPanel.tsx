import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import { developerApi, getPublicApiBaseUrl, ApiKeySummary, CreatedApiKey } from "@/api/developer.api";

/**
 * Developer API settings (TENANT_SUPER_ADMIN only).
 * Lets the company owner issue API keys to merchants / their own store,
 * configure webhooks, and see a quick-start guide.
 *
 * Secrets (raw key + webhook secret) are displayed exactly once after creation
 * and are never retrievable again — the backend only stores a hash of the key.
 */

function errMsg(err: any, fallback: string) {
  return err?.response?.data?.message || fallback;
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Could not copy. Please select and copy manually.");
        }
      }}
      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/70 text-[11px] font-bold text-slate-200 hover:border-teal-500/50 hover:text-teal-300 transition-all cursor-pointer"
    >
      <Icon icon={copied ? "solar:check-circle-bold" : "solar:copy-bold-duotone"} className={copied ? "text-emerald-400" : ""} />
      {copied ? "Copied" : label}
    </button>
  );
}

function SecretRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2">
        <code className="flex-grow font-mono text-xs text-amber-200 break-all select-all">{value}</code>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative group">
      <pre className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 pr-20 text-[11px] leading-relaxed font-mono text-slate-300 overflow-x-auto whitespace-pre">
        {code}
      </pre>
      <div className="absolute top-2 right-2">
        <CopyButton value={code} />
      </div>
    </div>
  );
}

export function DeveloperSettingsPanel() {
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<CreatedApiKey | null>(null);

  // Row actions
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [showRevoked, setShowRevoked] = useState(false);
  const [docsTab, setDocsTab] = useState<"create" | "track" | "webhook">("create");

  const publicBaseUrl = getPublicApiBaseUrl();

  const loadKeys = async () => {
    try {
      const res = await developerApi.listKeys();
      setKeys(res.data.data);
    } catch (err) {
      toast.error(errMsg(err, "Failed to load API keys"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Give the key a name, e.g. \"Online Store\"");
      return;
    }
    setCreating(true);
    try {
      const res = await developerApi.createKey({ name: name.trim(), webhookUrl: webhookUrl.trim() || undefined });
      setRevealed(res.data.data);
      setName("");
      setWebhookUrl("");
      toast.success("API key created. Copy it now.");
      loadKeys();
    } catch (err) {
      toast.error(errMsg(err, "Failed to create API key"));
    } finally {
      setCreating(false);
    }
  };

  const handleSaveWebhook = async (id: string) => {
    setBusyId(id);
    try {
      await developerApi.updateWebhook(id, editUrl.trim() || null);
      toast.success(editUrl.trim() ? "Webhook URL saved" : "Webhook removed");
      setEditingId(null);
      loadKeys();
    } catch (err) {
      toast.error(errMsg(err, "Failed to update webhook"));
    } finally {
      setBusyId(null);
    }
  };

  const handleTest = async (id: string) => {
    setBusyId(id);
    try {
      const res = await developerApi.testWebhook(id);
      if (res.data.status === "success") toast.success(res.data.message);
      else toast.error(res.data.message);
    } catch (err) {
      toast.error(errMsg(err, "Failed to send test webhook"));
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async (id: string) => {
    setBusyId(id);
    try {
      const res = await developerApi.revokeKey(id);
      toast.success(res.data.message);
      setConfirmRevokeId(null);
      loadKeys();
    } catch (err) {
      toast.error(errMsg(err, "Failed to revoke key"));
    } finally {
      setBusyId(null);
    }
  };

  const activeKeys = keys.filter((k) => !k.revokedAt);
  const revokedKeys = keys.filter((k) => k.revokedAt);
  const totalApiShipments = keys.reduce((sum, k) => sum + (k._count?.deliveries ?? 0), 0);

  const createExample = `curl -X POST ${publicBaseUrl}/shipments \\
  -H "X-API-Key: lgs_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "reference": "ORDER-1042",
    "vehicleType": "BIKE",
    "pickup":  { "address": "12 Admiralty Way, Lekki, Lagos", "latitude": 6.4474, "longitude": 3.4723, "phone": "+2348012345678" },
    "dropoff": { "address": "5 Allen Avenue, Ikeja, Lagos",   "latitude": 6.6018, "longitude": 3.3515 },
    "recipient": { "name": "Ada Obi", "phone": "+2348098765432", "email": "ada@example.com" }
  }'

# Response includes "recipientOtp" ONCE — send it to your customer by SMS/WhatsApp.
# Re-sending the same "reference" never creates a duplicate (safe to retry on bad network).`;

  const trackExample = `# Get one shipment (status + live driver location)
curl ${publicBaseUrl}/shipments/SHIPMENT_ID \\
  -H "X-API-Key: lgs_live_YOUR_KEY"

# Get a price before booking
curl -X POST ${publicBaseUrl}/quotes \\
  -H "X-API-Key: lgs_live_YOUR_KEY" -H "Content-Type: application/json" \\
  -d '{ "vehicleType": "BIKE", "pickup": { "latitude": 6.4474, "longitude": 3.4723 }, "dropoff": { "latitude": 6.6018, "longitude": 3.3515 } }'

# Cancel (only before pickup)
curl -X POST ${publicBaseUrl}/shipments/SHIPMENT_ID/cancel -H "X-API-Key: lgs_live_YOUR_KEY"`;

  const webhookExample = `// Node.js / Express — verify that a webhook really came from Logistel
const crypto = require("crypto");

app.post("/logistel-webhook", express.raw({ type: "application/json" }), (req, res) => {
  const header = req.get("X-Logistel-Signature") || "";        // t=1700000000,v1=abc123...
  const parts = Object.fromEntries(header.split(",").map(p => p.split("=")));
  const expected = crypto.createHmac("sha256", process.env.LOGISTEL_WEBHOOK_SECRET)
    .update(\`\${parts.t}.\${req.body}\`).digest("hex");

  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;   // reject replays > 5 min old
  const valid = parts.v1 && expected.length === parts.v1.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
  if (!fresh || !valid) return res.status(400).send("Invalid signature");

  const event = JSON.parse(req.body);   // { type: "shipment.delivered", data: { id, status, ... } }
  // TODO: update your order status here
  res.sendStatus(200);
});`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="glass-panel border-white/5 p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
          <div className="flex items-start gap-3">
            <Icon icon="solar:code-square-bold-duotone" className="text-4xl text-violet-400 shrink-0" />
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">Developer API &amp; Webhooks</h2>
              <p className="text-xs text-on-surface-variant max-w-xl mt-1">
                Let online stores, pharmacies and marketplaces book deliveries with you automatically, straight from
                their website or app. No more copying orders from WhatsApp. Their system calls yours, and you notify
                them the moment a parcel is picked up or delivered.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center shrink-0">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-5 py-3">
              <span className="block text-2xl font-bold text-violet-300">{activeKeys.length}</span>
              <span className="text-[9px] text-on-surface-variant uppercase font-bold">Active Keys</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl px-5 py-3">
              <span className="block text-2xl font-bold text-teal-300">{totalApiShipments}</span>
              <span className="text-[9px] text-on-surface-variant uppercase font-bold">API Shipments</span>
            </div>
          </div>
        </div>
      </div>

      {/* One-time secret reveal */}
      {revealed && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6 space-y-4 animate-in fade-in">
          <div className="flex items-start gap-3">
            <Icon icon="solar:danger-triangle-bold-duotone" className="text-3xl text-amber-400 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-amber-200">Copy these secrets now. They will never be shown again.</h3>
              <p className="text-xs text-amber-100/70 mt-1">
                Store them in the merchant's server environment variables. Never put the API key in a website's
                frontend code, a mobile app, or a public GitHub repo. If it ever leaks, revoke it below and create a new one.
              </p>
            </div>
          </div>
          <SecretRow label={`API Key: ${revealed.name}`} value={revealed.apiKey} />
          <SecretRow label="Webhook Signing Secret" value={revealed.webhookSecret} />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setRevealed(null)}
              className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-bold hover:bg-amber-500/30 transition-all cursor-pointer"
            >
              I have saved them securely
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Create key */}
        <form onSubmit={handleCreate} className="glass-panel border-white/5 p-6 rounded-2xl space-y-4 xl:col-span-1">
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <Icon icon="solar:key-minimalistic-square-bold-duotone" className="text-xl text-violet-400" />
            Create API Key
          </h3>
          <div className="space-y-1">
            <label htmlFor="dev-key-name" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Key Name</label>
            <input
              id="dev-key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder='e.g. "Mama Ngozi Pharmacy Website"'
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="dev-key-webhook" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Webhook URL <span className="normal-case font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="dev-key-webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              maxLength={500}
              placeholder="https://merchant-store.com/logistel-webhook"
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60"
            />
            <p className="text-[10px] text-slate-500">Must be a public https:// address. We'll POST status updates here.</p>
          </div>
          <button
            id="dev-create-key-btn"
            type="submit"
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-teal-600 text-white text-xs font-bold shadow-lg shadow-violet-900/30 hover:brightness-110 disabled:opacity-60 transition-all cursor-pointer"
          >
            <Icon icon={creating ? "svg-spinners:180-ring" : "solar:add-circle-bold"} className="text-base" />
            {creating ? "Generating…" : "Generate Key"}
          </button>
          <ul className="text-[10px] text-slate-500 space-y-1 pt-2 border-t border-white/5">
            <li className="flex gap-1.5"><Icon icon="solar:shield-check-bold" className="text-emerald-500 shrink-0 mt-0.5" />Keys are hashed. Even we can't read them back.</li>
            <li className="flex gap-1.5"><Icon icon="solar:shield-check-bold" className="text-emerald-500 shrink-0 mt-0.5" />Each key only sees the shipments it created.</li>
            <li className="flex gap-1.5"><Icon icon="solar:shield-check-bold" className="text-emerald-500 shrink-0 mt-0.5" />Rate limited, and revocable instantly.</li>
          </ul>
        </form>

        {/* Key list */}
        <div className="glass-panel border-white/5 p-6 rounded-2xl space-y-4 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <Icon icon="solar:server-square-bold-duotone" className="text-xl text-teal-400" />
              Your API Keys
            </h3>
            {revokedKeys.length > 0 && (
              <button
                type="button"
                onClick={() => setShowRevoked((v) => !v)}
                className="text-[11px] text-slate-400 hover:text-slate-200 font-bold cursor-pointer"
              >
                {showRevoked ? "Hide" : "Show"} revoked ({revokedKeys.length})
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500 text-xs gap-2">
              <Icon icon="svg-spinners:180-ring" className="text-lg" /> Loading keys…
            </div>
          ) : activeKeys.length === 0 && !showRevoked ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <Icon icon="solar:key-broken" className="text-4xl text-slate-600" />
              <p className="text-xs text-slate-400">No API keys yet.</p>
              <p className="text-[11px] text-slate-500 max-w-xs">Create one for each merchant or website that should book deliveries automatically.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...activeKeys, ...(showRevoked ? revokedKeys : [])].map((k) => {
                const revoked = !!k.revokedAt;
                const busy = busyId === k.id;
                return (
                  <div
                    key={k.id}
                    className={`rounded-xl border p-4 space-y-3 transition-all ${
                      revoked ? "border-slate-800 bg-slate-950/30 opacity-60" : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-100 truncate">{k.name}</span>
                          <span
                            className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                              revoked
                                ? "border-red-500/30 text-red-300 bg-red-500/10"
                                : "border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
                            }`}
                          >
                            {revoked ? "Revoked" : "Active"}
                          </span>
                        </div>
                        <code className="text-[11px] font-mono text-slate-400">{k.keyPrefix}••••••••••••</code>
                      </div>
                      <div className="flex gap-4 text-[10px] text-slate-400">
                        <div><span className="block uppercase font-bold text-slate-500">Shipments</span>{k._count?.deliveries ?? 0}</div>
                        <div><span className="block uppercase font-bold text-slate-500">Last used</span>{formatDate(k.lastUsedAt)}</div>
                        <div><span className="block uppercase font-bold text-slate-500">Created</span>{formatDate(k.createdAt)}</div>
                      </div>
                    </div>

                    {!revoked && (
                      <>
                        {/* Webhook row */}
                        {editingId === k.id ? (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              value={editUrl}
                              onChange={(e) => setEditUrl(e.target.value)}
                              maxLength={500}
                              placeholder="https://merchant-store.com/logistel-webhook (leave empty to remove)"
                              className="flex-grow bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleSaveWebhook(k.id)}
                                className="px-3 py-2 rounded-lg bg-teal-600/80 text-white text-[11px] font-bold hover:bg-teal-600 disabled:opacity-60 cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="px-3 py-2 rounded-lg border border-slate-700 text-slate-300 text-[11px] font-bold hover:border-slate-500 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-[11px] bg-slate-950/50 border border-slate-800/70 rounded-lg px-3 py-2">
                            <Icon icon="solar:link-round-angle-bold-duotone" className="text-violet-400 shrink-0" />
                            <span className={`truncate ${k.webhookUrl ? "text-slate-300 font-mono" : "text-slate-500 italic"}`}>
                              {k.webhookUrl || "No webhook configured"}
                            </span>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => { setEditingId(k.id); setEditUrl(k.webhookUrl || ""); }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-[11px] font-bold hover:border-violet-500/50 hover:text-violet-300 transition-all cursor-pointer"
                          >
                            <Icon icon="solar:pen-bold-duotone" /> {k.webhookUrl ? "Edit" : "Add"} webhook
                          </button>
                          {k.webhookUrl && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleTest(k.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-[11px] font-bold hover:border-teal-500/50 hover:text-teal-300 disabled:opacity-60 transition-all cursor-pointer"
                            >
                              <Icon icon={busy ? "svg-spinners:180-ring" : "solar:plain-bold-duotone"} /> Send test
                            </button>
                          )}
                          {confirmRevokeId === k.id ? (
                            <div className="inline-flex items-center gap-2 px-2 py-1 rounded-lg border border-red-500/40 bg-red-500/10">
                              <span className="text-[11px] text-red-200">Stop this key permanently?</span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleRevoke(k.id)}
                                className="px-2 py-1 rounded-md bg-red-600 text-white text-[10px] font-bold hover:bg-red-500 disabled:opacity-60 cursor-pointer"
                              >
                                Yes, revoke
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmRevokeId(null)}
                                className="text-[10px] text-slate-300 font-bold cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmRevokeId(k.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-300 text-[11px] font-bold hover:bg-red-500/10 transition-all cursor-pointer"
                            >
                              <Icon icon="solar:trash-bin-trash-bold-duotone" /> Revoke
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick start docs */}
      <div className="glass-panel border-white/5 p-6 rounded-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <Icon icon="solar:book-2-bold-duotone" className="text-xl text-teal-400" />
            Quick Start for Merchants' Developers
          </h3>
          <div className="flex items-center gap-2 bg-slate-950/70 border border-slate-800 rounded-lg pl-3 pr-1 py-1">
            <span className="text-[10px] font-bold uppercase text-slate-500">Base URL</span>
            <code className="text-[11px] font-mono text-teal-300 truncate max-w-[260px]">{publicBaseUrl}</code>
            <CopyButton value={publicBaseUrl} />
          </div>
        </div>

        <div className="flex gap-2 border-b border-white/5">
          {([
            ["create", "1. Book a delivery"],
            ["track", "2. Track, quote & cancel"],
            ["webhook", "3. Receive webhooks"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDocsTab(id)}
              className={`px-3 py-2 text-[11px] font-bold border-b-2 -mb-px transition-all cursor-pointer ${
                docsTab === id ? "border-teal-400 text-teal-300" : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {docsTab === "create" && <CodeBlock code={createExample} />}
        {docsTab === "track" && <CodeBlock code={trackExample} />}
        {docsTab === "webhook" && (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-400">
              Events sent: <code className="text-violet-300">shipment.assigned</code>, <code className="text-violet-300">shipment.picked_up</code>,{" "}
              <code className="text-violet-300">shipment.in_transit</code>, <code className="text-violet-300">shipment.delivered</code>,{" "}
              <code className="text-violet-300">shipment.cancelled</code>. Failed deliveries are retried after 30 seconds, then again after 2 minutes.
            </p>
            <CodeBlock code={webhookExample} />
          </div>
        )}
      </div>
    </div>
  );
}
