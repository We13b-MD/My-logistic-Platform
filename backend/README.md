# Backend Services

This directory contains the central services, APIs, and business logic for the logistics platform.

## Overview
The backend is responsible for:
- REST and/or GraphQL API gateways
- Real-time driver dispatching, tracking, and telemetry logic (Socket.io)
- Multi-tenant SaaS company onboarding & JWT Role-Based Access Control (RBAC)
- **Fleet & Vehicle Management**: Vehicle asset inventory, Super Admin anti-fraud controls, driver assignment, and maintenance overdue tracking
- **Proof of Delivery (POD) Engine**: Base64 photo & HTML5 digital signature canvas uploads powered by **Cloudinary CDN Cloud Storage**
- BullMQ smart driver auto-matching background dispatch queue

## Module Architecture
```
backend/src/api/v1/modules/
├── auth/           ← Registration, JWT login, bcrypt verification, rate limiters
├── tenant/         ← Multi-tenant SaaS onboarding, industry classification
├── drivers/        ← Driver profile management, duty toggling, GPS coordinates
├── vehicles/       ← Super Admin Fleet CRUD, vehicle statuses (IDLE/IN_USE/MAINTENANCE), maintenance deadlines
├── deliveries/     ← Order creation, state transitions, OTP validation, POD photo & signature uploads
├── tracking/       ← Real-time Socket.io driver location streaming & room routing
└── users/          ← User profile management & RBAC queries
```

## Setup & Running

```bash
cd backend
npm install
npm run dev    # Starts API server on port 3000
```

