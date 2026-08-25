# Render Cloud Docker Deployment Guide (No BIOS / Docker Desktop Needed)

This guide walks you through deploying the **Logistel Platform** to **Render** using Cloud Docker containers. 

> [!NOTE]
> Because Render builds your Docker containers on their high-speed cloud Linux servers, **you do not need Docker Desktop or BIOS Virtualization enabled on your office computer**.

---

## 🚀 Step-by-Step Deployment Instructions

### Step 1: Push latest code to GitHub
Make sure all your latest changes are pushed to your GitHub repository (`We13b-MD/My-logistic-Platform`):
```bash
git add .
git commit -m "deploy: ready for render cloud docker build"
git push origin main
```

---

### Step 2: Sign in to Render with GitHub
1. Open **[render.com](https://render.com)** in your web browser.
2. Click **GET STARTED** or **LOG IN** and choose **"Sign in with GitHub"**.

---

### Step 3: Deploy using Render Blueprint (1-Click)
1. In your Render Dashboard, click **New +** in the top right corner.
2. Select **Blueprint**.
3. Connect your repository: **`We13b-MD/My-logistic-Platform`**.
4. Render will automatically detect the **`render.yaml`** blueprint file in your repository!
5. Enter a Blueprint name (e.g. `logistel-production`).

---

### Step 4: Configure Environment Variables
Under the **`logistel-backend`** service parameters:
1. Copy your **`DATABASE_URL`** from `backend/.env`:
   ```env
   DATABASE_URL="postgresql://neondb_owner:npg_75cmTCgJIMXl@ep-mute-tree-a2cg6a1a-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=30&pool_timeout=30"
   ```
2. Paste it into the `DATABASE_URL` field in Render.
3. Click **Apply / Deploy**.

---

## 🎉 What Happens Next?
- Render's cloud servers will pull your code, execute `backend/Dockerfile`, run `prisma generate`, compile TypeScript, and launch your container.
- Render will issue live web links:
  - **Backend API**: `https://logistel-backend.onrender.com`
  - **Frontend Dashboard**: `https://logistel-frontend.onrender.com`
- Every time you run `git push origin main` in the future, Render will automatically rebuild and update your live Docker container!
