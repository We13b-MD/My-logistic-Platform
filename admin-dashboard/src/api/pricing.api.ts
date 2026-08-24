import apiClient from "@/utils/axios";

export const pricingApi = {
  // Fetch pricing rules and tenant subscription details
  getRules: () => apiClient.get("/pricing/rules"),

  // Update tenant rates config
  updateRules: (data: {
    baseFare?: number;
    perKmRate?: number;
    bikeMultiplier?: number;
    carMultiplier?: number;
    vanMultiplier?: number;
    truckMultiplier?: number;
  }) => apiClient.put("/pricing/rules", data),

  // List all past billing invoices
  getInvoices: () => apiClient.get("/pricing/invoices"),

  // Fetch or generate invoice detail for a delivery
  getInvoice: (deliveryId: string) => apiClient.get(`/pricing/invoices/${deliveryId}`),

  // Verify Paystack payment reference
  verifySubscription: (reference: string, planType: "MONTHLY" | "ANNUAL") =>
    apiClient.post("/pricing/subscribe/verify", { reference, planType }),
};
