  # Backend Learning Notes & Concepts

This document acts as a repository of technical concepts, design decisions, and architectural notes for reference as we build this logistics platform.

---

## 1. Authentication Request Lifecycle

Below is the execution flow of a standard request to the Auth module:

```mermaid
graph TD
    Client[Client Request] --> Routes[Route Handler <br/> auth.routes.ts]
    Routes --> Validator[Zod Validator Middleware <br/> auth.validator.ts]
    Validator -->|Validation Fails| Res400[HTTP 400 Bad Request]
    Validator -->|Validation Passes| Controller[Auth Controller <br/> auth.controller.ts]
    Controller --> Service[Auth Service <br/> auth.service.ts]
    Service --> Database[(Prisma / Postgres Database)]
```

### Flow Breakdown
1. **Routes ([auth.routes.ts](file:///c:/Users/idund/Documents/MyLogisticsplatform/backend/src/api/v1/modules/auth/auth.routes.ts))**: Matches the incoming request endpoint (e.g., `/register`, `/login`) and maps it to the validation middleware and controller action.
2. **Validator ([auth.validator.ts](file:///c:/Users/idund/Documents/MyLogisticsplatform/backend/src/api/v1/modules/auth/auth.validator.ts))**: Uses Zod to check if the payload shape and fields (like email format and password strength) are correct. If incorrect, it immediately returns a `400 Bad Request` to keep garbage data out of the backend.
3. **Controller ([auth.controller.ts](file:///c:/Users/idund/Documents/MyLogisticsplatform/backend/src/api/v1/modules/auth/auth.controller.ts))**: Glues HTTP to our business logic. It reads headers, body, and query parameters, calls the service layer, and translates service returns (or errors) into HTTP responses like `200 OK`, `201 Created`, or `401 Unauthorized`.
4. **Service ([auth.service.ts](file:///c:/Users/idund/Documents/MyLogisticsplatform/backend/src/api/v1/modules/auth/auth.service.ts))**: Contains the pure business logic (checking duplicates, hashing passwords, generating tokens, and writing to the database).

---

## 2. Preventing Password Hash Leakage (Prisma Select vs. Destructuring)

When querying a user from the database, we must ensure the `password` field (which contains the hash) is not accidentally returned to the client.

### Approach 1: Destructuring (Javascript Level)
We query the entire record, then strip out the password using JavaScript destructuring:
```typescript
const user = await prisma.user.create({ data });
const { password: _, ...userWithoutPassword } = user;
return userWithoutPassword;
```
* **Pros**: Automatically includes any new fields added to the schema.
* **Cons**: The sensitive password hash is still loaded into Node.js server memory and travels over the network from the database.

### Approach 2: Prisma `select` (Database Level) — *Production Standard*
We instruct Prisma to construct a SQL query that retrieves only specific columns:
```typescript
const user = await prisma.user.create({
  data,
  select: {
    id: true,
    email: true,
    role: true,
    createdAt: true
  }
});
```
* **Pros**: The password hash **never** leaves the database engine. It never enters Node.js memory. TypeScript dynamically sets the type of the returned object to omit the `password` field, giving compile-time protection.
* **Cons**: If new fields are added to the table, they must be manually added to the `select` statement.

> [!NOTE]
> **Exception for Login**: During login, we *must* query the `password` field from the database to compare it using `bcrypt.compare`. After the password is verified, we then strip it out before returning the response.

---

## 3. How Bcrypt Password Verification Works

Since password hashing is a **one-way function**, we cannot decrypt a hash to see the original password. Bcrypt solves this through salt embedding and constant-time verification.

### Anatomy of a Bcrypt Hash
```
$2b$12$R9h/lIP3NgbpcG4y3wBuGuC5vCg4v.L.2X2rJ3P4aM9eT5G6gH1i2
 └───┘ └───┘ └────────────────────┘ └────────────────────────┘
 Version Cost         Salt                   Hashed Password
```

* **Version (`$2b$`)**: The format of the bcrypt algorithm.
* **Cost Factor (`12`)**: Represents $2^{12}$ (4,096) hashing rounds. This intentional slowness makes brute-forcing computationally expensive.
* **Salt (`R9h/lIP3NgbpcG4y3wBuGu`)**: A unique random string prepended to the password before hashing. Even if two users have the same password, they will have completely different salts, resulting in unique hashes.

### The Verification Steps
1. User logs in with a plain-text password.
2. `bcrypt.compare()` reads the stored hash and extracts the **Version**, **Cost Factor**, and **Salt**.
3. It hashes the user's input password using the exact same **Salt** and **Cost Factor**.
4. It checks if the newly generated hash matches the stored hash using a **constant-time algorithm** (comparing every character of the string to prevent timing-based profiling).

---

## 4. Understanding Timing Attacks (Timing-Based Profiling)

A **Timing Attack** is a side-channel attack where an attacker guesses a secret string (like a password hash or API token) by measuring how many milliseconds the server takes to respond to different inputs.

### The Vulnerability: Short-Circuit Comparison
Normally, standard string comparison (`stringA === stringB`) optimizes performance by stopping immediately (**short-circuiting**) on the first mismatched character.
* Comparing `"x123"` to `"abcd"` fails on character 1 $\rightarrow$ stops instantly.
* Comparing `"abc1"` to `"abcd"` fails on character 4 $\rightarrow$ compares 4 characters before stopping.

By sending thousands of requests and profiling response times down to nanoseconds, an attacker can determine how many characters of their guess were correct. They can guess a hash character-by-character rather than brute-forcing the whole string.

### The Defense: Constant-Time Comparison
`bcrypt` and other secure cryptography libraries compare strings by checking every character regardless of where a mismatch occurs.
* Comparing `"x123"` takes the exact same CPU cycles as comparing `"abc1"`.
* This renders timing-based profiling useless because response times remain completely identical.

---

## 5. Walkthrough of Applied Code Changes

Here is the breakdown of the exact changes we introduced to secure our authentication module:

### A. Service Layer Changes ([auth.service.ts](file:///c:/Users/idund/Documents/MyLogisticsplatform/backend/src/api/v1/modules/auth/auth.service.ts))

We modified both registration and login processes to handle security boundaries:

#### 1. In `register(data: RegisterDTO)`:
* **The Prisma Query:** Instead of retrieving the entire database row, we tell Prisma to perform a selective query:
  ```typescript
  const user = await prisma.user.create({
    data: { ... },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true
    }
  });
  ```
  This implements **Method B** (Database-level protection). The password hash is stored safely but never returned to the server memory.
* **Token Generation:** We call `const token = generateToken(user)` to generate a JWT token immediately.
* **Return Type:** We change the return payload to `return { user, token }`.

#### 2. In `login(data)`:
* **Password Verification:** Since we must check the password hash, we retrieve the full user record (including the hash) from the database and verify it with `bcrypt.compare`.
* **Sanitization:** Once authenticated, we strip the password out using rest/spread destructuring:
  ```typescript
  const { password: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, token };
  ```
  This ensures the hashed password is never returned to the controller.

---

### B. Controller Layer Changes ([auth.controller.ts](file:///c:/Users/idund/Documents/MyLogisticsplatform/backend/src/api/v1/modules/auth/auth.controller.ts))

We updated the API response handling:

#### 1. In `register(req, res)`:
* **Destructuring the Service Return:** We update how we call the service, expecting both user data and a token:
  ```typescript
  const { user, token } = await authService.register(req.body);
  ```
* **Returning the Token:** We add `token` to the final JSON response:
  ```typescript
  res.status(201).json({
    status: "success",
    data: {
      user: { ... },
      token // Sent to the client so they are logged in right after signing up
    }
  });
  ```

---

## 6. Authentication & Authorization Middlewares ([auth.middleware.ts](file:///c:/Users/idund/Documents/MyLogisticsplatform/backend/src/api/v1/middlewares/auth.middleware.ts))

We created the centralized middleware file to protect our API endpoints. It implements two core middlewares:

### A. The TypeScript Type Extension (`declare global`)
Express's default `Request` object does not have a `user` property. In order to store the authenticated user on the request object (`req.user = ...`) without TypeScript compiler errors, we extended the Express interface:
```typescript
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
      };
    }
  }
}
```

### B. Authentication Middleware (`authenticate`)
This middleware runs on any protected route to verify the caller's identity:
1. Grabs the `Authorization` header and checks for the standard `Bearer <token>` format.
2. Uses `jwt.verify()` to validate the token against our `JWT_SECRET`.
3. Decodes the user data (`userId` and `role`) and attaches it directly to the request object as `req.user`.
4. Calls `next()` to hand off execution to the next function. If validation fails, it stops the request immediately with a `401 Unauthorized` response.

### C. Authorization Middleware (`authorize(allowedRoles)`) — *Understanding Currying*
To pass arguments (like `allowedRoles`) to our route middleware, we use **Currying**.

#### What is Currying?
Currying is when you split a function that takes multiple arguments into a chain of nesting functions that take only one argument at a time.
* Instead of doing: `doSomething(A, B)`
* You do: `doSomething(A)(B)`

#### A Simple Analogy: Ordering Pizza 🍕
* **Normal Function:** You call the pizza place and say: *"Give me a large pizza with pepperoni."* (You give both arguments at the same time: size and topping).
* **Curried Function:**
  1. First, you choose the size: *"Large."* The chef prepares the large base and waits.
  2. Later, you choose the topping: *"Pepperoni."* The chef adds it and bakes the pizza.

#### How it works in our Middleware Code:
1. **First (At Startup):** We call `authorize(["ADMIN"])` (we choose the "topping" / allowed roles). The function prepares the security check and waits.
2. **Later (On Request):** When a user visits the website, Express calls the inner function with `(req, res, next)` (the "size" / request data) to check if `req.user.role` is inside the allowed roles and complete the job.

---

## 7. The Protected Test Route ([auth.routes.ts](file:///c:/Users/idund/Documents/MyLogisticsplatform/backend/src/api/v1/modules/auth/auth.routes.ts))

We added a temporary profile endpoint to verify our security setups:
```typescript
authRouter.get("/profile", authenticate, (req, res) => {
  res.status(200).json({
    status: "success",
    message: "You have accessed a protected route!",
    user: req.user,
  });
});
```

### Why we use this test route (Vividly explained):
1. **Isolates the Authentication Layer:** If we tested auth directly on a complex endpoint (e.g., `GET /deliveries`), a failure could be caused by database errors, missing schema migrations, or controller bugs. `/profile` does not use any databases—it only tests if our token validation logic is correct.
2. **Confirms Middleware Attachment:** The endpoint returns `req.user`. If the response contains our user details (ID and Role), we have visual proof that `authenticate` successfully parsed the header, verified the JWT with the secret key, and attached the data to the Express request pipeline.
3. **Validates Client Integration:** It verifies that HTTP clients (Postman, mobile apps, or frontend) are correctly formatting their headers using the `Authorization: Bearer <token>` convention.
4. **Serves as a Baseline Reference:** In the future, if you encounter route access errors on other features, you can ping `/profile` first. If it succeeds, you know the JWT authorization pipeline is healthy and the bug lies in that specific feature's controller.

---

## 8. Big O Complexity & Performance Optimization

To build a production logistics engine that can scale to handle millions of transactions, we design critical paths to run in **$O(1)$ (Constant Time)** rather than **$O(n)$ (Linear Time)**.

### A. Database Lookups ($O(1)$ via Indexes)
* **Vulnerable ($O(n)$):** Checking if an email exists by scanning every row in the user table sequentially.
* **Optimized ($O(1)$):** Using `@unique` in `schema.prisma` automatically creates a database B-Tree index. Lookups run in $O(\log n)$ (which is practically instant, $O(1)$, even with 10 million users).

### B. Route Authentication ($O(1)$ via stateless JWTs)
* **Vulnerable ($O(n)$ / high IO):** Reading sessions from a database/cache on every single HTTP request.
* **Optimized ($O(1)$):** Using stateless JWTs allows the `authenticate` middleware to verify the client token in-memory using math. It bypasses database lookup entirely.

### C. Role Authorization Checks ($O(1)$)
* Code: `allowedRoles.includes(req.user.role)`
* Since the list of application roles (Customer, Driver, Admin) is tiny and does not scale with server traffic, checking access takes a constant fraction of a microsecond.

### D. The Exception: Password Hashing (Intentional Slowness)
* While we strive for $O(1)$ speed everywhere, password hashing is an exception.
* We use `bcrypt.hash(password, 12)` with a cost factor of 12 (running $2^{12}$ rounds) to intentionally delay execution (100–300ms). This stops brute-force attacks by making it too slow/expensive for a computer to test millions of password guesses.

---

## 9. Local API Testing ([auth.test.http](file:///c:/Users/idund/Documents/MyLogisticsplatform/backend/src/api/v1/modules/auth/auth.test.http))

Rather than opening an external tool (like Postman), we use the **VS Code REST Client** extension (`humao.rest-client`) to run and document our API requests directly inside our IDE.

### Syntax Rules in `.http` Files:
1. **Variables (`@name = value`):** Declares a reusable value (e.g., `@baseUrl = http://localhost:3000`). It is accessed using double curly braces: `{{baseUrl}}`.
2. **Request Separator (`###`):** Separates individual HTTP requests so the extension knows where one ends and the next begins.
3. **Headers:** Placed directly underneath the request line (e.g., `Content-Type: application/json` or `Authorization: Bearer {{token}}`).
4. **Body:** Placed after a single blank line following the headers.

### Steps to Run the Test Plan:
1. Spin up the dev server: `npm run dev`.
2. Open **[auth.test.http](file:///c:/Users/idund/Documents/MyLogisticsplatform/backend/src/api/v1/modules/auth/auth.test.http)**.
3. Click the **Send Request** button that appears above **TEST 1: Register**.
4. Copy the long `token` string returned in the JSON payload on the right.
5. In **TEST 4: Access Profile**, replace `YOUR_COPIED_TOKEN_HERE` with your token:
   ```http
   @authToken = ey...
   ```
6. Click **Send Request** above **TEST 4** to verify the authenticated response (`200 OK` showing user data).
7. Click **Send Request** above **TEST 3** (without token) to verify it gets blocked (`401 Unauthorized`).

---

## 10. Multi-Tenancy Architecture & Prisma Transactions

We transformed our database to support multiple independent logistics companies (tenants) from a single server.

### A. Core Architecture
Every table that represents data belonging to a tenant (like `User`, `Delivery`, and `DriverProfile`) now contains a required `tenantId` field pointing to the `Tenant` table:

```
Tenant (e.g., Swift Dispatch) 
  ├── User (Admin / Customers / Drivers) ──> tenantId
  └── Delivery (Shipments) ────────────────> tenantId
```

### B. Database Transaction Design (`prisma.$transaction`)
When onboarding a new logistics company, we must do two things:
1. Create a `Tenant` record.
2. Create an admin `User` record linked to that tenant.

If we write these as separate database calls, and the second step fails (e.g., the admin email is already registered), we would have created a "ghost tenant" with no admin user. 

To prevent this, we use **Prisma Transactions**:
```typescript
const result = await prisma.$transaction(async (tx) => {
  const tenant = await tx.tenant.create({ ... });
  const admin = await tx.user.create({ ... });
  return { tenant, admin };
});
```
* **Atomicity:** All database statements within `$transaction` are executed together as a single unit. If any statement throws an error, the database engine **rolls back** everything, keeping our data clean.

### C. Stateless Tenant Context (JWT Signing)
To ensure our API remains highly performant ($O(1)$ database-free authentication), we sign the user's `tenantId` directly into their JWT payload when they register or log in. 
Our `authenticate` middleware decodes this token and attaches `req.user.tenantId` to the request object, allowing all downstream routes to filter queries by the correct company.

---

## 11. Google OAuth2 Integration (API-First Architecture)

When implementing Social Login (Google Sign-In) for a modern, multi-tenant logistics platform, we choose **Stateless ID Token Verification** over traditional redirect frameworks like **Passport.js**.

### Why We Avoid Passport.js
1. **Designed for Server-Rendered Apps:** Passport relies on page redirects, which are difficult and clunky to implement inside mobile applications (like React Native/Flutter).
2. **Session-Heavy:** Passport is built around cookies and database sessions, which contradicts our stateless, high-performance JWT architecture.

### The Modern API-First Flow
Instead of handling redirects on the server, we delegating the sign-in prompt to the frontend or mobile app and verify it on the backend:

1. **Client Sign-In:** The mobile app or web portal opens the Google sign-in dialog using the Google Client SDK and receives a signed `id_token` from Google.
2. **Backend Verification:** The client sends this `id_token` to the backend via `POST /auth/google`.
3. **Stateless Verification:** The backend uses the official **`google-auth-library`** to cryptographically verify the token's validity in-memory ($O(1)$):
   ```typescript
   import { OAuth2Client } from "google-auth-library";
   const client = new OAuth2Client(CLIENT_ID);
   
   const ticket = await client.verifyIdToken({
     idToken: token,
     audience: CLIENT_ID,
   });
   const payload = ticket.getPayload(); // Contains verified email, name, picture
   ```
4. **Database Check & Login:** The backend checks if the email is associated with a user under the current tenant. If yes, it logs them in; if no, it registers them automatically. Finally, it signs and returns our custom stateless JWT session token.

---

## 12. Industry-Specific Multi-Tenancy Design

We expanded the platform to support tenant classification based on 8 core industries: **Food, Health, Transport, Fashion, Sport, Entertainment, Banking, and Others**.

### Step-by-Step Code Execution Flow

The workflow of registering a new tenant with an associated industry is structured to enforce strong type boundaries and database atomicity:

```mermaid
graph TD
    Client[Client Request POST /api/v1/tenants/onboard] --> Validator[Zod Schema Validator <br/> tenant.validator.ts]
    Validator -->|Invalid Industry / Fields| Err400[HTTP 400 Bad Request]
    Validator -->|Success| Controller[Tenant Controller <br/> tenant.controller.ts]
    Controller --> Service[Tenant Service <br/> tenant.service.ts]
    Service --> Hash[Hash Admin Password <br/> bcrypt]
    Hash --> Tx[Prisma $transaction]
    Tx --> DB_Tenant[Create Tenant record with Industry]
    Tx --> DB_User[Create Admin User linked to Tenant]
    Tx --> DB_Success[Return Tenant & Admin]
    DB_Success --> Token[Generate JWT Auth Token]
    Token --> Res201[HTTP 201 Created Response]
```

### Deep Dive of Implementation Details

1. **Database Schema ([schema.prisma](file:///c:/Users/idund/Documents/MyLogisticsplatform/backend/prisma/schema.prisma))**:
   An `Industry` enum is defined mapping to our 8 core industries. The `Tenant` model holds a required `industry` field of type `Industry` with a default of `OTHERS` to ensure compatibility.
   ```prisma
   enum Industry {
     FOOD
     HEALTH
     TRANSPORT
     FASHION
     SPORT
     ENTERTAINMENT
     BANKING
     OTHERS
   }
   ```

2. **TypeScript DTOs ([tenant.types.ts](file:///c:/Users/idund/Documents/MyLogisticsplatform/backend/src/api/v1/modules/tenant/tenant.types.ts))**:
   Extends `OnboardTenantDTO` to make the `industry` parameter type-safe at compile-time:
   ```typescript
   export interface OnboardTenantDTO {
     companyName: string;
     subdomain: string;
     industry: "FOOD" | "HEALTH" | "TRANSPORT" | "FASHION" | "SPORT" | "ENTERTAINMENT" | "BANKING" | "OTHERS";
     adminEmail: string;
     adminPassword: string;
   }
   ```

3. **Zod Validator Middleware ([tenant.validator.ts](file:///c:/Users/idund/Documents/MyLogisticsplatform/backend/src/api/v1/modules/tenant/tenant.validator.ts))**:
   Uses `z.enum` to strictly enforce the industry selection at the entry boundary. If a client sends an unsupported industry value, the request is rejected with `400 Bad Request` before calling any downstream database functions.
   ```typescript
   industry: z.enum(["FOOD", "HEALTH", "TRANSPORT", "FASHION", "SPORT", "ENTERTAINMENT", "BANKING", "OTHERS"], {
     errorMap: () => ({ message: "Industry must be one of: FOOD, HEALTH, TRANSPORT, FASHION, SPORT, ENTERTAINMENT, BANKING, OTHERS" }),
   })
   ```

4. **Service Transaction ([tenant.service.ts](file:///c:/Users/idund/Documents/MyLogisticsplatform/backend/src/api/v1/modules/tenant/tenant.service.ts))**:
   The service extracts the validated `industry` from the request body and passes it to the `tx.tenant.create` statement within the Prisma `$transaction` block. This guarantees that either both the industry-specific Tenant and its Admin user are created successfully, or the entire operation is rolled back, preventing orphaned users or ghost tenants.
   ```typescript
   const tenant = await tx.tenant.create({
     data: {
       companyName,
       subdomain,
       industry,
     },
   });
   ```

5. **Test Specification ([tenant.test.http](file:///c:/Users/idund/Documents/MyLogisticsplatform/backend/src/api/v1/modules/tenant/tenant.test.http))**:
   Updated requests to verify that sending requests to `/tenants/onboard` creates a new tenant under their correct industry classification (e.g. `"industry": "FOOD"`).

---

## 13. Production Database Security Best Practices (PostgreSQL)

When moving a PostgreSQL database (configured via Prisma) into a production SaaS environment, securing the data tier is paramount. Below are the key security principles, implementation tactics, and architectural setups.

### A. Network Isolation & Firewall Boundaries
The database must never be exposed to the public internet. It should reside inside a private network subnet.

```mermaid
graph LR
    Internet[Public Internet] --> API[Express Backend <br/> Public Subnet]
    API -->|Port 5432 <br/> Private VPC Routing| DB[(PostgreSQL <br/> Private Subnet)]
    Internet -.->|Blocked| DB
```

* **Best Practice:** 
  1. Place the database server in a **Private Subnet** within a Virtual Private Cloud (VPC).
  2. Implement firewall rules (e.g., Security Groups) that restrict inbound traffic on port `5432` to the exact IP address or Security Group of your Node.js application server.

### B. Principle of Least Privilege (PoLP)
Avoid running the production backend using the default `postgres` superuser role. If the Node.js application is compromised, the attacker would have full destructive control over the database server.

* **Roles Separation:**
  1. **Migration User (`migration_user`):** Has DDL privileges (`CREATE TABLE`, `ALTER TABLE`) to perform schema changes during CI/CD deployment.
  2. **Application User (`app_user`):** Only has DML privileges (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) on the application tables. It cannot drop tables or modify schema structures.

### C. Row-Level Security (RLS) for SaaS Multi-Tenancy
Because this is a multi-tenant platform, one tenant's database query must never leak into another tenant's session. RLS acts as a database-level fail-safe.

* **Implementation:**
  Even if the backend application fails to apply a `where: { tenantId }` filter due to a developer oversight, a PostgreSQL RLS policy intercepts the query and automatically scopes results based on the session's active tenant identifier:
  ```sql
  CREATE POLICY tenant_isolation_policy ON "Delivery"
  USING (tenant_id = current_setting('app.current_tenant_id'));
  ```

### D. Enforced SSL/TLS in Transit
Ensure all connections encrypt database credentials and queries to prevent sniffing attacks on the network wire.

* **Connection Parameters:** Use strict verification parameters in the production `.env` configuration:
  ```env
  DATABASE_URL="postgresql://user:password@db-host:5432/dbname?sslmode=verify-full&sslrootcert=ca.pem"
  ```
  * `sslmode=verify-full` verifies the identity of the database host to prevent Man-in-the-Middle (MitM) attacks.

### E. Connection Pooling (PgBouncer)
PostgreSQL handles requests using a process-based connection model. Each client connection consumes memory and CPU. 

* **Best Practice:** Place **PgBouncer** (or Prisma Accelerate) between the app server and database. The pooler holds a persistent stack of connections, multiplexing hundreds of incoming client queries onto a few database processes, preventing connection exhaustion and DDoS events.

### F. Security Lifecycle Matrix

| Security Vector | Development Mode | Production Mode (Launch Ready) |
| :--- | :--- | :--- |
| **Network Visibility** | Publicly accessible (localhost) | Private VPC, public port 5432 blocked |
| **DB Role Privileges** | Database Superuser (`postgres`) | Restricted CRUD-only `app_user` |
| **Data Encryption** | Disabled / Optional SSL | Forced SSL (`sslmode=verify-full`) |
| **Secrets Management** | `.env` file on local disk | Cloud Environment Secret Manager / Vault |
| **Backup Encryption** | Unencrypted backups | Encrypted snapshots (AES-256 via KMS) |

---

## 14. Driver Profile & Verification System (1:1 Relationship Design)

We implemented the Driver Management module using a 1-to-1 relationship schema, adding state-based status toggles and administrative workflows secured by role boundaries and tenant isolation.

### A. One-to-One Relationships in Prisma
In the database schema, a `User` record can optionally have one linked `DriverProfile` record. This separates auth credentials from physical driver data.

```
+--------------------+              +------------------------+
|        User        |  (1:0..1)    |     DriverProfile      |
|  - id              |------------->|  - id                  |
|  - email           |              |  - userId (Unique FK)  |
|  - role = "DRIVER" |              |  - vehicleType         |
|  - tenantId        |              |  - isVerified          |
+--------------------+              +------------------------+
```

Prisma enforces this 1-to-1 relationship via the `@unique` constraint on the foreign key field `userId` within the `DriverProfile` model:
```prisma
model DriverProfile {
  id            String     @id @default(uuid())
  userId        String     @unique
  user          User       @relation(fields: [userId], references: [id])
  vehicleType   String     // BIKE, VAN, TRUCK, CAR
  licenseNumber String
  isVerified    Boolean    @default(false)
  isOnline      Boolean    @default(false)
}
```

### B. Tenant Isolation in Business Logic
Because users can register and login as drivers, and admins manage lists and verifications, our controller and services must enforce tenant separation constraints:

1. **Creating a Profile:** When a user registers a driver profile, the service ensures the target user exists, has `role === "DRIVER"`, belongs to the same tenant (`req.user.tenantId`), and does not already have an active profile.
2. **Accessing/Updating Profile:** In `getProfile` and `updateProfile`, queries use an `include: { user: true }` statement to check that the driver's associated tenant ID matches the caller's session token `tenantId`.
3. **Admin Actions (List & Verification):** 
   - An admin fetching the list of drivers will only retrieve profiles whose parent user matches the admin's `tenantId`.
   - When an admin verifies a driver, the backend loads the driver profile, checks that `profile.user.tenantId === admin.tenantId`, and updates `isVerified` only if they match. Attempting to verify a driver from a different company returns a validation error.

### C. Sequential Route Access Rules

```mermaid
sequenceDiagram
    actor Driver as Driver Client
    actor Admin as Admin Client
    participant API as Express Router
    participant Service as Driver Service
    participant DB as Postgres DB

    Driver->>API: POST /drivers/profile (Auth Token)
    API->>API: Validate input (Zod)
    API->>API: Check Role (DRIVER)
    API->>Service: createProfile(userId, tenantId, data)
    Service->>DB: Check duplicate & Create Profile
    DB-->>Service: Profile Created
    Service-->>API: Profile Object
    API-->>Driver: 201 Created

    Admin->>API: PATCH /drivers/:id/verify
    API->>API: Check Role (ADMIN)
    API->>Service: verifyDriver(driverId, tenantId, true)
    Service->>DB: Fetch profile + Include User
    DB-->>Service: Profile & User data
    Note over Service: Verify: user.tenantId === admin.tenantId
    Service->>DB: Update isVerified = true
    DB-->>Service: Updated Profile
    Service-->>API: Success
    API-->>Admin: 200 OK
```

---

## 15. Deliveries Module & Geospatial Matching Engine

As we build the logistics platform's matching and routing system, we encounter unique challenges around API verification, coordinate geometry, state progression, and separation of concerns.

### A. Delivery Lifecycle State Machine
A delivery has several states (e.g., `PENDING`, `ASSIGNED`, `PICKED_UP`, `IN_TRANSIT`, `DELIVERED`, `CANCELLED`). Permitting free state transitions creates critical bugs (e.g., a driver marking a package as `DELIVERED` before picking it up).

We enforce a **State Machine pattern** where each transition is verified:

```mermaid
stateDiagram-v2
    [*] --> PENDING : Customer Creates Request
    PENDING --> ASSIGNED : Admin/System Assigns Driver
    PENDING --> CANCELLED : Customer Cancels Request
    ASSIGNED --> PICKED_UP : Driver Arrives & Verifies OTP
    ASSIGNED --> PENDING : Driver Rejects / Timeout (Re-queue)
    PICKED_UP --> IN_TRANSIT : Driver Starts Moving
    IN_TRANSIT --> DELIVERED : Recipient OTP Verified
    IN_TRANSIT --> CANCELLED : Lost / Damaged / Dispute
```

### B. The Strategy Pattern for Driver Assignment
Hardcoding how drivers are assigned to a delivery directly inside the delivery service violates the **Open/Closed Principle (OCP)**. If we later want to switch from "Nearest Driver" to "Driver Auctioning" or "Batch Pooling", we would have to rewrite the service.

To solve this, we define a Strategy interface:
```typescript
export interface IDriverAssignmentStrategy {
  findAndAssignDriver(deliveryId: string, tenantId: string, pickupLat: number, pickupLng: number): Promise<string | null>;
}
```
We inject this strategy into `DeliveryService`. The class using it doesn't care *how* a driver is selected; it only cares that an ID is returned.

### C. Geolocation Matching (Haversine Formula) & Big O Complexity
To find the closest online driver, we calculate the great-circle distance between the pickup location ($lat_1, lng_1$) and the driver's current coordinates ($lat_2, lng_2$).

#### The Haversine Formula:
$$d = 2r \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta lat}{2}\right) + \cos(lat_1) \cos(lat_2) \sin^2\left(\frac{\Delta lng}{2}\right)}\right)$$
*(where $r$ is the earth radius, typically $6371\text{ km}$).*

#### Time Complexity Optimization:
1. **Bad Practice - $O(N)$ CPU Search:** Loading all online drivers from the database into Node.js memory, calculating the Haversine distance for each using Javascript, and sorting them. As the driver pool grows to 10,000+, this blocks the Node.js event loop and runs in $O(N)$ time and space.
2. **Production Standard - Database-Level Indexing ($O(\log N)$ or $O(K \log N)$):** 
   - We construct a query that calculates the Haversine distance *directly inside the database engine* using SQL math libraries.
   - We filter using a **bounding box** first (a square of $\pm 10\text{km}$ around the pickup point) to prune the dataset before calculating trigonometric distance. Bounding box lookups utilize database indexes on latitude and longitude, dropping candidate counts from $N$ to a tiny subset $K$, running in logarithmic time.

### D. Cryptographically Secure Randomness (CSPRNG vs PRNG)
For features like generating a One-Time Password (OTP) for delivery verification, using the standard `Math.random()` function is a major security vulnerability.

#### The Practical Business Workflow of Delivery OTPs:
1. **Creation:** A customer requests a package delivery. The backend creates the delivery and generates a secure 6-digit OTP using `crypto.randomInt()`, storing it in the database.
2. **Customer Visibility:** The OTP is sent to the customer or displayed in their app dashboard, but is **hidden** from the driver.
3. **Driver Arrival:** The driver arrives at the dropoff destination, contacts the recipient, and asks for the OTP.
4. **Verification & Handoff:** The driver inputs the recipient's OTP into the app. The backend compares it using a constant-time check. If successful, the delivery is marked `DELIVERED`.
5. **Business Value:** Prevents delivery driver fraud (drivers marking packages as delivered and keeping them), ensures package tracking accuracy, and provides absolute proof of delivery (PoD) without requiring expensive physical paperwork.

#### PRNG (Pseudo-Random Number Generator) — e.g. `Math.random()`
* **Mechanism:** Uses a mathematical formula (like xorshift128+) starting from a seed value.
* **Vulnerability:** It is deterministic. If an attacker intercepts a series of consecutive OTPs, they can determine the algorithm's state and calculate all future OTPs. 
* **Never Use For:** OTPs, API keys, password resets, session tokens.

#### CSPRNG (Cryptographically Secure Pseudo-Random Number Generator) — e.g. Node's `crypto.randomInt()`
* **Mechanism:** Obtains entropy (true randomness) directly from the host operating system kernel (which listens to hardware noise states).
* **Security:** It is mathematically impossible to predict future values even if past outputs are known.
* **Always Use For:** Any security-sensitive values.

---

### E. The `updateStatus` Method — State Machine Engine

The `updateStatus` method is the **engine of the entire delivery lifecycle**. Every time a delivery moves from one stage to the next, this single function is called. It enforces the State Machine pattern, ensuring illegal transitions (e.g. marking a delivery `DELIVERED` before `PICKED_UP`) are rejected.

#### Why One Function Instead of Many?
Instead of having separate functions (`pickUpDelivery`, `startTransit`, `completeDelivery`), a single `updateStatus` method with **guard clauses** enforces all rules in one place. This is the **Single Responsibility Principle** applied at the service layer — one method owns and controls the entire lifecycle.

#### Real-World Business Journey:

| Step | Actor | Status Transition | Extra Data Required? |
|------|-------|-------------------|----------------------|
| 1 | System/Admin | `PENDING` → `ASSIGNED` | No — system assigns driver automatically |
| 2 | Driver | `ASSIGNED` → `PICKED_UP` | No — driver confirms package collected |
| 3 | Driver | `PICKED_UP` → `IN_TRANSIT` | No — driver confirms journey started |
| 4 | Driver | `IN_TRANSIT` → `DELIVERED` | ✅ Yes — OTP from recipient + driver GPS coordinates |
| 5 | Customer/Admin | Any → `CANCELLED` | No |

#### Why Are Some Parameters Optional?
The method signature has three optional parameters (`?`):
* `providedOtp?: string` — only required when transitioning to `DELIVERED`. Asking a driver to submit an OTP when picking up a package makes no sense.
* `actualDropoffLatitude?: number` — only captured at the moment of handoff (delivery completion).
* `actualDropoffLongitude?: number` — only captured at the moment of handoff.

Making them optional means one function handles **all five transitions** cleanly. Inside the function, guard clauses check whether they are present only when the transition requires them.

---

### F. Tenant Isolation — The Most Important Security Rule in a Multi-Tenant SaaS

Every operation in this platform checks a single line after fetching a resource:

```typescript
if (delivery.tenantId !== tenantId) throw new Error('Access Denied: Tenant Isolation Breach');
```

#### What Each Part Means:
| Part | Meaning |
|------|---------|
| `delivery.tenantId` | The company ID that **owns this delivery** (stored in the database) |
| `tenantId` | The company ID from the **current HTTP request** (who is asking) |
| `!==` | "is NOT equal to" |

#### Real-World Example:
Imagine two logistics companies on the platform:
* **Company A** — DHL Nigeria (tenantId: `"tenant-abc-123"`)
* **Company B** — Jumia Logistics (tenantId: `"tenant-xyz-999"`)

DHL creates delivery `"delivery-555"`. It is stored with `tenantId: "tenant-abc-123"`.

A Jumia driver gets that delivery ID and sends a request to update its status:
```
delivery.tenantId = "tenant-abc-123"   ← belongs to DHL
tenantId          = "tenant-xyz-999"   ← Jumia is making the request

"tenant-abc-123" !== "tenant-xyz-999"  → TRUE → throw "Access Denied"
```
Without this check, Jumia could update, cancel, or view DHL's deliveries — a catastrophic data breach. This check blocks it at every single operation.

#### Why We Check Existence BEFORE Tenant:
We always check `if (!delivery)` first, then `if (delivery.tenantId !== tenantId)`. If we reversed the order and the delivery doesn't exist, accessing `null.tenantId` would crash the server with a `TypeError`. Checking existence first guarantees the object is safe to read.

#### Interview Answer:
> *"Tenant isolation ensures that in a multi-tenant SaaS system, each client's data is completely invisible to other clients. We enforce this at the service layer by comparing the resource's stored `tenantId` against the authenticated request's `tenantId` on every single operation — never trusting the client to self-report their identity."*

---

### G. The Controller Layer (e.g. `delivery.controller.ts`) — The API Interface

The Controller layer acts as the **front door to a feature module** in this platform. It isolates the HTTP network layer (Express) from the core database/business logic (the Service layer).

#### The 4 Core Roles of a Controller:
1. **Receive and Parse HTTP Requests:** Reads inputs from headers, request body (`req.body`), or route variables (`req.params`).
2. **Secure User Session Context:** Extract the authenticated user's ID and `tenantId` directly from the request object (attached securely by the JWT authentication middleware).
3. **Delegate to the Service Layer:** Orchestrate operations by calling the corresponding asynchronous service method with the verified payload.
4. **Format API Responses:** Translate service outcomes into standardised HTTP responses:
   - **`201 Created`**: Resource was successfully created and persisted.
   - **`200 OK`**: Resource details were successfully updated or retrieved.
   - **`400 Bad Request`**: Validation rules or state machine guidelines were breached.
   - **`403 Forbidden` / `404 Not Found`**: Access violations or missing records.

#### Interview Answer:
> *"The Controller layer is responsible for translating incoming HTTP request boundaries into service layer boundaries, decoupling network details like Express `req` and `res` objects from database logic, and ensuring standardized RESTful API responses are returned to the client."*

---

## 16. Hierarchical Role-Based Access Control (HRBAC)

To support scaling from a single depot to multiple depots with independent local managers, we upgraded our database role design from a flat structure to a hierarchy.

### The New Roles System
* **`PLATFORM_SUPER_ADMIN`**: Platform Owner (controls billing, global tenants, database configurations).
* **`PLATFORM_SUB_ADMIN`**: Platform staff/support accounts.
* **`TENANT_SUPER_ADMIN`**: The single primary owner of a logistics company (e.g. DHL). Has master override privileges.
* **`TENANT_SUB_ADMIN`**: Local depot managers and dispatchers. Authorized to run daily schedules and matchings for their specific hub, but cannot delete records or perform compliance checks.
* **`DRIVER`**: Couriers.
* **`CUSTOMER`**: Senders/recipients ordering deliveries.

### Why this is Secure (Blast Radius Minimization)
If a local manager's (`TENANT_SUB_ADMIN`) account is compromised:
1. The damage is restricted to that single depot/hub.
2. The **Tenant Super Admin** retains the override capability, allowing them to audit the logs, detect fraud, and instantly revoke the compromised sub-admin's access or reset delivery states.

---

## 17. Telemetry & State Synchronization (Go Online with Location)

In a high-performance logistics system, a driver cannot be considered "active" or "online" unless the dispatch engine knows *where* they are online. 

### Implementation details:
We updated the `PATCH /drivers/online` endpoint:
* **The Request Payload**: Instead of just sending `isOnline: true`, the driver's device is now required to send their current GPS coordinates:
  ```json
  {
    "isOnline": true,
    "latitude": 6.5244,
    "longitude": 3.3792
  }
  ```
* **Validation Check**: The inputs pass through Zod schema validation to verify coordinate ranges (`-90` to `90` for latitude, `-180` to `180` for longitude) before updating the database.
* **Why it works**: By coupling coordinates with the online status state-transition, we prevent "ghost drivers" (drivers marked online but having null locations, which would crash or break the distance calculations in our Haversine SQL query).

---

## 18. End-to-End Delivery Lifecycle Validation

We successfully verified the entire logistics pipeline via REST client test scripts:

```mermaid
sequenceDiagram
    actor Customer as Customer Client
    actor System as Dispatch Engine
    actor Driver as Driver Client
    actor Admin as Admin Client

    Customer->>System: POST /deliveries (Lagos coordinates)
    Note over System: Runs Nearest Driver Strategy <br/> (Haversine Formula SQL Check)
    System-->>Customer: 201 Created (Status: ASSIGNED, Driver Linked)
    Driver->>System: PATCH /deliveries/:id/status (Status: PICKED_UP)
    System-->>Driver: 200 OK (Status: PICKED_UP)
    Driver->>System: PATCH /deliveries/:id/status (Status: IN_TRANSIT)
    System-->>Driver: 200 OK (Status: IN_TRANSIT)
    Driver->>System: PATCH /deliveries/:id/status (Status: DELIVERED, OTP: 701088)
    Note over System: Verifies secure OTP & GPS coords
    System-->>Driver: 200 OK (Status: DELIVERED, actualDropoff saved)
```

---

## 19. Scalability, BullMQ, and Background Processing (1000+ Concurrent Users)

To safely launch our MVP to support 1,000+ concurrent active users without database lockups or memory leaks, we design the backend around asynchronous queuing.

### The Bottleneck Strategy: Memory Promises vs. Redis Queues

#### A. In-Memory "Fire-and-Forget" (The Risk ❌)
```typescript
this.matchingStrategy.findAndAssignDriver(...)
```
* **Vulnerability**: If 1,000 users request deliveries simultaneously, the server runs 1,000 concurrent database calculations. This slams Postgres CPU to 100%. If the Node process restarts during matching, the in-memory promise is lost forever, leaving the delivery stuck in `PENDING`.

#### B. Redis-Backed Queues (BullMQ 🚀)
```typescript
await deliveryQueue.add('MATCH_DRIVER', { deliveryId, tenantId, ... })
```
* **Resilience**: The job is serialized and persisted to Redis. Even if the Node API server restarts, the job is safe. A background Worker consumes jobs one by one or in batches (e.g. concurrency limit of 10), ensuring Postgres CPU is never slammed.

### 3-Tier Production Safety Blueprint

| Bottleneck Vector | The Threat | Our Production Defense |
|---|---|---|
| **Database Connections** | 1,000 concurrent users exhaust Postgres slot limits, crashing the engine. | **Prisma Connection Pooling**: Capping database pool size (e.g. 30 connections) and queueing SQL execution internally. |
| **High CPU Tasks** | Bcrypt password comparisons during login freeze Node's single thread. | **Stateless JWT Sessions**: Validating users cryptographically in-memory without hits to database or CPU-heavy hashes. |
| **Heavy Computation** | Running geospatial Haversine calculations concurrently. | **Geospatial Bounding Box** + **BullMQ Rate Limiting**: Pruning datasets using bounding boxes, and rate-limiting job worker execution. |

---

## 20. Competitive Strategy & Market Differentiators (Vs. Ride Flow)

To outcompete established Nigerian B2B logistics SaaS platforms like Ride Flow, our system focuses on active decision engine intelligence and operational resilience.

### Strategic Comparison Matrix

| Differentiator Area | Legacy SaaS (e.g., Ride Flow) | Our B2B Logistics Platform |
|---|---|---|
| **Operations Analysis** | **Passive Data Recorder**: Shows metrics after the fact (e.g., "15 delayed deliveries today"). Manager must investigate why. | **Active Decision Engine**: Correlates variables to highlight root cause (e.g., *"Vehicle X has missed maintenance twice and is linked to 42% of Lekki route delays"*). |
| **User Experience (UX)** | **One-Size-Fits-All**: Identical dashboard for pharmaceuticals, beverage distributors, and cold-chain fleets. | **Industry-Tailored (Domain Isolation)**: Reads tenant `Industry` classification (e.g. `HEALTH` vs `FOOD`) to adapt KPI configurations. |
| **System Reliability** | **In-Memory Matching**: Driver searches executed directly in HTTP requests. Risky under high concurrent spikes. | **Persistent Queuing (BullMQ)**: Driver matches pushed to Redis queues with exponential retry loops and concurrency limits. |
| **Security Context** | **Flat Access Control**: Basic admin/driver roles. A hacked dispatcher account exposes the entire nationwide enterprise database. | **Hierarchical Context (HRBAC)**: Restricted sub-admin scopes. Compromised depot accounts are isolated to their specific local hub boundaries. |

---

## 21. Multi-Tenant Role Workflows & Dashboard Hierarchy

In our B2B SaaS logistics model, we sandbox data and customize dashboards depending on three primary tiers of administrative access.

```mermaid
graph TD
    PSA["Platform Super Admin<br/>(SaaS Owner)"] -->|Manages Accounts/Billing| TSG["Tenant Super Admin<br/>(Corporate Owner)"]
    TSG -->|Hires Staff/Registers| TSU["Tenant Sub-Admin<br/>(Local Dispatcher)"]
    TSU -->|Manages Deliveries| DRV["Drivers / Vehicles"]
```

### A. Team Onboarding Lifecycle (e.g., Jumia Logistics)
1. **Onboarding**: A new company registers. The backend creates a `Tenant` record (`tenantId: "jumia-xyz"`) and a primary user account assigned the role `TENANT_SUPER_ADMIN`.
2. **Staff Registration**: The Super Admin logs in, navigates to "Manage Team", and invites a dispatcher (e.g., Emeka).
3. **Automatic Sandbox**: The API endpoint registers the dispatcher's account, automatically forcing their user record's `tenantId` to match `"jumia-xyz"`. The dispatcher is permanently sandboxed to that tenant.

### B. Dashboard Access Hierarchy

| Dashboard Tier | Target User | Primary Capabilities & Focus |
|---|---|---|
| **Platform Dashboard** | `PLATFORM_SUPER_ADMIN` (You, the SaaS Owner) | Global billing/invoices, database & server monitoring, suspension of delinquent tenants, system configurations. |
| **Corporate Owner Dashboard** | `TENANT_SUPER_ADMIN` (Company Owner/Head of Operations) | Financial metrics (costs vs profit), hiring/firing dispatchers and drivers, subscription payments, tenant-wide config adjustments. |
| **Dispatcher Dashboard** | `TENANT_SUB_ADMIN` (Daily Coordinator/Emeka) | Real-time map tracking, handling delivery queues, manual matching overrides, checking vehicle maintenance states. |

### C. The Lagos Factors: Nigerian Logistics Reality
To ensure we don't penalize drivers for delays beyond their control (heavy traffic, checkpoint delays, fuel scarcity), our decision engine utilizes three features:
1. **Incident Logging**: A mobile app button allowing drivers to flag delays (e.g. `POLICE_CHECKPOINT`, `TRAFFIC`). This attaches a flag to the delivery record and pauses personal SLA penalties.
2. **Route-Based Baselines**: Dynamic SLAs calculated on past data per route (e.g., average Lekki to Ikeja on a Friday is 2 hours, so 1.5 hours is not flagged as late).
3. **Route Anomaly Detection**: If multiple drivers on the same route are simultaneously late, the system flags the *route* as congested rather than individual drivers.

---

## 22. Production-Grade Rate Limiting & API Security Blueprint

Rate limiting is a core defense mechanism to prevent Denial of Service (DoS) attacks, brute-force security breaches, and backend resource exhaustion. In our multi-tenant logistics decision engine, we apply tailored limits depending on the resource footprint and security profile of each endpoint.

### A. The 7 Rate-Limiting Tiers (Configurations & Justifications)

| Endpoint Type | Recommended Rate Limit | Key Identifier | Engineering Justification |
|---|---|---|---|
| **1. Login** | 5 requests per minute | **IP Address** | Prevents automated scripts from brute-forcing user passwords. The 1-minute window resetting allows real users who made typos to retry quickly without long lockouts. |
| **2. Register** | 5 requests per hour | **IP Address** | Prevents malicious bots from spamming your database with thousands of fake user and tenant accounts, saving database storage and computational resources. |
| **3. Password Reset** | 3 requests per hour | **IP Address** | Prevents attackers from spamming a user's email inbox with reset links (email bombing) and protects the mail server quota. |
| **4. General API** | 100 requests per minute | **User ID** (with IP fallback) | Protects regular CRUD routes (creating deliveries, updating profiles) from automated loops. 100 req/min is more than enough for a fast human, but blocks scrapers. |
| **5. Dashboard/Reads** | 300 requests per minute | **User ID** (with IP fallback) | Protects the database from heavy aggregate queries (which run 12 queries simultaneously in `Promise.all`). Higher limit accommodates auto-refresh dashboard polling. |
| **6. Vehicle Location** | 120 requests per minute | **Driver User ID** | Accommodates live GPS tracking updates (averaging 1-2 pings per second from the driver app) while preventing buggy loops from flooding the socket/DB layer. |
| **7. Webhooks** | 1,000 requests per minute | **IP Address** | Webhooks from trusted systems (like Paystack payment notifications) are triggered in bulk by external servers. Must be high to prevent dropping payments, but secured via cryptographic signature verification. |

### B. Core Technical Design Decisions

#### 1. User-ID Based Limiting vs. IP Limiting
Using a custom key generator (`keyGenerator: userKeyGenerator`) to track authenticated users by their unique database ID (`req.user.id`) rather than just their IP address solves two critical logistics problems:
* **The Shared Office NAT Problem**: In large warehouses or office hubs, 20 dispatchers work under the same roof sharing a single public IP address. If we limited by IP, one heavy user could exhaust the limit and block all other 19 dispatchers in the office. Limiting by User ID sandboxes each user's rate limits individually.
* **The Roaming Driver IP Swapping**: Drivers switch connection points continuously (Wi-Fi to LTE, cell tower handovers), causing their IP addresses to change while they are on route. Tracking by `userId` ensures their location tracking remains throttled correctly regardless of IP changes.

#### 2. What is "windowMs"?
The variable `windowMs` stands for **"Time Window in Milliseconds"**. It represents the rolling duration in which request quotas are calculated (e.g., `60 * 1000` is a 1-minute window). It runs entirely on the backend server, protecting all client devices (whether accessing from Chrome, Safari, Mozilla, iOS, or Android) equally.

#### 3. Client Header Metadata
By setting `standardHeaders: true`, the server automatically appends rate limit status headers to the client's API response:
* `RateLimit-Limit`: Maximum requests allowed in the window (e.g. 100).
* `RateLimit-Remaining`: Requests left before the client gets blocked.
* `RateLimit-Reset`: Time remaining in seconds until the quota resets.

This allows our mobile and web apps to monitor their quota and slow down background requests dynamically before triggering a block.

---

## 23. Real-Time Driver Tracking & Location Persistence Architecture

To build a high-performance, real-time logistics platform, tracking driver movements is a core requirement. We split this feature into two synchronized layers: **Database Persistence** and **Real-Time WebSockets**.

```mermaid
graph LR
    Driver[Mobile App / Driver] -->|1. Socket.io Event<br/>'driver_location_update'| Server[Express Server / Socket.io]
    Server -->|2. Prisma update| DB[(PostgreSQL Database)]
    Server -->|3. Broadcast 'driver_location_changed'| Admin[Admin Dashboard Room]
    Server -->|4. Broadcast 'delivery_location_changed'| Customer[Customer Room / Active Order]
```

### A. Data Persistence (PostgreSQL DB Layer)
When a driver broadcasts their current location, the data must be securely saved for audit trails, routing history, and late delivery SLA reviews.
* **Storage Location:** Inside the `DriverProfile` model in our PostgreSQL database.
* **Database Columns:**
  * `lastLatitude`: Stores the driver's current latitude (e.g., `6.5244`).
  * `lastLongitude`: Stores the driver's current longitude (e.g., `3.3792`).
  * `isOnline`: Automatically marked as `true` when a driver actively streams location updates.
  * `updatedAt`: Automatic timestamp marking exactly when the coordinate update occurred.

### B. Logical Architecture (Repository & Service Patterns)
To adhere to clean engineering patterns, we decouple database access from business validation rules:
1. **Repository Layer (`tracking.repository.ts`)**: Directly runs Prisma queries to update the database or fetch locations. It handles raw SQL/queries and contains no logic checks.
2. **Service Layer (`tracking.service.ts`)**: Evaluates business constraints, including:
   * **Tenant Isolation:** Ensuring a corporate admin from Tenant A cannot request tracking details for a delivery belonging to Tenant B (throwing a `"Delivery not found or unauthorized"` error).
   * **State Constraints:** Verifying that a driver is active and has been assigned to the requested delivery prior to attempting to fetch coordinates.

### C. Live Streaming Layer (WebSockets via Socket.io)
Polling a REST API every 2 seconds for location updates is highly inefficient ($O(n)$ requests) and will exhaust server resources. Instead, we use a bidirectional **Socket.io** connection:
* **JWT Handshake Authentication:** Sockets are authenticated via JWT during connection. The user's ID, role, and `tenantId` are attached to the socket context (`socket.user`).
* **Room-Based Sandboxing:** Sockets are automatically routed into specific channels:
  * **Tenant Room (`tenant:${tenantId}`)**: Only admins of the same company join this room. When any driver in their company moves, their location updates are streamed directly to this room for the dispatch dashboard.
  * **Delivery Room (`delivery:${deliveryId}`)**: Customers tracking their active shipments join this specific room. The server only broadcasts location updates to this room if the driver is assigned (`ASSIGNED` or `PICKED_UP`) to that exact order.

### D. REST Routing & Middleware Pipeline Guard
While WebSockets provide real-time coordination, we require secure HTTP REST endpoints as a backup/polling fallback mechanism. These are secured by a multi-stage middleware gate sequence:

```
  Incoming HTTP Request
           │
           ▼
  1. [authenticate]      <─── Verifies token & extracts User/Tenant context
           │
           ▼
  2. [authorize([...])]  <─── Validates role access permissions
           │
           ▼
  3. [generalApiLimiter] <─── Rate limits traffic to prevent spam
           │
           ▼
  4. [Controller Handler]<─── Loads data & responds to client
```

* **Wildcard Parameters (`/:deliveryId`)**: Captures the dynamic delivery identifier from the path parameter, making it available as `req.params.deliveryId`.
* **Granular Role Isolation**:
  * `GET /delivery/:deliveryId`: Open to `["CUSTOMER", "DRIVER", "TENANT_SUPER_ADMIN", "TENANT_SUB_ADMIN"]`. All participating parties are permitted to track the active shipment.
  * `GET /drivers`: Strictly restricted to `["TENANT_SUPER_ADMIN", "TENANT_SUB_ADMIN"]`. Ensures drivers and customers cannot access the complete GPS coordinates of all other fleet drivers.

---

## 24. Frontend Architecture: Company Onboarding & Core React Concepts

This section documents the technical architecture, state design patterns, and network hooks implemented in the company onboarding module ([TenantOnboardPage.tsx](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/admin-dashboard/src/features/auth/pages/TenantOnboardPage.tsx)).

### A. State Management & Data Cleanups (`useState`)
React's `useState` manages client-side interactivity and validation states:
1. **Consolidated Object State (`formData`)**: Input text fields (`company_name`, `subdomain`, `admin_email`, `password`, `confirm_password`) are structured in a single parent object. A unified change handler updates the state on keystroke via object spread operations:
   ```typescript
   setFormData((prev) => ({ ...prev, [id]: value }));
   ```
2. **Subdomain Sanitation (Clean Data Inputs)**: The subdomain field intercepts keystrokes and dynamically replaces unsafe characters:
   ```typescript
   const formatted = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
   ```
   This ensures the value sent to the API matches the database schema's URL validation constraints before triggering submission.
3. **Validation and Dynamic Feedback**: State maps like `fieldErrors` link input IDs directly to error messages. If a field fails validation, it gets highlighted and linked to screen readers, while `isLoading` prevents duplicate HTTP requests by disabling buttons and showing an active loader spinner.

### B. Effects & DOM Lifecycle Syncing (`useEffect`)
Side effects are external interactions handled outside React's render loop:
1. **SEO Optimization**: Syncs the document title (`document.title`) once upon rendering:
   ```typescript
   useEffect(() => {
     document.title = "Logistel | Company Onboarding";
   }, []);
   ```
2. **Background Animations & Memory Cleaning**: Listens to mouse position coordinates to drive background parallax shifts:
   ```typescript
   useEffect(() => {
     const handleMouseMove = (e: MouseEvent) => {
       const blobs = document.querySelectorAll<HTMLElement>(".ambient-blob");
       const x = e.clientX / window.innerWidth;
       const y = e.clientY / window.innerHeight;
       if (blobs[0]) blobs[0].style.transform = `translate(${x * 30}px, ${y * 30}px)`;
       if (blobs[1]) blobs[1].style.transform = `translate(${-(x * 30)}px, ${-(y * 30)}px)`;
     };
     document.addEventListener("mousemove", handleMouseMove);
     
     // Cleanup function
     return () => document.removeEventListener("mousemove", handleMouseMove);
   }, []);
   ```
   * *Memory Precaution*: If we do not return a cleanup function, the mouse listener remains attached to the browser's global scope even after navigating away, creating a memory leak.

### C. DOM Focus & Accessibility Helpers (`useRef`)
Using `useRef` provides a reference to DOM nodes without causing components to re-render.
* **Alert Focus**: When form submission fails, a reference pointing to the top error box (`errorAlertRef`) calls `.focus()` programmatically:
  ```typescript
  setTimeout(() => errorAlertRef.current?.focus(), 50);
  ```
  This immediately alerts assistive technologies to read the top error message aloud.

### D. Global State & Automatic Auth Context Logging (`useAuth`)
Instead of forcing users to sign in manually directly after onboarding, we leverage React Context via `useAuth`:
* **State Propagation**: Upon a `201 Created` API response, credentials (`admin`) and session tokens (`token`) are passed directly into the context provider's `login` function.
* **Auto Redirect**: React Context writes the session cookies and updates state, which immediately signals `AppRouter` to redirect the user to `/tenant-owner/dashboard` because their user role matches `TENANT_SUPER_ADMIN`.

### E. WCAG 2.1 Accessibility Checklist (Level AA Standards)
The component implements structural tags to guarantee keyboard and assistive accessibility:
* **Criterion 1.3.1 (Info and Relationships)**: Connects each input to its `<label>` via matching `id` and `htmlFor` properties.
* **Criterion 3.3.1 (Error Identification)**: Elements with errors receive `aria-invalid="true"` and are linked to inline error text tags via `aria-describedby`, ensuring screen readers announce the exact failure details.
* **Criterion 4.1.2 (Name, Role, Value)**: The submit button uses `aria-busy={isLoading}` to communicate API transmission statuses.

---

## 25. B2B Logistics Dashboards: Leaflet Mapping, GPS Telemetry & Network Interceptors

We designed and built two critical portals: the **Tenant Owner Dispatch Dashboard** and the **Driver Dashboard**. This section documents the key UI/UX designs, coordinate mapping, and security bypass configurations.

### A. React Leaflet Map Configuration
`react-leaflet` provides standard vector rendering of maps in React. To make the interface fit our dark premium theme and avoid standard bugs, we implemented three designs:
1. **Dark Map Canvas Tiles**: We configured `TileLayer` using the CartoDB Dark Matter theme:
   ```
   https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png
   ```
2. **Dynamic Coordinate Pins**: Defined distinct color icons using standard Leaflet anchor options to identify starting locations (Blue), cargo destinations (Green), and active online driver vehicles (Red).
3. **The Leaflet Asset Resolution Fix**: React bundlers (like Vite) bundle asset paths during production compilations. Leaflet's default pin search engine assumes standard static directories, causing markers to break. We resolve this by manually importing standard icons and overriding the prototype paths:
   ```typescript
   import markerIcon from "leaflet/dist/images/marker-icon.png";
   import markerShadow from "leaflet/dist/images/marker-shadow.png";

   delete (L.Icon.Default.prototype as any)._getIconUrl;
   L.Icon.Default.mergeOptions({
     iconUrl: markerIcon,
     shadowUrl: markerShadow,
   });
   ```

### B. Geolocation & Online Duty Status
To prevent "ghost drivers" (couriers online with null coordinates) from causing calculation errors in our Haversine SQL searches, we coupled coordinates telemetry with the online queue toggle:
- When a driver clicks **Go Online**, the dashboard requests permission from the browser's geolocation context (`navigator.geolocation.getCurrentPosition(...)`).
- The coordinates are immediately captured and forwarded to the backend `PATCH /drivers/online` endpoint.

### C. State Machine Handoffs & OTP Verifications
To secure the cargo chain-of-custody, drivers advance deliveries through verified steps:
1. **Confirm Pickup**: Driver clicks collect (`ASSIGNED` $\rightarrow$ `PICKED_UP`).
2. **Confirm Departure**: Driver begins transit (`PICKED_UP` $\rightarrow$ `IN_TRANSIT`).
3. **Confirm Handoff**: The driver must request a 6-digit confirmation pin from the recipient. Submitting this triggers a constant-time check (`IN_TRANSIT` $\rightarrow$ `DELIVERED`), saving the final coordinates.

### D. Axios response interceptors & 401 Bypass
Our global Axios network interceptor intercepts `401 Unauthorized` responses to clear cookies and redirect expired sessions to `/login`. However, during login submissions, a wrong email/password *also* returns `401 Unauthorized`. 
- **The Bug**: The interceptor caught the 401 during submission, triggering a full page reload and wiping our React state (making error states "flash" and disappear).
- **The Fix**: We added a check to verify that the target request URL is NOT the authentication route:
  ```typescript
  if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
    storage.clear();
    window.location.href = '/login';
  }
  ```
  This allows the login form to receive and display credentials errors locally without reloading the browser.

---

## 26. Fleet Management & Super Admin Anti-Fraud Architecture

To combat asset theft, phantom breakdowns, and driver collusion, we designed the Fleet Management Module (`backend/src/api/v1/modules/vehicles`) around **Strict Super Admin RBAC Control**.

### A. Operational Security & Anti-Fraud Gates
* **Driver & Customer Mutation Lock (`403 Forbidden`)**: Drivers and customers have zero permission to register vehicles, set maintenance dates, or toggle vehicle statuses (`IDLE`, `IN_USE`, `MAINTENANCE`).
* **Super Admin Command**: Only users with the `TENANT_SUPER_ADMIN` role can execute vehicle asset CRUD operations, set servicing due dates, or assign drivers to specific vehicles.

### B. Automated Maintenance Overdue Calculation
Instead of storing static overdue flags in the database, the backend dynamically calculates `isMaintenanceOverdue` on every API response:
```typescript
const now = new Date();
const isMaintenanceOverdue = Boolean(
  vehicle.nextMaintenanceDue && new Date(vehicle.nextMaintenanceDue) < now
);
```
When `isMaintenanceOverdue` evaluates to `true`, the Admin Dashboard automatically highlights the vehicle with an **OVERDUE** warning badge.

---

## 27. Proof of Delivery (POD) & Cloudinary CDN Architecture

To secure cargo chain-of-custody and eliminate backend server memory exhaustion from photo uploads, we implemented **Proof of Delivery (POD)** backed by **Cloudinary CDN Cloud Storage**.

```mermaid
graph TD
    Driver[Driver App / Handoff] -->|1. Draw Recipient Signature| Canvas[HTML5 Signature Canvas]
    Driver -->|2. Snap Cargo Photo| Photo[Delivery Photo Upload]
    Driver -->|3. Submit Base64 Payload| Server[Backend /upload-pod Endpoint]
    Server -->|4. Cloudinary SDK Stream| Cloudinary[Cloudinary Global CDN]
    Cloudinary -->|5. Return Secure HTTPS URLs| Server
    Server -->|6. Save URLs & Verify OTP| DB[(PostgreSQL Database)]
    Admin[Tenant Admin Dashboard] -->|7. View POD Certificate| Modal[POD Inspection Modal]
```

### A. Cloud Storage & Graceful Local Fallback
* **Cloudinary CDN Streaming**: When `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are configured in `.env`, uploaded base64 data strings are streamed to Cloudinary's secure cloud storage using auto-compression (`quality: "auto:good"`, `fetch_format: "auto"`).
* **Development Fallback**: If Cloudinary environment variables are missing during offline local development, the utility (`upload.util.ts`) gracefully decodes the base64 payload and writes PNG files to `/uploads/pod/photos` and `/uploads/pod/signatures`, serving them via Express static middleware (`app.use('/uploads', express.static(...))`).

### B. HTML5 Digital Signature Canvas
The recipient digital signature pad ([SignatureCanvas.tsx](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/admin-dashboard/src/components/SignatureCanvas.tsx)) captures vector stroke movements across mouse (`onMouseDown`, `onMouseMove`, `onMouseUp`) and mobile touch screens (`onTouchStart`, `onTouchMove`, `onTouchEnd`). Exported PNG data URLs (`canvas.toDataURL("image/png")`) are processed by the POD endpoint before completing order handoffs (`DELIVERED`).

---

## 28. Public Customer Package Tracking Architecture

To allow end-recipients and customers to monitor shipment progress in real-time without creating an account or logging in, we implemented an unauthenticated **Public Customer Package Tracking Portal** (`/track` and `/track/:code`).

```mermaid
graph TD
    Recipient[End Customer / Recipient] -->|1. Enter 6-Digit OTP / Tracking ID| Portal[PublicTrackingPage]
    Portal -->|2. GET /api/v1/tracking/public/:code| Backend[Express Tracking Route]
    Backend -->|3. Find Order by OTP or ID| DB[(PostgreSQL Database)]
    DB -->|4. Return Delivery + Driver Coords| Backend
    Backend -->|5. Public Safe Payload| Portal
    Portal -->|6. Render Live Map & Stepper| UI[Interactive Leaflet Canvas & 5-Step Timeline]
```

### A. Unauthenticated API & Privacy Sanitization
* **Rate Limiting Protection**: Endpoint `GET /api/v1/tracking/public/:code` uses `generalApiLimiter` to prevent brute-force OTP enumerations.
* **Privacy Isolation**: Omits driver emails, user password hashes, internal billing rates, and tenant secrets, returning only public-safe tracking metadata: status (`PENDING` $\rightarrow$ `DELIVERED`), pickup/dropoff coordinates, expected arrival deadline, assigned vehicle type, and verified POD certificate previews upon completion.

### B. Live Leaflet Map & 5-Step Progress Stepper
The frontend component ([PublicTrackingPage.tsx](file:///c:/Users/USER/Downloads/My-logistic-Platform-main/My-logistic-Platform-main/admin-dashboard/src/features/tracking/pages/PublicTrackingPage.tsx)) renders a 5-stage shipment stepper line (`Order Placed` $\rightarrow$ `Courier Assigned` $\rightarrow$ `Cargo Collected` $\rightarrow$ `Out for Delivery` $\rightarrow$ `Delivered`) alongside an interactive CartoDB Dark Matter Leaflet map displaying real-time courier markers and route polyline paths.



