import apiClient from "@/utils/axios";

export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  webhookUrl: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  _count?: { deliveries: number };
}

/** Returned only once, at creation time. */
export interface CreatedApiKey extends ApiKeySummary {
  apiKey: string;
  webhookSecret: string;
}

export const developerApi = {
  // List all API keys for this company (secrets are never returned)
  listKeys: () => apiClient.get<{ status: string; data: ApiKeySummary[] }>("/developer/keys"),

  // Create a key — the raw key + webhook secret are shown ONCE in the response
  createKey: (data: { name: string; webhookUrl?: string }) =>
    apiClient.post<{ status: string; message: string; data: CreatedApiKey }>("/developer/keys", data),

  // Set / clear the webhook URL for a key
  updateWebhook: (id: string, webhookUrl: string | null) =>
    apiClient.patch<{ status: string; data: ApiKeySummary }>(`/developer/keys/${id}`, { webhookUrl }),

  // Revoke immediately (irreversible)
  revokeKey: (id: string) => apiClient.delete<{ status: string; message: string }>(`/developer/keys/${id}`),

  // Fire a signed "ping" event at the configured webhook URL
  testWebhook: (id: string) =>
    apiClient.post<{ status: string; message: string }>(`/developer/keys/${id}/test-webhook`),
};

/** Absolute base URL of the public merchant API, derived from the dashboard API URL. */
export function getPublicApiBaseUrl(): string {
  const base = apiClient.defaults.baseURL || "/api/v1";
  const absolute = base.startsWith("http") ? base : `${window.location.origin}${base}`;
  return absolute.replace(/\/api\/v1\/?$/, "/api/public/v1");
}
