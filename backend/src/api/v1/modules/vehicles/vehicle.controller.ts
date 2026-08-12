import { Request, Response } from "express";
import { VehicleService } from "./vehicle.service";
import { VehicleStatus, VehicleType } from "@prisma/client";

const vehicleService = new VehicleService();

export class VehicleController {
  /**
   * POST /api/v1/vehicles
   * Create a vehicle asset (Super Admin only).
   */
  async createVehicle(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user!.tenantId;
      const vehicle = await vehicleService.createVehicle(tenantId, req.body);
      res.status(201).json({
        status: "success",
        data: vehicle,
      });
    } catch (error: any) {
      const statusCode = error.message?.includes("already exists") ? 409 : 400;
      res.status(statusCode).json({
        status: "error",
        message: error.message || "Failed to create vehicle",
      });
    }
  }

  /**
   * GET /api/v1/vehicles
   * List vehicles for tenant with optional filters.
   */
  async listVehicles(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user!.tenantId;
      const { status, vehicleType, search } = req.query;

      const filters = {
        status: status ? (status as VehicleStatus) : undefined,
        vehicleType: vehicleType ? (vehicleType as VehicleType) : undefined,
        search: search ? (search as string) : undefined,
      };

      const vehicles = await vehicleService.getVehicles(tenantId, filters);
      res.status(200).json({
        status: "success",
        data: vehicles,
      });
    } catch (error: any) {
      res.status(400).json({
        status: "error",
        message: error.message || "Failed to retrieve vehicles",
      });
    }
  }

  /**
   * GET /api/v1/vehicles/:id
   * Get single vehicle details.
   */
  async getVehicleById(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user!.tenantId;
      const vehicleId = req.params.id as string;

      const vehicle = await vehicleService.getVehicleById(tenantId, vehicleId);
      res.status(200).json({
        status: "success",
        data: vehicle,
      });
    } catch (error: any) {
      res.status(404).json({
        status: "error",
        message: error.message || "Vehicle not found",
      });
    }
  }

  /**
   * PUT /api/v1/vehicles/:id
   * Update vehicle specs, status, or maintenance schedules (Super Admin only).
   */
  async updateVehicle(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user!.tenantId;
      const vehicleId = req.params.id as string;

      const vehicle = await vehicleService.updateVehicle(tenantId, vehicleId, req.body);
      res.status(200).json({
        status: "success",
        data: vehicle,
      });
    } catch (error: any) {
      const statusCode = error.message?.includes("already exists") ? 409 : 400;
      res.status(statusCode).json({
        status: "error",
        message: error.message || "Failed to update vehicle",
      });
    }
  }

  /**
   * PATCH /api/v1/vehicles/:id/assign-driver
   * Assign or unassign driver (Super Admin only).
   */
  async assignDriver(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user!.tenantId;
      const vehicleId = req.params.id as string;
      const { driverId } = req.body;

      const vehicle = await vehicleService.assignDriver(tenantId, vehicleId, driverId);
      res.status(200).json({
        status: "success",
        data: vehicle,
      });
    } catch (error: any) {
      res.status(400).json({
        status: "error",
        message: error.message || "Failed to assign driver",
      });
    }
  }

  /**
   * DELETE /api/v1/vehicles/:id
   * Remove vehicle (Super Admin only).
   */
  async deleteVehicle(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.user!.tenantId;
      const vehicleId = req.params.id as string;

      const result = await vehicleService.deleteVehicle(tenantId, vehicleId);
      res.status(200).json({
        status: "success",
        message: result.message,
      });
    } catch (error: any) {
      res.status(400).json({
        status: "error",
        message: error.message || "Failed to delete vehicle",
      });
    }
  }

}
