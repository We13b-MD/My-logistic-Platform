export interface OnboardTenantDTO {
  companyName: string;
  subdomain: string;
  industry: "FOOD" | "HEALTH" | "TRANSPORT" | "FASHION" | "SPORT" | "ENTERTAINMENT" | "BANKING" | "OTHERS";
  adminEmail: string;
  adminPassword: string;
}
