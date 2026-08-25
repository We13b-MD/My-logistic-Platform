import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useAuth } from "@/context/AuthContext";
import homePageGif from "@/assets/homePagegif.gif";

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Set page title
  useEffect(() => {
    document.title = "Logistel | The Operating System for Global Logistics";
  }, []);

  return (
    <div className="min-h-screen w-full text-slate-100 flex flex-col relative overflow-x-hidden selection:bg-teal-500 selection:text-slate-950">

      {/* Solid background color under everything */}
      <div className="absolute inset-0 -z-20 bg-[#080d1a]"></div>

      {/* ─── HERO SECTION BACKGROUND GIF (Strictly confined to top Hero region) ─── */}
      <div className="absolute top-0 left-0 w-full h-[650px] md:h-[750px] -z-10 overflow-hidden pointer-events-none select-none">
        <img
          src={homePageGif}
          className="w-full h-full object-cover opacity-85 scale-105"
          alt="Logistel Hero Background"
          aria-hidden="true"
        />
        {/* Subtle, crisp gradient overlay that keeps GIF clear in Hero while fading cleanly into dark theme below */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#080d1a]/30 via-[#080d1a]/40 to-[#080d1a]"></div>
      </div>

      {/* Ambient Radial Color Blobs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-teal-500/20 rounded-full blur-[120px] -z-10 pointer-events-none mix-blend-screen"></div>
      <div className="absolute top-96 right-1/4 w-[400px] h-[400px] bg-sky-500/15 rounded-full blur-[100px] -z-10 pointer-events-none mix-blend-screen"></div>

      {/* ─── TOP APP BAR NAVIGATION ─── */}
      <nav className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-6 md:px-12 h-16 bg-[#080d1a]/85 backdrop-blur-xl border-b border-slate-800/80">
        <div
          onClick={() => navigate("/")}
          className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 bg-[#29a195] rounded-xl flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-slate-950 text-[24px]">hub</span>
          </div>
          <span className="font-display text-lg font-bold text-teal-400 tracking-tight">Logistel</span>
        </div>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-xs font-semibold text-slate-400 hover:text-teal-400 uppercase tracking-widest transition-colors">Features</a>
          <a href="#solutions" className="text-xs font-semibold text-slate-400 hover:text-teal-400 uppercase tracking-widest transition-colors">Solutions</a>
          <a href="#pricing" className="text-xs font-semibold text-slate-400 hover:text-teal-400 uppercase tracking-widest transition-colors">Pricing</a>
        </div>

        {/* Call to Actions */}
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <button
              onClick={() => navigate("/dashboard")}
              className="bg-teal-400 hover:bg-teal-300 text-slate-950 px-5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <span>Go to Dashboard</span>
              <Icon icon="lucide:arrow-right" className="text-sm text-slate-950" />
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate("/login")}
                className="text-slate-300 hover:text-teal-400 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate("/onboard")}
                className="bg-teal-400 hover:bg-teal-300 text-slate-950 px-5 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
              >
                Get Started
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ─── MAIN CANVAS CONTENT ─── */}
      <main className="flex-grow pt-24 pb-16 px-6 md:px-12 max-w-7xl mx-auto w-full z-10 flex flex-col gap-16">

        {/* HERO HEADER SECTION */}
        <section className="flex flex-col items-center justify-center text-center py-16 md:py-24 relative">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900 border border-slate-800 mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shadow-[0_0_8px_rgba(45,212,191,0.8)]"></span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Logistel OS v2.4 Live</span>
          </div>

          <h1 className="font-display text-4xl md:text-6xl text-slate-100 font-bold tracking-tight mb-6 max-w-4xl leading-tight">
            The Operating System for <br className="hidden md:block" />{" "}
            <span className="text-teal-400 font-extrabold">
              Global Logistics
            </span>
          </h1>

          <p className="text-sm md:text-base text-slate-400 max-w-2xl mb-10 leading-relaxed">
            Transform chaotic global supply chain data into a streamlined, executable interface. Achieve unprecedented technical precision, reduce operational bloat, and unlock massive cost-savings across your entire fleet ecosystem.
          </p>

          {/* Action Buttons with Glassmorphic Design */}
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <button
              onClick={() => navigate("/onboard")}
              className="glass-panel border border-teal-500/50 bg-teal-500/15 hover:bg-teal-500/25 text-white backdrop-blur-xl px-8 py-4 rounded-xl text-sm font-bold transition-all shadow-xl shadow-teal-500/10 flex items-center justify-center cursor-pointer active:scale-95 hover:border-teal-400"
            >
              <span>Register Company</span>
            </button>
            <button
              onClick={() => navigate("/register")}
              className="glass-panel border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800/80 text-white backdrop-blur-xl px-8 py-4 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center justify-center active:scale-95 hover:border-slate-500"
            >
              <span>Join as Driver</span>
            </button>
          </div>
        </section>

        {/* ─── VALUE PROPOSITIONS BENTO GRID (6 Feature Cards) ─── */}
        <section id="features" className="py-8 scroll-mt-20">
          <div className="text-center mb-16">
            <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest bg-slate-900/90 px-3.5 py-1.5 rounded-full border border-slate-800 shadow-sm">
              Full Logistics Platform Capabilities
            </span>
            <h2 className="font-display text-2xl md:text-4xl text-slate-100 font-bold mt-4 mb-4">
              Engineered for Operational Excellence
            </h2>
            <p className="text-xs md:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
              Real-road routing, tamper-proof GPS telemetry audits, and automated dynamic pricing built for modern carrier fleets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Bento Card 1: OSRM Real-Road Engine */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col h-[320px] group hover:border-teal-500/40 transition-all border border-slate-800 relative overflow-hidden">
              <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(45,52,73,0.4)_1px,transparent_1px)] bg-[size:16px_16px]"></div>
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center mb-5 border border-teal-500/20 group-hover:border-teal-500/50 transition-colors">
                  <Icon icon="solar:routing-bold-duotone" className="text-teal-400 text-2xl" />
                </div>
                <h3 className="text-base font-bold text-slate-100 mb-2">OSRM Real-Road Engine</h3>
                <p className="text-xs text-slate-400 leading-relaxed flex-grow">
                  Turn-by-turn road geometry, accurate drive-time ETAs, and interactive polyline maps snapped directly to actual transport highways.
                </p>
                <div className="mt-auto flex items-center justify-between border-t border-slate-800/80 pt-4">
                  <span className="text-[10px] font-mono text-teal-400">OpenSource Routing Engine</span>
                  <Icon icon="lucide:arrow-right" className="text-slate-400 group-hover:text-teal-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>

            {/* Bento Card 2: GPS Breadcrumb Audit Trail */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col h-[320px] group hover:border-orange-500/40 transition-all border border-slate-800 relative overflow-hidden">
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center mb-5 border border-orange-500/20 group-hover:border-orange-500/50 transition-colors">
                  <Icon icon="solar:map-point-wave-bold-duotone" className="text-orange-400 text-2xl" />
                </div>
                <h3 className="text-base font-bold text-slate-100 mb-2">GPS Breadcrumb Audit</h3>
                <p className="text-xs text-slate-400 leading-relaxed flex-grow">
                  Anti-cargo diversion & transloading fraud prevention. Every driver location update is permanently logged for complete map replay.
                </p>
                <div className="mt-auto flex items-center justify-between border-t border-slate-800/80 pt-4">
                  <span className="text-[10px] font-mono text-orange-400">Append-Only Audit Ledger</span>
                  <Icon icon="lucide:arrow-right" className="text-slate-400 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>

            {/* Bento Card 3: Dynamic Distance Pricing */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col h-[320px] group hover:border-emerald-500/40 transition-all border border-slate-800 relative overflow-hidden">
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-5 border border-emerald-500/20 group-hover:border-emerald-500/50 transition-colors">
                  <Icon icon="solar:calculator-minimalistic-bold-duotone" className="text-emerald-400 text-2xl" />
                </div>
                <h3 className="text-base font-bold text-slate-100 mb-2">Dynamic Fare Engine</h3>
                <p className="text-xs text-slate-400 leading-relaxed flex-grow">
                  Automated pricing rules based on road distance (km), base fares, and vehicle type multipliers (Bike, Car, Van, Truck).
                </p>
                <div className="mt-auto flex items-center justify-between border-t border-slate-800/80 pt-4">
                  <span className="text-[10px] font-mono text-emerald-400">Real-time Rate Calculator</span>
                  <Icon icon="lucide:arrow-right" className="text-slate-400 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>

            {/* Bento Card 4: Digital Proof of Delivery */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col h-[320px] group hover:border-sky-500/40 transition-all border border-slate-800 relative overflow-hidden">
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center mb-5 border border-sky-500/20 group-hover:border-sky-500/50 transition-colors">
                  <Icon icon="solar:verified-check-bold-duotone" className="text-sky-400 text-2xl" />
                </div>
                <h3 className="text-base font-bold text-slate-100 mb-2">Proof of Delivery (POD)</h3>
                <p className="text-xs text-slate-400 leading-relaxed flex-grow">
                  Digital signature canvas capture, photo proof uploads, and secure OTP handoff codes to guarantee delivery fulfillment.
                </p>
                <div className="mt-auto flex items-center justify-between border-t border-slate-800/80 pt-4">
                  <span className="text-[10px] font-mono text-sky-400">OTP & Signature Verification</span>
                  <Icon icon="lucide:arrow-right" className="text-slate-400 group-hover:text-sky-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>

            {/* Bento Card 5: Real-time Socket Dispatch */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col h-[320px] group hover:border-indigo-500/40 transition-all border border-slate-800 relative overflow-hidden">
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-5 border border-indigo-500/20 group-hover:border-indigo-500/50 transition-colors">
                  <Icon icon="solar:transmission-bold-duotone" className="text-indigo-400 text-2xl" />
                </div>
                <h3 className="text-base font-bold text-slate-100 mb-2">Live Socket Dispatch</h3>
                <p className="text-xs text-slate-400 leading-relaxed flex-grow">
                  Bi-directional Socket.io telemetry streaming driver coordinates live to dispatchers and end customers with sub-50ms latency.
                </p>
                <div className="mt-auto flex items-center justify-between border-t border-slate-800/80 pt-4">
                  <span className="text-[10px] font-mono text-indigo-400">WebSocket Live Telemetry</span>
                  <Icon icon="lucide:arrow-right" className="text-slate-400 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>

            {/* Bento Card 6: Multi-tenant Security */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col h-[320px] group hover:border-purple-500/40 transition-all border border-slate-800 relative overflow-hidden">
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-5 border border-purple-500/20 group-hover:border-purple-500/50 transition-colors">
                  <Icon icon="solar:shield-check-bold-duotone" className="text-purple-400 text-2xl" />
                </div>
                <h3 className="text-base font-bold text-slate-100 mb-2">Multi-Tenant Security</h3>
                <p className="text-xs text-slate-400 leading-relaxed flex-grow">
                  Enterprise tenant data isolation, role-based access control (RBAC), and Edge WAF rate-limiting protection.
                </p>
                <div className="mt-auto flex items-center justify-between border-t border-slate-800/80 pt-4">
                  <span className="text-[10px] font-mono text-purple-400">Enterprise Tenant Isolation</span>
                  <Icon icon="lucide:arrow-right" className="text-slate-400 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* ─── SOLUTIONS SECTION ─── */}
        <section id="solutions" className="py-16 scroll-mt-20 border-t border-slate-900/60">
          <div className="text-center mb-16">
            <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest bg-slate-900/80 px-3.5 py-1.5 rounded-full border border-slate-800">
              Ecosystem Roles
            </span>
            <h2 className="font-display text-2xl md:text-3xl text-slate-100 font-bold mt-4 mb-4">
              Unified Solutions for Every Stakeholder
            </h2>
            <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
              Logistel brings dispatchers, drivers, and customers together in one seamless, real-time environment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
            {/* Solution 1: Dispatchers */}
            <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 flex flex-col hover:border-teal-500/30 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-5">
                <Icon icon="solar:user-speak-bold-duotone" className="text-teal-400 text-xl" />
              </div>
              <h3 className="text-base font-bold text-slate-100 mb-2">For Fleet Dispatchers</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Complete visibility of your operations. Manage your fleet, assign shipments, and monitor delivery earnings with real-time maps.
              </p>
            </div>

            {/* Solution 2: Drivers */}
            <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 flex flex-col hover:border-amber-500/30 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5">
                <Icon icon="solar:transmission-bold-duotone" className="text-amber-400 text-xl" />
              </div>
              <h3 className="text-base font-bold text-slate-100 mb-2">For Delivery Drivers</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                A simple mobile companion desk. Access active shipments, coordinate routes, and upload instant digital proof of delivery (POD).
              </p>
            </div>

            {/* Solution 3: Customers */}
            <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 flex flex-col hover:border-sky-500/30 transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-5">
                <Icon icon="solar:bill-list-bold-duotone" className="text-sky-400 text-xl" />
              </div>
              <h3 className="text-base font-bold text-slate-100 mb-2">For End Customers</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Zero friction package tracking. Book orders directly through your portal and watch package movements in real-time.
              </p>
            </div>
          </div>
        </section>

        {/* ─── PRICING SECTION ─── */}
        <section id="pricing" className="py-12 scroll-mt-20 border-t border-slate-900/60 pt-16">
          <div className="text-center mb-16">
            <h2 className="font-display text-2xl md:text-3xl text-slate-100 font-bold mb-4">
              Flexible Plans Built for Growth
            </h2>
            <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
              No hidden fees, no credit card required to start. Select a tier that fits your fleet's delivery volume.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">

            {/* Tier 1: Free */}
            <div className="glass-panel rounded-2xl p-8 flex flex-col border border-slate-800 relative">
              <div className="mb-6">
                <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest bg-slate-900 px-3 py-1 rounded-full border border-slate-800">Starter</span>
                <h3 className="text-xl font-bold text-slate-100 mt-4">Local Hub</h3>
                <p className="text-xs text-slate-500 mt-1">Perfect for small local carrier startups.</p>
              </div>
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-100">₦0</span>
                <span className="text-xs text-slate-500">/ month</span>
              </div>
              <ul className="space-y-3.5 mb-8 flex-grow">
                <li className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Icon icon="lucide:check" className="text-teal-400 text-sm shrink-0" />
                  <span>Up to 1,000 deliveries / month</span>
                </li>
                <li className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Icon icon="lucide:check" className="text-teal-400 text-sm shrink-0" />
                  <span>1 dispatcher dashboard seat</span>
                </li>
                <li className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Icon icon="lucide:check" className="text-teal-400 text-sm shrink-0" />
                  <span>Distance-based quoting engine</span>
                </li>
                <li className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Icon icon="lucide:check" className="text-teal-400 text-sm shrink-0" />
                  <span>Public customer tracking links</span>
                </li>
              </ul>
              <button
                onClick={() => navigate("/onboard")}
                className="w-full bg-slate-900 hover:bg-slate-800 text-slate-100 py-3 rounded-xl text-xs font-bold transition-all border border-slate-800 cursor-pointer text-center"
              >
                Get Started
              </button>
            </div>

            {/* Tier 2: Pro */}
            <div className="glass-panel rounded-2xl p-8 flex flex-col border border-teal-500/30 relative shadow-[0_0_30px_rgba(45,212,191,0.05)]">
              <div className="absolute -top-3 right-6 bg-teal-500 text-slate-950 text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
                Most Popular
              </div>
              <div className="mb-6">
                <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest bg-slate-900 px-3 py-1 rounded-full border border-slate-800">Growth</span>
                <h3 className="text-xl font-bold text-slate-100 mt-4">Fleet Hub</h3>
                <p className="text-xs text-slate-500 mt-1">For expanding carriers managing regular drivers.</p>
              </div>
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-100">₦50,000</span>
                <span className="text-xs text-slate-500">/ month</span>
              </div>
              <ul className="space-y-3.5 mb-8 flex-grow">
                <li className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Icon icon="lucide:check" className="text-teal-400 text-sm shrink-0" />
                  <span>Up to 25,000 deliveries / month</span>
                </li>
                <li className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Icon icon="lucide:check" className="text-teal-400 text-sm shrink-0" />
                  <span>5 dispatcher dashboard seats</span>
                </li>
                <li className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Icon icon="lucide:check" className="text-teal-400 text-sm shrink-0" />
                  <span>Automated driver matching queue</span>
                </li>
                <li className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Icon icon="lucide:check" className="text-teal-400 text-sm shrink-0" />
                  <span>OTP delivery handoff & signatures</span>
                </li>
                <li className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Icon icon="lucide:check" className="text-teal-400 text-sm shrink-0" />
                  <span>Socket.io live map tracking</span>
                </li>
              </ul>
              <button
                onClick={() => navigate("/onboard")}
                className="w-full bg-[#29a195] hover:bg-[#22877d] text-slate-950 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm text-center"
              >
                Upgrade Hub
              </button>
            </div>

            {/* Tier 3: Enterprise */}
            <div className="glass-panel rounded-2xl p-8 flex flex-col border border-slate-800 relative">
              <div className="mb-6">
                <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest bg-slate-900 px-3 py-1 rounded-full border border-slate-800">Custom</span>
                <h3 className="text-xl font-bold text-slate-100 mt-4">Enterprise</h3>
                <p className="text-xs text-slate-500 mt-1">For national and global shipping networks.</p>
              </div>
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-100">Custom</span>
              </div>
              <ul className="space-y-3.5 mb-8 flex-grow">
                <li className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Icon icon="lucide:check" className="text-teal-400 text-sm shrink-0" />
                  <span>Unlimited delivery volume</span>
                </li>
                <li className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Icon icon="lucide:check" className="text-teal-400 text-sm shrink-0" />
                  <span>Unlimited dispatcher seats</span>
                </li>
                <li className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Icon icon="lucide:check" className="text-teal-400 text-sm shrink-0" />
                  <span>White-label customer portals</span>
                </li>
                <li className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Icon icon="lucide:check" className="text-teal-400 text-sm shrink-0" />
                  <span>Dedicated support & custom SLA</span>
                </li>
                <li className="flex items-center gap-2.5 text-xs text-slate-300">
                  <Icon icon="lucide:check" className="text-teal-400 text-sm shrink-0" />
                  <span>Direct REST API & webhooks</span>
                </li>
              </ul>
              <button
                onClick={() => window.location.href = "mailto:sales@logistel.com"}
                className="w-full bg-slate-900 hover:bg-slate-800 text-slate-100 py-3 rounded-xl text-xs font-bold transition-all border border-slate-800 cursor-pointer text-center"
              >
                Contact Sales
              </button>
            </div>

          </div>
        </section>

      </main>

      {/* ─── SMOOTH SCROLL LOCAL STYLE ─── */}
      <style>{`html { scroll-behavior: smooth; }`}</style>

      {/* ─── FOOTER BAR ─── */}
      <footer className="border-t border-slate-800/80 py-8 mt-auto z-10 bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Icon icon="solar:shipping-truck-bold-duotone" className="text-teal-400 text-lg" />
            <span className="text-xs text-slate-500 font-mono">
              © {new Date().getFullYear()} Logistel Systems Inc.
            </span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="text-xs text-slate-400 hover:text-teal-400 transition-colors">Privacy Policy</a>
            <a href="#" className="text-xs text-slate-400 hover:text-teal-400 transition-colors">Terms of Service</a>
            <a href="#" className="text-xs text-slate-400 hover:text-teal-400 transition-colors">API Status</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
