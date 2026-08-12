# Frontend — Admin Dashboard (React + Vite)

This is the web frontend for the Logistel multi-tenant logistics platform.
It is a separate application from the backend and communicates with it exclusively via HTTP REST API calls and WebSockets (Socket.io).

---

## Architecture

**Pattern: Feature-Based Architecture (Domain-Driven Frontend)**

Files are grouped by *feature/role domain*, not by type.
This means everything related to "auth" lives together, everything related to "driver dashboard" lives together, etc.
This makes the codebase easy to scale — adding a new role means adding a new feature folder, nothing else changes.

**Separation from Backend:**
This project uses a **Monorepo** structure — frontend and backend sit side by side in the same Git repository but are completely independent apps. They have their own `package.json`, their own dependencies, and their own dev servers.

```
My-logistic-Platform/
├── backend/           ← Express API (port 3000)
├── admin-dashboard/   ← This React Vite app (port 5173)
├── mobile-app/        ← React Native (future)
└── infrastructure/
```

---

## Tech Stack

| Technology | Version | Why |
|---|---|---|
| React | 18.3.1 | Core UI framework |
| Vite | 5.x | Build tool — fast dev server, fast builds |
| TypeScript | 5.x | Type safety across the whole frontend |
| React Router DOM | 6.x | Client-side routing and navigation |
| Axios | 1.7.x | HTTP requests to the backend API |
| Socket.io Client | 4.7.x | Real-time WebSocket connection for live tracking |
| TanStack Query | 5.x | Server data fetching, caching, loading/error states, pagination |
| Zustand | 5.x | Lightweight client-side UI state management |
| React Hook Form | 7.x | Performant form management — no re-renders on every keystroke |
| Zod | 4.x | Schema-based form validation |
| @hookform/resolvers | 5.x | Bridge between React Hook Form and Zod |
| Sonner | 2.x | Toast notifications (delivery status updates etc.) |
| React Leaflet | 4.x | Interactive map for real-time driver tracking |
| Leaflet | — | Map engine used by React Leaflet |
| Recharts | — | Charts for dashboard analytics (deliveries, revenue) |
| date-fns | — | Date and time formatting |
| Tailwind CSS | 4.x | Utility-first CSS framework — matches Stitch design output |
| @tailwindcss/vite | — | Tailwind v4 Vite plugin (replaces PostCSS config) |

---

## Folder Structure

```
admin-dashboard/
├── public/
├── src/
│   ├── api/                    ← All backend API calls (one file per module)
│   │   ├── auth.api.ts         ← Login, register
│   │   ├── delivery.api.ts     ← Create, list, update status, uploadPOD
│   │   ├── driver.api.ts       ← Driver profile, online toggle, verification
│   │   ├── vehicle.api.ts      ← Fleet CRUD, driver assignments, vehicle status
│   │   └── tenant.api.ts       ← Company onboarding
│   │
│   ├── assets/                 ← Stitch design files, images, icons
│   │
│   ├── components/             ← Reusable shared UI components
│   │   ├── SignatureCanvas.tsx ← HTML5 digital signature pad for POD handoffs
│   │   ├── ui/                 ← Button, Input, Modal, Badge, Table, Card
│   │   ├── layout/             ← Sidebar, Navbar, PageWrapper
│   │   └── shared/             ← Domain-specific reusable pieces

│   │
│   ├── context/
│   │   └── AuthContext.tsx     ← Global auth state (user, token, login, logout)
│   │
│   ├── features/               ← One folder per role/domain
│   │   └── auth/
│   │       └── pages/
│   │           ├── LoginPage.tsx
│   │           ├── RegisterPage.tsx
│   │           ├── TenantOnboardPage.tsx
│   │           ├── ForgotPasswordPage.tsx
│   │           └── UnauthorizedPage.tsx
│   │
│   ├── hooks/                  ← Global shared hooks (future)
│   │   ├── useAuth.ts
│   │   └── useSocket.ts
│   │
│   ├── router/
│   │   ├── AppRouter.tsx       ← All routes, role-based redirect on login
│   │   ├── ProtectedRoute.tsx  ← Blocks unauthenticated users
│   │   └── RoleRoute.tsx       ← Blocks wrong roles per route
│   │
│   ├── store/
│   │   └── ui.store.ts         ← Zustand store for UI state (sidebar, filters)
│   │
│   ├── types/
│   │   └── index.ts            ← Shared TypeScript types mirroring backend schema
│   │
│   ├── utils/
│   │   ├── axios.ts            ← Axios instance with JWT interceptor and 401 redirect
│   │   └── storage.ts          ← localStorage helper for JWT and user object
│   │
│   ├── App.tsx                 ← Root component — AuthProvider + Toaster + Router
│   ├── index.css               ← Tailwind import + custom design tokens
│   └── main.tsx                ← React entry point + TanStack QueryClientProvider
│
├── index.html                  ← HTML entry + Google Fonts
├── vite.config.ts              ← Vite config, Tailwind plugin, API proxy, @ alias
├── tsconfig.json               ← TypeScript config with @ path alias
└── package.json
```

---

## Key Concepts

### 1. Role-Based Routing
Every user has one of 6 roles from the backend:
`PLATFORM_SUPER_ADMIN` | `PLATFORM_SUB_ADMIN` | `TENANT_SUPER_ADMIN` | `TENANT_SUB_ADMIN` | `DRIVER` | `CUSTOMER`

After login the JWT contains the role. The router reads it and redirects the user to **their own dashboard automatically**. A driver can never see an admin page — `RoleRoute` blocks it with a 403.

### 2. AuthContext
Stores the logged-in user and JWT token in React context AND in `localStorage` so the user stays logged in across page refreshes. On logout it clears both.

### 3. Axios Interceptors
Two interceptors are configured globally:
- **Request interceptor** — automatically attaches `Authorization: Bearer <token>` to every API call. You never manually add the token.
- **Response interceptor** — if the server returns a 401 (token expired/invalid), it automatically clears storage and redirects to `/login`.

### 4. TanStack Query
Replaces manual `useState` + `useEffect` for fetching data. Benefits:
- Automatic loading and error states
- Caches responses — navigating back to a page doesn't refetch unnecessarily
- Background refetch when user tabs back into the window
- Easy pagination for large tables (drivers list, deliveries list)
- `staleTime: 30s` configured globally — data is considered fresh for 30 seconds

### 5. Zustand
Lightweight alternative to Redux for **client-side** UI state (what's open, what's selected, filter values). Used for sidebar open/closed, active filters, modal states. Does NOT store server data — that's TanStack Query's job.

### 6. React Hook Form + Zod
Forms use React Hook Form to avoid re-rendering the whole form on every keystroke. Zod defines the validation schema (required fields, min length, email format, password match) and is connected via `@hookform/resolvers`. Each field only re-renders when its own value changes.

### 7. Tailwind CSS v4 (Vite Plugin)
Using the new `@tailwindcss/vite` plugin — no `tailwind.config.ts` or PostCSS config needed. Custom design tokens (colors, fonts) are defined in `index.css` using the `@theme {}` block. All custom colors from the Stitch design system are registered there.

### 8. Vite API Proxy
In development, calls to `/api/...` are proxied to `http://localhost:3000` by Vite. This means:
- No CORS errors in development
- The frontend never hardcodes the backend URL
- In production, point `VITE_API_URL` to the deployed backend

### 9. HTML → TSX Conversion Rules
When converting Stitch HTML designs to React components:
- `class` → `className`
- `for` → `htmlFor`
- `onclick` / `onsubmit` → React event handlers (`onClick`, `onSubmit`)
- Inline JS → React `useState` / `useEffect`
- `<a href="#">` → `<Link to="...">` from react-router-dom
- `viewbox` → `viewBox` (SVG attribute)
- `style="font-variation-settings: '...'"` → `style={{ fontVariationSettings: "'...'" }}`
- `data-icon` attributes → remove (Material Symbols uses text content, not data attributes)

---

## Running the Frontend

```bash
cd admin-dashboard
npm install       # install dependencies
npm run dev       # start dev server on port 5173
```

Make sure the backend is also running on port 3000 before making API calls.

---

## Auth Routes

| URL | Page | Who uses it |
|---|---|---|
| `/login` | Login | All roles |
| `/onboard` | Company Registration | New logistics company owners (TENANT_SUPER_ADMIN) |
| `/register` | User Registration | Drivers and Customers |
| `/forgot-password` | Forgot Password | All roles |

## Protected Dashboard Routes (auto-redirected by role after login)

| URL | Dashboard | Role |
|---|---|---|
| `/platform/dashboard` | Platform Owner Dashboard | PLATFORM_SUPER_ADMIN, PLATFORM_SUB_ADMIN |
| `/tenant-owner/dashboard` | Tenant Super Admin Dashboard | TENANT_SUPER_ADMIN |
| `/tenant-staff/dashboard` | Tenant Sub Admin Dashboard | TENANT_SUB_ADMIN |
| `/driver/dashboard` | Driver App | DRIVER |
| `/customer/dashboard` | Customer App | CUSTOMER |

---

## Environment Variables

Create a `.env` file in `admin-dashboard/`:

```env
VITE_API_URL=http://localhost:3000
```

In production replace with your deployed backend URL.
