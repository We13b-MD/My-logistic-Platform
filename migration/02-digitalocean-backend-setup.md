# 🐳 Step 2: DigitalOcean Backend, Postgres & Redis Setup

This guide walks you through deploying the **Express API**, **PostgreSQL Database**, **Redis Queue**, and **Caddy Reverse Proxy (Free SSL)** on a DigitalOcean Droplet ($4 - $6/month).

---

## 1. Create a DigitalOcean Droplet

1. Log in to **[DigitalOcean Console](https://cloud.digitalocean.com)**.
2. Click **Create** -> **Droplets**.
3. Choose the following specs:
   - **Region**: Choose the closest location to your users (e.g., Frankfurt `fra1` or London `lon1`).
   - **OS Image**: Ubuntu 24.04 LTS (x64).
   - **Droplet Type**: Basic Plan (Regular Intel/AMD).
   - **CPU & RAM**: 1 GB RAM / 1 vCPU / 25 GB NVMe SSD ($4/mo or $6/mo).
   - **Authentication**: SSH Keys (Recommended) or Password.
   - **Hostname**: `logistel-api-server`.
4. Click **Create Droplet**. Note your new **Droplet IPv4 Address** (e.g. `159.65.xx.xx`).

---

## 2. Server Firewall & Security Setup

SSH into your Droplet from your computer terminal (PowerShell / Command Prompt / Git Bash):
```bash
ssh root@YOUR_DROPLET_IP
```

Update system software and enable UFW Firewall:
```bash
# Update Ubuntu packages
apt update && apt upgrade -y

# Allow SSH, HTTP, HTTPS, and deny raw DB ports from public internet
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw default deny incoming
ufw default allow outgoing
ufw --force enable
```

---

## 3. Install Docker & Docker Compose

Run the official Docker setup script on Ubuntu:
```bash
# Remove outdated packages if any
apt remove -y docker docker-engine docker.io containerd runc

# Install prerequisite tools
apt install -y ca-certificates curl gnupg lsb-release git

# Install Docker Engine & Docker Compose Plugin
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Verify Docker installation
docker --version
docker compose version
```

---

## 4. Deploy Logistel Project to Server

Create application directory and clone your code:
```bash
mkdir -p /var/www/logistel
cd /var/www/logistel

# Clone your repository (or upload code)
git clone https://github.com/We13b-MD/My-logistic-Platform.git .
```

### Create Backend Production `.env` File
```bash
nano backend/.env
```
Paste your production environment variables into `backend/.env`:
```env
# Server Port & Mode
PORT=3000
NODE_ENV=production

# Database Connection (Docker Container Service Name is 'postgres')
DATABASE_URL="postgresql://logistel_user:SUPER_SECURE_PASSWORD@postgres:5432/logistel_prod?sslmode=disable"

# Redis Queue Connection (Docker Container Service Name is 'redis')
REDIS_URL="redis://redis:6379"

# Security Secrets
JWT_SECRET="generate_a_long_random_64_character_string_here"

# Cloudflare R2 Object Storage (POD Uploads)
R2_ACCOUNT_ID="your_account_id"
R2_ACCESS_KEY_ID="your_access_key"
R2_SECRET_ACCESS_KEY="your_secret_key"
R2_BUCKET_NAME="logistics-pod-assets"
R2_PUBLIC_DOMAIN="https://pub-xxxxxxxx.r2.dev"

# Email SMTP Setup (Brevo / Resend)
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT=587
SMTP_USER="your-email@example.com"
SMTP_PASS="your-smtp-key"
SMTP_FROM="\"Logistel Operations\" <noreply@yourdomain.com>"
```

---

## 5. Configure Production Docker Compose & Caddy SSL

Copy the production Docker Compose and Caddyfile specs:
```bash
cp migration/docker-compose.prod.yml docker-compose.yml
cp migration/Caddyfile Caddyfile
```

### Edit `Caddyfile` to use your domain:
```bash
nano Caddyfile
```
Replace `api.yourdomain.com` with your actual domain (e.g. `api.logistel.com.ng`):
```text
api.logistel.com.ng {
    reverse_proxy backend:3000
}
```

---

## 6. Launch Containers & Run Database Migrations

Start all services (PostgreSQL, Redis, Express API, Caddy):
```bash
docker compose up -d --build
```

Verify that all 4 containers are running:
```bash
docker compose ps
```

Run Prisma Database Migrations to create tables inside PostgreSQL container:
```bash
docker compose exec backend npx prisma migrate deploy
```

---

## 7. Useful Monitoring Commands

- **View Live Logs**:
  ```bash
  docker compose logs -f backend
  ```
- **View Caddy SSL Certificate Logs**:
  ```bash
  docker compose logs -f caddy
  ```
- **Restart Backend API**:
  ```bash
  docker compose restart backend
  ```
