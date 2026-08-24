import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { TrackingRepository } from "./tracking.repository";

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    role: string;
    tenantId: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const repository = new TrackingRepository();

export function initTrackingSocket(io: Server) {
  // 1. Socket.io Authentication Middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error("Authentication error: Token missing"));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string; tenantId: string };
      
      socket.user = {
        id: decoded.userId,
        role: decoded.role,
        tenantId: decoded.tenantId,
      };
      
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid or expired token"));
    }
  });

  // 2. Main Connection Event
  io.on("connection", (socket: AuthenticatedSocket) => {
    const user = socket.user!;
    console.log(`[Socket] Connected user: ${user.id} (${user.role}) for tenant ${user.tenantId}`);

    // Join tenant room for data isolation
    socket.join(`tenant:${user.tenantId}`);

    // Action A: Clients join delivery room to track a specific order
    socket.on("join_delivery_track", async (deliveryId: string) => {
      try {
        const delivery = await repository.getDeliveryDriverLocation(deliveryId, user.tenantId);
        
        if (delivery) {
          socket.join(`delivery:${deliveryId}`);
          console.log(`[Socket] Socket ${socket.id} joined tracking room: delivery:${deliveryId}`);
          
          // Send initial position if driver coordinates exist
          if (delivery.driver && delivery.driver.lastLatitude !== null && delivery.driver.lastLongitude !== null) {
            socket.emit("delivery_location_changed", {
              deliveryId: delivery.id,
              driverId: delivery.driver.id,
              latitude: delivery.driver.lastLatitude,
              longitude: delivery.driver.lastLongitude,
              updatedAt: delivery.driver.updatedAt,
            });
          }
        } else {
          socket.emit("tracking_error", { message: "Unauthorized or delivery not found" });
        }
      } catch (err: any) {
        socket.emit("tracking_error", { message: err.message });
      }
    });

    // Action B: Clients leave delivery room
    socket.on("leave_delivery_track", (deliveryId: string) => {
      socket.leave(`delivery:${deliveryId}`);
      console.log(`[Socket] Socket ${socket.id} left tracking room: delivery:${deliveryId}`);
    });

    // Action C: Drivers update dynamic GPS coordinates
    socket.on("driver_location_update", async (data: { latitude: number; longitude: number }) => {
      if (user.role !== "DRIVER") {
        socket.emit("tracking_error", { message: "Forbidden: Only drivers can broadcast location" });
        return;
      }

      const { latitude, longitude } = data;

      try {
        // Look up the driver profile by user ID
        const driverProfile = await repository.getDriverProfileId(user.id);
        
        if (!driverProfile) {
          socket.emit("tracking_error", { message: "Driver profile not found" });
          return;
        }

        // Update coordinate records in the database
        await repository.updateDriverLocation(driverProfile.id, latitude, longitude);

        const eventData = {
          driverId: driverProfile.id,
          latitude,
          longitude,
          updatedAt: new Date(),
        };

        // 1. Broadcast to admins monitoring this tenant's dispatch board
        io.to(`tenant:${user.tenantId}`).emit("driver_location_changed", eventData);

        // 2. Broadcast to rooms of active deliveries assigned to this driver
        const activeDeliveries = await repository.getActiveDeliveriesForDriver(driverProfile.id);
        
        for (const delivery of activeDeliveries) {
          io.to(`delivery:${delivery.id}`).emit("delivery_location_changed", {
            deliveryId: delivery.id,
            driverId: driverProfile.id,
            latitude,
            longitude,
            updatedAt: eventData.updatedAt,
          });

          // Save a permanent breadcrumb for every active delivery.
          // This is the cargo diversion audit trail — rows are never overwritten.
          // Silent failure: if breadcrumb save fails, it must NOT interrupt
          // the live location broadcast to customers.
          repository.saveBreadcrumb(driverProfile.id, delivery.id, latitude, longitude)
            .catch((err: Error) => {
              console.error(`[Breadcrumb] Failed to save GPS point for delivery ${delivery.id}:`, err.message);
            });
        }


      } catch (error: any) {
        console.error(`[Socket] Error updating driver location:`, error.message);
        socket.emit("tracking_error", { message: "Failed to update location" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Disconnected user: ${user.id}`);
    });
  });
}
