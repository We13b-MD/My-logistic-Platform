import { Request, Response } from "express";
import { TenantService } from "./tenant.service";

const tenantService = new TenantService();

export class TenantController {
  /**
   * HTTP Handler to onboard a new Tenant company and create its admin.
   */
  async onboard(req: Request, res: Response): Promise<void> {
    try {
      const result = await tenantService.onboard(req.body);
      res.status(201).json({
        status: "success",
        data: result,
      });
    } catch (error: any) {
      // 1. Log the full detailed error stack trace on the backend console for developer visibility
      console.error("Tenant onboarding service error:", error);

      // 2. Identify if the crash is a database-level connection or structural error
      const message = error.message || "";
      const isSystemError = 
        message.includes("prisma") || 
        message.includes("database") || 
        message.includes("connect") || 
        message.includes("pooler") || 
        message.includes("econnrefused");

      // 3. Return a generic mask if it's a system crash, otherwise send the specific input validation error
      if (isSystemError) {
        res.status(500).json({
          status: "error",
          message: "Internal Server Error. Please contact support or try again later.",
        });
      } else {
        res.status(400).json({
          status: "error",
          message: message || "Tenant onboarding failed",
        });
      }
    }
  }

  async getBySubdomain(req: Request, res: Response): Promise<void> {
    try {
      const { subdomain } = req.params;
      if (!subdomain) {
        res.status(400).json({
          status: "error",
          message: "Subdomain parameter is required.",
        });
        return;
      }

      const tenant = await tenantService.getBySubdomain(subdomain as string);
      if (!tenant) {
        res.status(404).json({
          status: "error",
          message: "Logistics company not found.",
        });
        return;
      }

      res.status(200).json({
        status: "success",
        data: tenant,
      });
    } catch (error: any) {
      console.error("Fetch tenant by subdomain error:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to retrieve tenant details.",
      });
    }
  }

  async listAll(req: Request, res: Response): Promise<void> {
    try {
      const tenants = await tenantService.listAllTenants();
      res.status(200).json({
        status: "success",
        data: tenants,
      });
    } catch (error: any) {
      console.error("List tenants error:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to list platform tenants.",
      });
    }
  }

  async toggleStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") {
        res.status(400).json({
          status: "error",
          message: "isActive parameter must be a boolean",
        });
        return;
      }
      const updated = await tenantService.toggleTenantStatus(id as string, isActive);

      res.status(200).json({
        status: "success",
        data: updated,
      });
    } catch (error: any) {
      console.error("Toggle tenant status error:", error);
      res.status(500).json({
        status: "error",
        message: error.message || "Failed to update tenant status.",
      });
    }
  }

  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await tenantService.getPlatformMetrics();
      res.status(200).json({
        status: "success",
        data: metrics,
      });
    } catch (error: any) {
      console.error("Get platform metrics error:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to retrieve platform metrics.",
      });
    }
  }
}

