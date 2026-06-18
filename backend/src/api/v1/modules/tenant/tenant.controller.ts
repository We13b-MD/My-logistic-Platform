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
      res.status(400).json({
        status: "error",
        message: error.message || "Tenant onboarding failed",
      });
    }
  }
}
