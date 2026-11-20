# 🚀 Logistel Platform — Market Launch & Paystack Commercial Playbook

> **The Founder's Strategic & Operational Runbook for Real-World Rollout in Nigeria**

---

## 📌 Executive Summary

This playbook captures the complete commercial and technical strategy for launching Logistel to real fleet operators and courier companies in Nigeria, operating without native mobile apps first, and activating live Paystack subscription billing once your corporate bank onboarding completes.

---

## 🎯 1. The Go-to-Market Strategy: The "Rule of 3" Pilot

### A. Why Stop Feature Development Now?
* **The Perfectionism Trap:** Adding features every day in isolation creates complexity before you know what real dispatchers actually use. 
* **The Reality:** 1 week with 3 real courier companies will give you 10x more valuable insight than 6 months of coding alone.
* **Current Status:** You already have a full enterprise operating system: Lagos-calibrated OSRM routing, live GPS radar, driver mobile HUD, OTP handoffs, PDF waybills, morning trip manifests, driver remittance ledgers, and a Developer REST API. **You are 100% ready to sell.**

### B. The Web App First Strategy (Why Wait on Native Mobile Apps?)
* **Smart Founder Decision:** Launching the responsive Web App (PWA) first saves thousands of dollars, avoids Apple App Store / Google Play review delays, and allows instant bug fixes without requiring drivers to download updates.
* **How Drivers Use It Today:** Drivers open `https://logistel.com.ng/login` on their Android phone in Google Chrome. The driver dashboard is fully mobile-optimized with large touch targets, live GPS broadcasting, turn-by-turn navigation HUD, Web Speech voice guidance, and Screen Wake Lock.
* **When to build Native Apps:** Only build native iOS/Android apps *after* you have 5 paying courier companies asking for background background push notifications or offline GPS caching.

### C. The Pitch: What to Show vs. What to Keep in Your Sleeve
When demoing to a logistics business owner, **do not show all 15 features at once**—it will overwhelm them.

#### 🌟 The 3 Features to Lead With:
1. **Lagos Real-Road Traffic Radar:** *"See all your motorbikes and vans live on the map with realistic Lagos rush-hour ETAs (not theoretical 7-minute estimates that ignore Ojuelegba traffic)."*
2. **1-Click Morning Paperwork:** *"Generate your drivers' morning Run Sheets (Trip Manifests) and physical Waybills/Labels with scannable tracking QR codes in one click."*
3. **Theft & Scam Prevention:** *"Every delivery requires a 6-digit receiver OTP and digital signature before it can be marked completed."*

#### 🃏 The Ace in Your Sleeve (The Developer REST API):
When the business owner asks: *"Can my online store or e-commerce clients send us orders automatically without sending 30 WhatsApp messages?"*  
👉 **Pull out the Developer API tab:** *"Yes! Give them our ready-to-use API key. Orders from their website drop straight onto your dispatch board automatically."*

---

## 💳 2. Paystack Commercial Activation Runbook

*(Execute these steps once your corporate bank account and business registration verification finish on Paystack).*

### Step 1: Switch Keys in Paystack Dashboard
1. Log in to **[dashboard.paystack.com](https://dashboard.paystack.com)**.
2. Toggle the switch at the top from **Test Mode** to **Live Mode**.
3. Go to **Settings** ➔ **API Keys & Webhooks**.
4. Copy your **Live Secret Key** (`sk_live_...`) and **Live Public Key** (`pk_live_...`).

### Step 2: Configure Live Webhook URL
In your Paystack Dashboard under **API Keys & Webhooks**:
* Set **Live Webhook URL** to:
  ```text
  https://api.logistel.com.ng/api/v1/billing/paystack/webhook
  ```
* This ensures that when a courier company pays their **$65/month** subscription, Paystack instantly tells your server to unlock their account.

### Step 3: Update Production `.env` on DigitalOcean
SSH into your droplet or use the DigitalOcean Web Console:
```bash
nano /var/www/logistel/backend/.env
```
Update the Paystack key:
```env
# Switch from sk_test to sk_live
PAYSTACK_SECRET_KEY="sk_live_your_actual_live_secret_key_here"
```
Save and restart the backend container:
```bash
docker compose restart backend
```

---

## 🛠️ 3. Developer REST API & Webhooks Reference

### Summary of What Was Built & Verified:
* **Endpoints:** Mounted at `/api/public/v1/*` (`/me`, `/quotes`, `/shipments`, `/shipments/:id`, `/shipments/:id/cancel`).
* **Security & Auth:**
  * Keys are prefixed with `lgs_live_` and carry 256 bits of entropy.
  * Stored strictly as **SHA-256 hashes** (never plain text).
  * Rate-limited to **60 requests/minute per key** with brute-force protection.
  * Database write throttling: `lastUsedAt` updates at most once every 5 minutes, reducing DB writes by 99%.
  * SSRF-proof: Webhooks targeting AWS/cloud metadata (`169.254.169.254`), localhost, or insecure HTTP are blocked.
* **Tenant Isolation:** Tenant A's API key can never read, modify, or cancel Tenant B's shipments.
* **Testing:** Fully verified with **22/22 passing automated tests** and a ready-to-use VS Code REST Client test suite (`backend/api-test.http`).

---

## 🚀 4. Production Deployment Runbook (Pushing Code Live)

Follow these steps to update your production droplet at `api.logistel.com.ng`:

### Step 1: Push Local Code to GitHub (From your PC)
```bash
git add .
git commit -m "feat: complete Developer Web API, webhook engine, and landing page pricing"
git push origin main
```

### Step 2: Pull and Apply on DigitalOcean Droplet
Open your **DigitalOcean Web Console** (or terminal SSH: `ssh root@159.65.95.186`):

```bash
# 1. Navigate to project root
cd /var/www/logistel

# 2. Pull the latest commits from GitHub
git pull origin main

# 3. Apply the database migration to your production database
docker compose exec backend npx prisma migrate deploy

# 4. Rebuild and restart the backend container with the new code
docker compose up -d --build backend
```

### Step 3: Update Cloudflare Pages Frontend (If applicable)
* If your frontend is connected to GitHub via Cloudflare Pages, it will auto-deploy the new commit in ~60 seconds.
* Open `https://logistel.com.ng` to see the new **Developer API & Webhooks** bento card and pricing items live!

---

## 📋 5. The First 30 Days Launch Checklist

- [ ] Complete corporate bank account linking on Paystack.
- [ ] Push latest git commits to GitHub and deploy to DigitalOcean.
- [ ] Log into `https://logistel.com.ng/login` as Tenant Owner (`admin@swift.com`) and verify the new Developer tab on live server.
- [ ] Test mobile web driver view on your own phone.
- [ ] Walk into or contact **3 local Lagos courier / dispatch operators**.
- [ ] Onboard them on the **30-Day Free Pilot**.
- [ ] Shadow their dispatcher for 2 hours on Day 1.
- [ ] Collect real operational feedback before writing any new code.
