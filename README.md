# 🚚 Logistel Platform — Enterprise Logistics Operating System

> **B2B Multi-Tenant SaaS Platform for Courier Companies, Fleet Owners, and Dispatch Operators**

---

## 📖 Overview

Logistel is an enterprise logistics operating system that transforms traditional courier operations into a modernized, audited, digital platform. Built for emerging and fast-moving urban markets (calibrated with Lagos traffic multipliers, off-route telemetry, and zero-theft handshakes), it empowers fleet owners with complete dispatch mission control.

---

## 🌟 Key Platform Features

1. **Dispatcher Mission Control & Fleet Radar:**
   - Real-time GPS breadcrumb tracking and cargo diversion investigation.
   - Haversine geofencing (`AT_PICKUP`, `DEPARTED_PICKUP`, `ARRIVED_DROPOFF`) with Watchdog Sentinel alerts.
2. **In-App Driver Turn-by-Turn Navigator:**
   - In-app OSRM routing engine with live voice synthesis guidance (Web Speech API) and Screen Wake Lock.
   - Dual-layer driveway road corridors calibrated for motorbikes, vans, cars, and heavy trucks.
3. **Printable Waybill & Shipping Label Engine:**
   - Dual-format switcher: **A4 Formal Consignment Note** and **4x6 Compact Thermal Label**.
   - Dynamic scannable QR code linking directly to live public GPS tracking (`/track/:id`).
   - Tri-party legal chain of custody signatures.
4. **Daily Driver Run Sheet (Trip Manifest):**
   - Sequenced multi-stop manifest for daily shift dispatching.
   - Formal morning depot handover verification and evening cash & returns reconciliation sign-offs.
5. **Driver Cash Collection & Remittance Ledger:**
   - Real-time tracking of cash on delivery (COD) and delivery fares collected by drivers.
   - Cashier settlement modal supporting Cash, Direct Bank Transfer, and POS with transaction references.
6. **Vehicle Regulatory Compliance & Expiry Sentinel:**
   - Automated expiration monitoring for Vehicle Licenses, Roadworthiness, Insurance, and Hackney Carriage Permits.
   - Proactive dashboard sentinel warning banners to prevent vehicle impoundment and traffic enforcement fines (LASTMA, VIO, FRSC).
7. **Zero-Theft Cryptographic OTP Handshake:**
   - Digital Proof of Delivery (POD) photo capture and recipient signature canvas.
   - Deliveries cannot be marked completed without the recipient's secret 6-digit OTP.

---

## 🛡️ Identity Verification & Anti-Fraud Blueprint: Dojah Integration (CAC, BVN & Driver's License)

> **Strategic Guide on applying Dojah (`dojah.io`) for automated Business (KYB) and Carrier (KYC) identity verification.**

### 📌 Why Dojah?
In emerging markets like Nigeria, logistics and courier operations face two massive trust and fraud problems:
1. **Rogue Drivers Running Off with Cargo:** Unvetted drivers use fake names or burner phone numbers to pick up high-value goods (phones, jewelry, laptops) and disappear.
2. **Ghost / Fake Logistics Companies:** Unregistered entities collect packages or upfront fees and vanish, damaging consumer trust.

Dojah is Nigeria and Africa's premier identity verification API, providing direct programmatic access to official government and financial registries: **Corporate Affairs Commission (CAC)**, **Bank Verification Number (BVN)**, **National Identity Number (NIN)**, and the **Federal Road Safety Corps (FRSC)**.

---

### 🏛️ The Two Core Implementation Layers

```mermaid
flowchart TD
    subgraph Layer 1: Tenant KYB (Logistics Company Onboarding)
        A["New Logistics Company Registers"] --> B["Dojah CAC Lookup API<br/>(RC / BN Number)"]
        B --> C["Verify Director's BVN / NIN"]
        C --> D["Grant Verified Courier Trust Badge<br/>on Tracking Pages & Waybills"]
    end

    subgraph Layer 2: Driver KYC (Carrier Fleet Onboarding)
        E["Driver Registers Under Fleet"] --> F["Dojah FRSC Driver's License API"]
        F --> G["Dojah NIN / BVN & Facial Selfie Match"]
        G --> H["Automated Driver Verification<br/>(Eliminates Rogue Rider Theft)"]
    end
```

---

### Layer 1: Tenant KYB (Know Your Business — Company Verification)
When a logistics company registers on Logistel to run their courier business:

* **What is verified:**
  1. **CAC Number (RC or BN):**
     * Queries the Corporate Affairs Commission database in real time.
     * Verifies legal registered company name, incorporation date, and registered address.
     * Confirms registration status is **ACTIVE**.
  2. **Managing Director BVN / NIN:**
     * Validates the legal identity of the company director against NIBSS / NIMC records.
* **Platform Outcome:**
  * Displays a prominent **"Government & CAC Verified Carrier"** gold trust shield on their customer booking portals, public tracking links, and generated waybills.
  * Corporate senders (law firms, medical labs, e-commerce stores) have 100% legal confidence booking through the platform.

---

### Layer 2: Driver KYC (Know Your Carrier — Driver Verification)
When a driver registers on a company's fleet portal (`/register?role=DRIVER`):

* **What is verified:**
  1. **FRSC Driver’s License Verification:**
     * Direct query against the Federal Road Safety Corps database.
     * Confirms the license is genuine, belongs to the driver, and is not expired.
  2. **Biometric NIN / BVN Match:**
     * Validates the driver's legal name, date of birth, and official government photograph.
  3. **Liveness / Selfie Check:**
     * Driver takes a selfie during onboarding; Dojah matches facial landmarks against their government ID photo.
* **Platform Outcome:**
  * Automatically sets `isVerified: true` on the `DriverProfile` model.
  * **Near-Zero Package Theft:** Drivers will not abscond with consignments when they know their biometric BVN and NIN are legally linked to the dispatch company.
  * Eliminates hours of manual background checking for fleet supervisors.

---

### 💻 Technical Implementation Blueprint

Dojah integrates via lightweight REST HTTP requests within the backend service layer:

```ts
import axios from "axios";

export class DojahVerificationService {
  private baseUrl = "https://api.dojah.io/api/v1";
  private headers = {
    Authorization: process.env.DOJAH_PRIVATE_KEY!,
    AppId: process.env.DOJAH_APP_ID!,
  };

  /**
   * 1. Verify Company CAC Registration
   */
  async verifyCompanyCAC(rcNumber: string, companyType: "RC" | "BN") {
    const res = await axios.get(`${this.baseUrl}/kyb/cac`, {
      params: { rc_number: rcNumber, company_type: companyType },
      headers: this.headers,
    });
    return res.data.entity; // Returns legal name, status, address
  }

  /**
   * 2. Verify Driver's License via FRSC Registry
   */
  async verifyDriversLicense(licenseNumber: string, dateOfBirth: string) {
    const res = await axios.get(`${this.baseUrl}/kyc/dl`, {
      params: { license_number: licenseNumber, dob: dateOfBirth },
      headers: this.headers,
    });
    return res.data.entity; // Returns name, expiry date, photo URL
  }

  /**
   * 3. Verify Director / Driver BVN
   */
  async verifyBVN(bvn: string) {
    const res = await axios.get(`${this.baseUrl}/kyc/bvn/full`, {
      params: { bvn },
      headers: this.headers,
    });
    return res.data.entity; // Returns full legal name, registered phone
  }
}
```

---

### 💡 Deployment & Cost Strategy

| Phase | Strategy | Cost |
| :--- | :--- | :--- |
| **Phase 1: MVP & Pilot Launch (Current)** | Use the built-in manual **`[ Verify Driver ]`** toggle and tenant role management. | **₦0** (Zero third-party API costs while testing Paystack and core flows) |
| **Phase 2: Commercial Scale** | Activate Dojah automated checks. Pass the verification fee (approx. ₦50–₦150 per check) to the tenant or bundle it into the **$65/month** SaaS subscription. | High ROI (A primary selling point when pitching fleet owners) |

---

## 🛠️ Tech Stack

* **Backend:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL (Neon), Socket.io, Cloudflare R2 Object Storage.
* **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Leaflet / OpenStreetMap, Web Speech API, Sonner.
* **Routing & Maps:** OSRM (Open Source Routing Machine) with custom dynamic Urban Traffic Multipliers.
* **Payments:** Paystack Subscription & Checkout Integration (USD & NGN support).

---

## 🚀 Getting Started

### Backend Setup:
```bash
cd backend
npm install
npx prisma generate
npm run dev
```

### Admin Dashboard Setup:
```bash
cd admin-dashboard
npm install
npm run dev
```

---

## 📋 Documentation Reference
* [System Architectural & Modifications Log](modifications.md)
* [Ideal Customers & Value Proposition Guide](docs/WHAT_TO_TELL_CUSTOMERS_OUR_DIFFERENCE_FACTOR.md)
* [Account Deletion & Regulatory Compliance](docs/ACCOUNT_DELETION_AND_REGULATORY_COMPLIANCE.md)
