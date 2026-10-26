# 🌐 Step 4: WhoGoHost DNS Cutover & Domain Routing Guide

This guide explains how to connect your domain registered on **WhoGoHost** to your new architecture (**Cloudflare Pages** for Frontend & **DigitalOcean** for Backend) without breaking emails or causing downtime.

---

## 🏗️ The Target DNS Architecture

```text
               +-------------------------------------------+
               | Domain Registrar: WhoGoHost               |
               | (Custom Nameservers -> Cloudflare)        |
               +---------------------+---------------------+
                                     |
                                     v
               +-------------------------------------------+
               | Free DNS Manager: Cloudflare              |
               +---------------------+---------------------+
                                     |
           +-------------------------+-------------------------+
           |                                                   |
           v                                                   v
+-----------------------+                           +-----------------------+
| Frontend (Admin/App)  |                           | Backend API           |
| Host: Cloudflare Pages|                           | Host: DigitalOcean    |
| Domain:               |                           | Domain:               |
| logistel.com.ng       |                           | api.logistel.com.ng   |
+-----------------------+                           +-----------------------+
```

---

## 🛠️ Step 1: Add Domain to Cloudflare (Free DNS)

1. Log in to **[Cloudflare Dashboard](https://dash.cloudflare.com)**.
2. Click **+ Add a Site**.
3. Enter your domain (e.g. `logistel.com.ng`).
4. Select the **Free Plan** ($0/mo) and click **Continue**.
5. Cloudflare will scan your existing DNS records (including any email MX records).
6. Copy the **2 Cloudflare Nameservers** provided (e.g. `ada.ns.cloudflare.com` and `bob.ns.cloudflare.com`).

---

## 🛠️ Step 2: Update Nameservers in WhoGoHost

1. Log in to **[WhoGoHost Client Area](https://client.whogohost.com)**.
2. Go to **Domains** -> **My Domains**.
3. Select your domain (e.g., `logistel.com.ng`) and click **Manage Domain**.
4. Click **Nameservers** on the left menu.
5. Choose **Use custom nameservers (enter below)**.
6. Replace existing Render / default nameservers with your Cloudflare Nameservers:
   - **Nameserver 1**: `ada.ns.cloudflare.com`
   - **Nameserver 2**: `bob.ns.cloudflare.com`
7. Click **Change Nameservers**. (Propagation takes ~15 - 30 minutes).

---

## 🛠️ Step 3: Configure DNS Records in Cloudflare

Inside your Cloudflare Dashboard -> **DNS** -> **Records**, add the following records:

### 1. Backend API Record (Points to DigitalOcean Droplet)
- **Type**: `A`
- **Name**: `api`
- **IPv4 Address**: `YOUR_DIGITALOCEAN_DROPLET_IP` (e.g., `159.65.xx.xx`)
- **Proxy Status**: `DNS Only` (Gray Cloud) during initial Caddy SSL challenge setup, then `Proxied` (Orange Cloud).
- **TTL**: Auto

### 2. Frontend Admin Dashboard Records (Points to Cloudflare Pages / Vercel)
- **Type**: `CNAME`
- **Name**: `@` (Root Domain)
- **Target**: `logistel-admin.pages.dev` (or your Vercel deployment URL)
- **Proxy Status**: `Proxied` (Orange Cloud)

- **Type**: `CNAME`
- **Name**: `www`
- **Target**: `logistel-admin.pages.dev`
- **Proxy Status**: `Proxied` (Orange Cloud)

### 3. Maintain Email (MX) Records (Crucial!)
Ensure existing WhoGoHost email MX records are preserved:
- **Type**: `MX`
- **Name**: `@`
- **Mail Server**: `mail.yourdomain.com` or WhoGoHost MX address
- **Priority**: `10`

---

## 🧪 Step 4: Verify Live Cutover & SSL

1. Test Backend API Ping:
   ```bash
   curl -I https://api.logistel.com.ng/api/v1/health
   ```
   Should return `HTTP/2 200 OK`.

2. Test Frontend Access:
   Open `https://logistel.com.ng` in browser. Test logging into the dashboard and making delivery requests.

---

## 🧹 Step 5: Safely Decommission Render

Once live traffic is running smoothly on DigitalOcean and Cloudflare Pages:
1. Log in to **Render Dashboard**.
2. Select your `logistel-backend` service and click **Delete Web Service**.
3. Select your `logistel-frontend` service and click **Delete Web Service**.
4. Cancel any paid billing subscriptions on Render.

🎉 **Migration Complete! You are now paying $0 for Frontend & $4-$6/mo total for Backend & DB!**
