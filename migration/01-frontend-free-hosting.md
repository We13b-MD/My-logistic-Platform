# 🌐 Step 1: Deploying Frontend to 100% Free Static Hosting

Because Render's static site host charges or has limits, we are moving the React/Vite Admin Dashboard to a **100% Free Forever** hosting provider.

---

## 🏆 Top Recommended Free Hosting Platforms

| Feature | **Cloudflare Pages** (Recommended ⭐️) | **Vercel** | **Netlify** |
| :--- | :--- | :--- | :--- |
| **Bandwidth Limit** | **Unlimited** (100% Free) | 100 GB / month | 100 GB / month |
| **Build Minutes** | **500 builds / month** | 6,000 build minutes | 300 build minutes |
| **Custom Domain SSL** | Automatic & Free | Automatic & Free | Automatic & Free |
| **Global CDN Speed** | Ultra Fast (300+ edge locations) | Extremely Fast | Fast |
| **SPA Routing Support** | Supported via `_redirects` | Supported via `vercel.json` | Supported via `_redirects` |

---

## 🚀 Option A: Cloudflare Pages (Recommended)

### 1. Prepare Single Page Application (SPA) Redirect Rule
Vite single-page applications require all client routes (e.g. `/dashboard`, `/drivers`, `/deliveries`) to rewrite to `index.html`.

We have included a `_redirects` file in `admin-dashboard/public/_redirects` or Cloudflare build settings:
```text
/*  /index.html  200
```

### 2. Deployment Steps on Cloudflare Pages
1. Go to **[dash.cloudflare.com](https://dash.cloudflare.com)** and create a free account (or log in).
2. On the sidebar, click **Workers & Pages** -> **Create application** -> **Pages**.
3. Select **Connect to Git** and pick your GitHub repository (`My-logistic-Platform`).
4. Configure Project Settings:
   - **Project Name**: `logistel-admin` (or `logistel-frontend`)
   - **Production Branch**: `main`
   - **Framework Preset**: `Vite`
   - **Root Directory**: `admin-dashboard`
   - **Build Command**: `npm run build`
   - **Build Output Directory**: `dist`
5. **Environment Variables**:
   Add the following environment variable:
   - Variable Name: `VITE_API_URL`
   - Value: `https://api.yourdomain.com` (or `http://YOUR_DIGITALOCEAN_DROPLET_IP:3000` during testing)
   - Variable Name: `VITE_PAYSTACK_PUBLIC_KEY`
   - Value: `pk_live_xxxxxxxxxxxxxxxxxxxxxxxx` (or test key)
6. Click **Save and Deploy**. Cloudflare will build and host your site in ~30 seconds!

---

## ⚡ Option B: Vercel

If you prefer Vercel:

1. Create a free account at **[vercel.com](https://vercel.com)** using GitHub.
2. Click **Add New** -> **Project**.
3. Import your GitHub repository (`My-logistic-Platform`).
4. Configure Build & Output Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click Edit and choose `admin-dashboard`.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   - `VITE_API_URL` = `https://api.yourdomain.com`
6. Click **Deploy**.

---

## 🛠️ Step 3: SPA Routing Config Files (Added automatically)

To guarantee that refreshing URLs like `https://your-frontend.pages.dev/dashboard/drivers` does NOT throw a 404 error:

### For Cloudflare Pages & Netlify (`admin-dashboard/public/_redirects`):
```text
/*  /index.html  200
```

### For Vercel (`admin-dashboard/vercel.json`):
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## ✅ Step 4: Verification
Once deployment completes:
- You will receive a free domain URL like `https://logistel-admin.pages.dev` (Cloudflare) or `https://logistel-admin.vercel.app` (Vercel).
- Test opening the URL in your browser.
- Next, we will set up the DigitalOcean backend so your frontend can communicate with the live API.
