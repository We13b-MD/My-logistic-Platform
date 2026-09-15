# 📋 Logistel Platform — System Modifications & Architectural Log

**Date:** September 15, 2026  
**Focus Areas:** Dispatcher Fleet Control, Zero-Wait GPS Anchoring, Silent Telemetry, Automated Departure Geofencing, and Lagos Urban Traffic Calibration.

---

## 1. Executive Summary

This document records the architectural enhancements and code modifications implemented to give dispatchers (**`admin@swift.com`**) complete operational control over shipment tracking, eliminate driver-dependent tracking blind spots, and calibrate travel time estimates to real-world Nigerian road traffic.

### Problems Solved:
1. **Dispatcher Blind Spot:** Previously, opening the GPS trail showed:  
   `"No GPS breadcrumbs recorded yet for this delivery. Driver must broadcast location first."`  
   This left tracking at the mercy of whether the driver remembered or chose to broadcast.
2. **Missing Real-Time Telemetry:** Drivers only transmitted coordinates once when clicking an online toggle. If they drove 50 km, zero route points were logged.
3. **Unknown Departure Status:** Dispatchers could not determine whether an assigned carrier had physically departed the pickup warehouse without calling the driver.
4. **Unrealistic ETAs:** The routing engine estimated 7 minutes for a 6 km drive across Lagos (Surulere $\rightarrow$ Yaba) because it only calculated theoretical speed limits without traffic congestion.
5. **Runtime Database Query Error:** A query in the breadcrumbs route requested non-existent `firstName`/`lastName` columns on the Prisma `User` model.

---

## 2. Detailed Technical Solutions Implemented

### A. Tier 1: Instant Baseline Anchoring (Zero-Wait Radar)
* **Problem:** When an admin assigned a driver, the `LocationBreadcrumb` table was empty until the driver manually emitted a ping.
* **Solution:**
  * In [`delivery.service.ts`](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/backend/src/api/v1/modules/deliveries/delivery.service.ts), the moment a dispatcher assigns a carrier (`assignDriverByDispatcher`), the database automatically inserts **Breadcrumb #0** using the driver's known coordinates or the pickup origin.
  * In [`TenantDashboardPage.tsx`](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/admin-dashboard/src/features/dashboard/pages/TenantDashboardPage.tsx), the blocking error toast was removed. Clicking **GPS Trail** opens the radar immediately, displaying:
    * 🔵 **Pickup Pin**
    * 🟢 **Dropoff Pin**
    * 🔴 **Live Carrier Pin**
    * ➖ **Planned Road Corridor (Dashed Cyan Polyline)**
    * 🟠 **Historical Breadcrumb Path (Solid Orange Polyline)**

---

### B. Tier 2: Forced Background Telemetry & Duty Locking
* **Problem:** Drivers had manual control to toggle "Offline" while carrying cargo, cutting off dispatcher visibility.
* **Solution:**
  * In [`DriverDashboardPage.tsx`](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/admin-dashboard/src/features/dashboard/pages/DriverDashboardPage.tsx), an automated silent background tracking loop was implemented using `navigator.geolocation.watchPosition` (high accuracy) combined with a 10-second fallback heartbeat interval.
  * **Duty Status Locking:** The driver cannot toggle offline while an active shipment (`ASSIGNED`, `PICKED_UP`, `IN_TRANSIT`) is in progress (`"Security Enforcement: You cannot go offline while assigned to an active delivery"`).
  * A security banner displays on the driver console: *"Cargo Transit Security Telemetry Active — 10s AUTO-STREAM"*.
  * In [`driver.service.ts`](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/backend/src/api/v1/modules/drivers/driver.service.ts), all incoming heartbeat coordinates automatically append rows to `LocationBreadcrumb` for active deliveries.

---

### C. Tier 4: Automated Geofencing & Departure Detection
* **Problem:** Dispatchers had to call drivers to verify if they had actually left the pickup point.
* **Solution:**
  * In [`tracking.service.ts`](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/backend/src/api/v1/modules/tracking/tracking.service.ts), a mathematical Haversine radius engine was integrated to compute real-time distance in meters from the pickup origin:
    * **`AT_PICKUP`**: Within 250 meters of origin.
    * **`DEPARTED_PICKUP`**: Distance $> 300$ meters from pickup origin.
    * **`ARRIVED_DROPOFF`**: Within 250 meters of customer destination.
  * In [`TenantDashboardPage.tsx`](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/admin-dashboard/src/features/dashboard/pages/TenantDashboardPage.tsx), real-time departure status is displayed in both the Deliveries Table and the GPS Radar modal:
    * 🟢 **"Left Location (Departed: X.X km away)"**
    * 🔵 **"At Pickup Location"**
  * **Watchdog Sentinel Alert:** If an active carrier stops transmitting telemetry for $> 2$ minutes, the radar triggers a red alert with an actionable **"📡 Send Safety Ping"** button.

---

### D. Bug Fix: Prisma User Model Field Query
* **Problem:** Clicking the GPS trail threw:
  ```
  Unknown field `firstName` for select statement on model `User`.
  ```
* **Solution:**
  * In [`tracking.repository.ts`](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/backend/src/api/v1/modules/tracking/tracking.repository.ts), updated the `user` relation select to request valid fields `id` and `email`.
  * In [`tracking.service.ts`](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/backend/src/api/v1/modules/tracking/tracking.service.ts), derived the carrier display name cleanly from the user's verified email handle.

---

### E. Lagos Urban Traffic Multiplier (Realistic Travel Times)

#### 📖 Definition: What is an Urban Traffic Multiplier?
> **An Urban Traffic Multiplier is a calibration coefficient applied to theoretical road routing algorithms to account for real-world urban congestion, traffic bottlenecks ("go-slow"), traffic lights, and pedestrian delays.**  
> Standard open-source routing engines (like OSRM) calculate duration assuming a vehicle drives uninterrupted at maximum legal speed limits. In reality, dense cities like Lagos do not permit uninterrupted driving. The Urban Traffic Multiplier bridges this gap by multiplying raw theoretical drive times by a real-world congestion factor, providing trustworthy arrival estimates to dispatchers and customers without incurring expensive commercial map API fees (e.g. Google Maps).

$$\text{Realistic Estimated Duration (mins)} = \text{Theoretical OSRM Duration} \times \text{Urban Traffic Multiplier}$$

* **Problem:** The routing engine (OSRM) displayed 7 minutes for 6 km between Surulere and Yaba because it assumed free-flow driving at maximum legal speed limits with no traffic lights or congestion.
* **Solution ([`useOsrmRoute.ts`](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/admin-dashboard/src/utils/useOsrmRoute.ts)):**
  * Integrated a dynamic **Urban Traffic Multiplier** that calibrates theoretical travel times to real-world Nigerian road conditions:
    * **Dispatch Motorbikes (`BIKE`):**
      * Normal Daytime: **1.8x** (Surulere $\rightarrow$ Yaba: **~13 minutes**)
      * Peak Rush Hour: **2.2x** (**~15 minutes**)
      * Late Night (Empty): **1.2x** (**~8 minutes**)
    * **Vans / Cars (`VAN`, `CAR`):**
      * Normal Daytime: **2.6x** (**~18 minutes**)
      * Peak Rush Hour: **3.5x** (**~25 minutes**)
      * Late Night: **1.3x** (**~9 minutes**)
    * **Heavy Freight Trucks (`TRUCK`):**
      * Normal Daytime: **3.2x**
      * Peak Rush Hour: **4.0x**
  * Automatically detects local peak hours (**7:00–10:00 AM** and **4:00–8:00 PM**) to dynamically reflect rush hour gridlocks.
  * Passed `driverProfile?.vehicleType` in [`DriverDashboardPage.tsx`](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/admin-dashboard/src/features/dashboard/pages/DriverDashboardPage.tsx) so driver navigation reflects their specific vehicle's capability.
  * Added dynamic **`durationRange`** (e.g. `~14 - 19 mins (Lagos traffic)`) to provide realistic time windows rather than brittle single-minute numbers.

---

### F. Real-World Mobile Navigation & Satellite Telemetry Analysis

#### 1. Why Did Google Maps Show 20 mins While the App Showed 13 mins?
* **Vehicle Mode Mismatch:** Our app's calculation defaulted to a **Dispatch Motorbike (`BIKE`)** ($7\text{ mins} \times 1.8 = \mathbf{13\text{ mins}}$) because motorbikes lane-split through bottlenecks. However, tapping "Start Turn-by-Turn Navigation" previously launched Google Maps in **Car Driving Mode** (`mode=d`), where a 4-wheeled car stuck in live Ojuelegba traffic took **20 minutes**.
* **Resolution:**
  1. Updated [`DriverDashboardPage.tsx`](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/admin-dashboard/src/features/dashboard/pages/DriverDashboardPage.tsx) to launch vehicle-specific intent modes (`mode=l` / `travelmode=two_wheeler` for motorbikes vs. `mode=d` / `travelmode=driving` for cars/vans).
  2. For a Car/Van, our multiplier ($2.6\times$) predicts **18 – 20 minutes**, matching Google Maps live car traffic.
  3. Integrated **`durationRange`** (e.g. `~14 - 20 mins (Lagos traffic)`) in [`useOsrmRoute.ts`](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/admin-dashboard/src/utils/useOsrmRoute.ts) to display realistic time buffers.

#### 2. Why Did Google Maps Show *"GPS Signal Lost"* on Mobile?
* **Indoor Concrete Attenuation:** Browsers can estimate an approximate indoor position using Wi-Fi routers and cell towers. However, when Google Maps enters **turn-by-turn driving mode**, it strictly requires line-of-sight satellite GNSS/GPS signals from space. Concrete roofs and office walls block satellite radio frequencies, causing Google Maps to show *"Searching for GPS / GPS signal lost"*.
* **Resolution:** Normal satellite physics. Once the carrier moves outdoors into the street or onto the vehicle under the open sky, satellite line-of-sight connects and navigation locks immediately.

---

## 3. Modified Files Index

| File Path | Component | Changes Made |
| :--- | :--- | :--- |
| [`backend/src/api/v1/modules/deliveries/delivery.service.ts`](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/backend/src/api/v1/modules/deliveries/delivery.service.ts) | Backend API | Seeds Breadcrumb #0 upon dispatcher assignment in database transaction. |
| [`backend/src/api/v1/modules/drivers/driver.service.ts`](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/backend/src/api/v1/modules/drivers/driver.service.ts) | Backend API | Appends coordinates to `LocationBreadcrumb` for active deliveries on incoming pings. |
| [`backend/src/api/v1/modules/tracking/tracking.repository.ts`](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/backend/src/api/v1/modules/tracking/tracking.repository.ts) | Backend DB | Fixed Prisma query to select `id` and `email` instead of `firstName`/`lastName`. |
| [`backend/src/api/v1/modules/tracking/tracking.service.ts`](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/backend/src/api/v1/modules/tracking/tracking.service.ts) | Backend Logic | Haversine distance geofencing, Watchdog Sentinel calculation, baseline anchor synthesis. |
| [`admin-dashboard/src/features/dashboard/pages/DriverDashboardPage.tsx`](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/admin-dashboard/src/features/dashboard/pages/DriverDashboardPage.tsx) | Frontend | 10s silent background GPS loop, locked duty status during transit, cargo security banner. |
| [`admin-dashboard/src/features/dashboard/pages/TenantDashboardPage.tsx`](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/admin-dashboard/src/features/dashboard/pages/TenantDashboardPage.tsx) | Frontend | Live GPS radar modal, departure indicators in deliveries table, watchdog alert banner. |
| [`admin-dashboard/src/utils/useOsrmRoute.ts`](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/admin-dashboard/src/utils/useOsrmRoute.ts) | Frontend Hook | Lagos Urban Traffic Multiplier, peak hour detection, vehicle type differentiation. |

---

## 4. Verification & Build Status

* **Admin Dashboard Build:**
  ```bash
  npm run build
  # ✓ built in 4.59s (0 TypeScript errors)
  ```
* **Backend Build:**
  ```bash
  npm run build
  # tsc exited with code 0 (0 TypeScript errors)
  ```
