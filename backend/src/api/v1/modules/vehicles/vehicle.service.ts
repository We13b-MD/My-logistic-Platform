import { prisma } from "../../../../config/prisma";
import { Prisma, VehicleStatus, VehicleType } from "@prisma/client";
import { CreateVehicleDTO, UpdateVehicleDTO, VehicleFilterQuery, VehicleResponse } from "./vehicle.types";

export class VehicleService {
  /**
   * Helper to format vehicle response with computed isMaintenanceOverdue boolean.
   */
  private formatVehicleResponse(vehicle: any): VehicleResponse {
    const now = new Date();
    const isMaintenanceOverdue = Boolean(
      vehicle.nextMaintenanceDue && new Date(vehicle.nextMaintenanceDue) < now
    );

    return {
      id: vehicle.id,
      tenantId: vehicle.tenantId,
      plateNumber: vehicle.plateNumber,
      vehicleType: vehicle.vehicleType,
      status: vehicle.status,
      lastMaintenance: vehicle.lastMaintenance,
      nextMaintenanceDue: vehicle.nextMaintenanceDue,
      isMaintenanceOverdue,
      driverId: vehicle.driverId,
      driver: vehicle.driver
        ? {
            id: vehicle.driver.id,
            vehicleType: vehicle.driver.vehicleType,
            licenseNumber: vehicle.driver.licenseNumber,
            user: {
              id: vehicle.driver.user.id,
              email: vehicle.driver.user.email,
            },
          }
        : null,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    };
  }

  /**
   * Register a new vehicle asset for the tenant (Super Admin only).
   */
  async createVehicle(tenantId: string, data: CreateVehicleDTO) {
    // 1. Verify plate number uniqueness within platform
    const existing = await prisma.vehicle.findUnique({
      where: { plateNumber: data.plateNumber },
    });
    if (existing) {
      throw new Error("Vehicle with this plate number already exists");
    }

    // 2. If driverId provided, verify driver belongs to this tenant and has no assigned vehicle
    if (data.driverId) {
      const driver = await prisma.driverProfile.findUnique({
        where: { id: data.driverId },
        include: { user: true, vehicle: true },
      });

      if (!driver || driver.user.tenantId !== tenantId) {
        throw new Error("Driver not found or belongs to another tenant");
      }

      if (driver.vehicle) {
        throw new Error(`Driver is already assigned to vehicle ${driver.vehicle.plateNumber}`);
      }
    }

    try {
      const vehicle = await prisma.vehicle.create({
        data: {
          tenantId,
          plateNumber: data.plateNumber,
          vehicleType: data.vehicleType,
          status: data.status || VehicleStatus.IDLE,
          lastMaintenance: data.lastMaintenance ? new Date(data.lastMaintenance) : null,
          nextMaintenanceDue: data.nextMaintenanceDue ? new Date(data.nextMaintenanceDue) : null,
          driverId: data.driverId || null,
        },
        include: {
          driver: {
            include: {
              user: {
                select: { id: true, email: true },
              },
            },
          },
        },
      });

      return this.formatVehicleResponse(vehicle);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new Error("Vehicle plate number must be unique across the platform");
      }
      throw e;
    }
  }

  /**
   * Get all vehicles belonging to the tenant with optional status/type filters.
   */
  async getVehicles(tenantId: string, query: VehicleFilterQuery) {
    const where: Prisma.VehicleWhereInput = {
      tenantId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.vehicleType) {
      where.vehicleType = query.vehicleType;
    }

    if (query.search) {
      where.plateNumber = {
        contains: query.search,
        mode: "insensitive",
      };
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        driver: {
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return vehicles.map((v) => this.formatVehicleResponse(v));
  }

  /**
   * Fetch a single vehicle by ID with tenant isolation.
   */
  async getVehicleById(tenantId: string, vehicleId: string) {
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        tenantId,
      },
      include: {
        driver: {
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        },
      },
    });

    if (!vehicle) {
      throw new Error("Vehicle not found");
    }

    return this.formatVehicleResponse(vehicle);
  }

  /**
   * Update vehicle status, specs, or maintenance schedule (Super Admin only).
   */
  async updateVehicle(tenantId: string, vehicleId: string, data: UpdateVehicleDTO) {
    const existing = await prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
    });

    if (!existing) {
      throw new Error("Vehicle not found");
    }

    // Check plate number collision if plate is changing
    if (data.plateNumber && data.plateNumber !== existing.plateNumber) {
      const plateCheck = await prisma.vehicle.findUnique({
        where: { plateNumber: data.plateNumber },
      });
      if (plateCheck) {
        throw new Error("Vehicle with this plate number already exists");
      }
    }

    const updateData: Prisma.VehicleUpdateInput = {};

    if (data.plateNumber) updateData.plateNumber = data.plateNumber;
    if (data.vehicleType) updateData.vehicleType = data.vehicleType;
    if (data.status) updateData.status = data.status;

    if (data.lastMaintenance !== undefined) {
      updateData.lastMaintenance = data.lastMaintenance ? new Date(data.lastMaintenance) : null;
    }

    if (data.nextMaintenanceDue !== undefined) {
      updateData.nextMaintenanceDue = data.nextMaintenanceDue ? new Date(data.nextMaintenanceDue) : null;
    }

    const updated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: updateData,
      include: {
        driver: {
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        },
      },
    });

    return this.formatVehicleResponse(updated);
  }

  /**
   * Assign or unassign a driver to a vehicle (Super Admin only).
   */
  async assignDriver(tenantId: string, vehicleId: string, driverId: string | null) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
    });

    if (!vehicle) {
      throw new Error("Vehicle not found");
    }

    // If assigning a driver
    if (driverId) {
      const driver = await prisma.driverProfile.findUnique({
        where: { id: driverId },
        include: { user: true, vehicle: true },
      });

      if (!driver || driver.user.tenantId !== tenantId) {
        throw new Error("Driver not found or belongs to another tenant");
      }

      if (driver.vehicle && driver.vehicle.id !== vehicleId) {
        throw new Error(`Driver is already assigned to vehicle ${driver.vehicle.plateNumber}`);
      }

      // Assign driver and update vehicle status to IN_USE if currently IDLE
      const updated = await prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          driverId,
          status: vehicle.status === VehicleStatus.IDLE ? VehicleStatus.IN_USE : vehicle.status,
        },
        include: {
          driver: {
            include: {
              user: {
                select: { id: true, email: true },
              },
            },
          },
        },
      });

      return this.formatVehicleResponse(updated);
    } else {
      // Unassign driver and revert status to IDLE if was IN_USE
      const updated = await prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          driverId: null,
          status: vehicle.status === VehicleStatus.IN_USE ? VehicleStatus.IDLE : vehicle.status,
        },
        include: {
          driver: {
            include: {
              user: {
                select: { id: true, email: true },
              },
            },
          },
        },
      });

      return this.formatVehicleResponse(updated);
    }
  }

  /**
   * Delete vehicle record from tenant inventory (Super Admin only).
   */
  async deleteVehicle(tenantId: string, vehicleId: string) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId },
    });

    if (!vehicle) {
      throw new Error("Vehicle not found");
    }

    await prisma.vehicle.delete({
      where: { id: vehicleId },
    });

    return { message: "Vehicle successfully removed from fleet inventory" };
  }
}
