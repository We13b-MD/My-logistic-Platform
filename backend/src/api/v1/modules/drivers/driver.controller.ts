import { Request, Response } from "express";
import { DriverService } from "./driver.service";

const driverService = new DriverService();

export class DriverController {
  /**
   * Register a new driver profile.
   */
  async createProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const tenantId = req.user!.tenantId;

      const profile = await driverService.createProfile(userId, tenantId, req.body);
      res.status(201).json({
        status: "success",
        data: profile,
      });
    } catch (error: any) {
      res.status(400).json({
        status: "error",
        message: error.message || "Failed to create driver profile",
      });
    }
  }

  /**
   * Get the current authenticated driver's profile.
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const tenantId = req.user!.tenantId;

      const profile = await driverService.getProfile(userId, tenantId);
      res.status(200).json({
        status: "success",
        data: profile,
      });
    } catch (error: any) {
      res.status(404).json({
        status: "error",
        message: error.message || "Failed to retrieve driver profile",
      });
    }
  }

  /**
   * Update the driver's own profile.
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const tenantId = req.user!.tenantId;

      const profile = await driverService.updateProfile(userId, tenantId, req.body);
      res.status(200).json({
        status: "success",
        data: profile,
      });
    } catch (error: any) {
      res.status(400).json({
        status: "error",
        message: error.message || "Failed to update driver profile",
      });
    }
  }

  /**
   * Toggle the online/offline status of the driver.
   */
  async toggleOnline(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const tenantId = req.user!.tenantId;
      const { isOnline,latitude,longitude } = req.body;

      const profile = await driverService.toggleOnlineStatus(userId, tenantId, isOnline,latitude,longitude);
      res.status(200).json({
        status: "success",
        data: profile,
      });
    } catch (error: any) {
      res.status(400).json({
        status: "error",
        message: error.message || "Failed to update online status",
      });
    }
  }

  /**
   * List all drivers belonging to the admin's tenant (admin-only).
   */
  async listDrivers(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user!.tenantId;
      const { isOnline, isVerified } = req.query;

      const filters: { isOnline?: boolean; isVerified?: boolean } = {};
      if (isOnline !== undefined) {
        filters.isOnline = isOnline === "true";
      }
      if (isVerified !== undefined) {
        filters.isVerified = isVerified === "true";
      }

      const drivers = await driverService.listDriversForAdmin(tenantId, filters);
      res.status(200).json({
        status: "success",
        data: drivers,
      });
    } catch (error: any) {
      res.status(400).json({
        status: "error",
        message: error.message || "Failed to retrieve drivers",
      });
    }
  }

  /**
   * Verify/approve a driver profile (admin-only).
   */
  async verifyDriver(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user!.tenantId;
      const driverId = req.params.id as string;
      const { isVerified } = req.body;

      const profile = await driverService.verifyDriver(driverId, tenantId, isVerified);
      res.status(200).json({
        status: "success",
        data: profile,
      });
    } catch (error: any) {
      res.status(400).json({
        status: "error",
        message: error.message || "Failed to update verification status",
      });
    }
  }
}
