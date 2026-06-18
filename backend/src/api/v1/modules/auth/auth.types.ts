export interface RegisterDTO {
  email: string;
  password: string;
  role?: "CUSTOMER" | "DRIVER" | "ADMIN";
  tenantId: string;
}


