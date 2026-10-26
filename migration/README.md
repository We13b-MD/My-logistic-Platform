# 🚀 Master Migration Strategy: Render to DigitalOcean & Free Frontend Hosting

This folder contains a complete, step-by-step guide for migrating the **Logistel Logistics Platform** away from Render to significantly reduce hosting costs while improving platform speed, reliability, and eliminating cold starts.

---

## 📊 Summary of Architectural Changes & Costs

| Component | Old Setup (Render) | New Target Setup | Monthly Cost |
| :--- | :--- | :--- | :--- |
| **Frontend (Admin Dashboard)** | Render Static Site | **Cloudflare Pages** or **Vercel** | **$0.00 / mo** (100% Free Forever, Unlimited Bandwidth) |
| **Backend API (Express Node)** | Render Web Service | **DigitalOcean Droplet** (Docker Compose) | **$4.00 - $6.00 / mo** (1GB RAM / 1 vCPU Droplet) |
| **Database (PostgreSQL)** | Neon / Render Postgres | **Dockerized Postgres** on DigitalOcean Droplet | **$0.00** (Included in Droplet) |
| **Queue / Cache (Redis)** | Render Redis (Paid) | **Dockerized Redis 7** on DigitalOcean Droplet | **$0.00** (Included in Droplet) |
| **SSL / HTTPS Certificates** | Render Managed SSL | **Caddy Reverse Proxy** (Automated Let's Encrypt) | **$0.00** (Automatic & Free) |
| **Domain Registrar & DNS** | WhoGoHost + Render DNS | **WhoGoHost** (Registrar) + **Cloudflare DNS** | **$0.00** (Free DNS & DDoS Protection) |
| **Total Estimated Cost** | ~$25 - $40 / month | **$4.00 - $6.00 / month total** | **~85% Savings** |

---

## 🗺️ Migration Roadmap & Table of Contents

Follow the step-by-step guides in numerical order to ensure zero downtime and zero data loss:

1. **[`01-frontend-free-hosting.md`](./01-frontend-free-hosting.md)**  
   Deploy the React/Vite Admin Dashboard to **Cloudflare Pages** or **Vercel** for 100% free hosting with custom domain support.

2. **[`02-digitalocean-backend-setup.md`](./02-digitalocean-backend-setup.md)**  
   Provision a DigitalOcean Droplet, configure Firewall, setup Docker & Docker Compose, and launch the Node.js API + Postgres + Redis + Caddy.

3. **[`03-database-and-data-transfer.md`](./03-database-and-data-transfer.md)**  
   Safely dump existing data from Neon/Render PostgreSQL and restore it into the new DigitalOcean PostgreSQL database with zero missing records.

4. **[`04-whogohost-dns-cutover.md`](./04-whogohost-dns-cutover.md)**  
   Connect your domain from WhoGoHost to Cloudflare DNS, configure `A` and `CNAME` records, and execute seamless cutover.

---

## 📂 Configuration Files & Scripts Included

- **[`docker-compose.prod.yml`](./docker-compose.prod.yml)**: Production multi-container spec for API, PostgreSQL 15, Redis 7, and Caddy.
- **[`Caddyfile`](./Caddyfile)**: Automatic reverse-proxy with SSL renewal for `api.yourdomain.com`.
- **[`scripts/backup.sh`](./scripts/backup.sh)**: Automated database backup & restore shell script.

---

## ⚡ Quick Rules for Zero Downtime Cutover
1. **Do not shut down Render services** until the DigitalOcean backend is running and verified.
2. **Deploy backend first**, restore database, verify endpoints on `api.yourdomain.com`.
3. **Deploy frontend second**, set `VITE_API_URL` to point to `https://api.yourdomain.com`.
4. **Update DNS records** at WhoGoHost/Cloudflare last.
