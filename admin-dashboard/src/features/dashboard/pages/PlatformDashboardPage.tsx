import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { tenantApi } from "@/api/tenant.api";
import { toast } from "sonner";
import { PlatformTenantItem, PlatformMetrics, Industry } from "@/types";

const INDUSTRY_OPTIONS: Industry[] = [
  "FOOD",
  "HEALTH",
  "TRANSPORT",
  "FASHION",
  "SPORT",
  "ENTERTAINMENT",
  "BANKING",
  "OTHERS",
];

export function PlatformDashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [tenants, setTenants] = useState<PlatformTenantItem[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<"tenants" | "analytics" | "admins">("tenants");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Modal & Action states
  const [selectedTenant, setSelectedTenant] = useState<PlatformTenantItem | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tenantsRes, metricsRes] = await Promise.all([
        tenantApi.listAll(),
        tenantApi.getMetrics(),
      ]);

      if (tenantsRes.data?.status === "success") {
        setTenants(tenantsRes.data.data || []);
      }
      if (metricsRes.data?.status === "success") {
        setMetrics(metricsRes.data.data || null);
      }
    } catch (error) {
      console.error("Failed to load platform dashboard data:", error);
      toast.error("Failed to load platform data. Please check network connection.");
    } fontally: {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleStatus = async (tenantId: string, currentStatus: boolean) => {
    try {
      setTogglingId(tenantId);
      const nextStatus = !currentStatus;
      const res = await tenantApi.toggleStatus(tenantId, nextStatus);
      if (res.data?.status === "success") {
        toast.success(
          `Tenant ${res.data.data.companyName} has been ${
            nextStatus ? "activated" : "suspended"
          } successfully!`
        );
        fetchData();
        if (selectedTenant && selectedTenant.id === tenantId) {
          setSelectedTenant({ ...selectedTenant, isActive: nextStatus });
        }
      }
    } catch (error: any) {
      console.error("Failed to update tenant status:", error);
      toast.error(error.response?.data?.message || "Failed to update tenant status.");
    } finally {
      setTogglingId(null);
    }
  };

  const filteredTenants = tenants.filter((tenant) => {
    const matchesSearch =
      tenant.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.subdomain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.adminEmail.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesIndustry =
      selectedIndustry === "ALL" || tenant.industry === selectedIndustry;

    const matchesStatus =
      selectedStatus === "ALL" ||
      (selectedStatus === "ACTIVE" && tenant.isActive) ||
      (selectedStatus === "SUSPENDED" && !tenant.isActive);

    return matchesSearch && matchesIndustry && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* ─── Top Navigation Header ─── */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-indigo-300">
              Platform Master Control
            </h1>
            <p className="text-xs text-slate-400">Global Logistics Super Admin Console</p>
          </div>
        </div>

        {/* Global Live System Indicator */}
        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Platform Core: Operational</span>
          </div>

          {/* User info badge */}
          <div className="flex items-center space-x-3 bg-slate-800/80 px-3.5 py-1.5 rounded-lg border border-slate-700">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 font-semibold flex items-center justify-center text-sm border border-indigo-500/30">
              {user?.email?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold text-slate-200 truncate max-w-[140px]">
                {user?.email}
              </div>
              <div className="text-[10px] text-indigo-400 font-mono tracking-wider">
                {user?.role}
              </div>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
            title="Refresh Data"
          >
            <svg
              className={`w-5 h-5 ${loading ? "animate-spin text-indigo-400" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          {/* Logout Button */}
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="px-3 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs font-semibold transition-all flex items-center space-x-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* ─── Main Content Container ─── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ─── KPI Metrics Overview Cards ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Total Tenants */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-indigo-500/50 transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Logistics Tenants
              </span>
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-white">
                {metrics ? metrics.totalTenants : "--"}
              </span>
              <div className="text-xs space-x-2">
                <span className="text-emerald-400 font-semibold">
                  {metrics ? metrics.activeTenants : 0} Active
                </span>
                {metrics && metrics.suspendedTenants > 0 && (
                  <span className="text-rose-400 font-semibold">
                    {metrics.suspendedTenants} Suspended
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Total Deliveries */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-violet-500/50 transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl group-hover:bg-violet-500/20 transition-all"></div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Global Deliveries
              </span>
              <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-white">
                {metrics ? metrics.totalDeliveries : "--"}
              </span>
              <span className="text-xs text-violet-300 font-medium">
                {metrics && metrics.totalDeliveries > 0
                  ? `${Math.round((metrics.completedDeliveries / metrics.totalDeliveries) * 100)}% Delivered`
                  : "0% Delivered"}
              </span>
            </div>
          </div>

          {/* Card 3: Total Platform Users */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-cyan-500/50 transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all"></div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Registered Users
              </span>
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-white">
                {metrics ? metrics.totalUsers : "--"}
              </span>
              <span className="text-xs text-cyan-300 font-medium">
                {metrics ? `${metrics.totalDrivers} Drivers` : "0 Drivers"}
              </span>
            </div>
          </div>

          {/* Card 4: System Status */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                System SLA Uptime
              </span>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-emerald-400">99.98%</span>
              <span className="text-xs text-emerald-300 font-medium">Healthy</span>
            </div>
          </div>
        </div>

        {/* ─── Navigation Tabs ─── */}
        <div className="flex border-b border-slate-800 space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab("tenants")}
            className={`pb-3 transition-colors border-b-2 flex items-center space-x-2 ${
              activeTab === "tenants"
                ? "border-indigo-500 text-indigo-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <span>Tenant Directory ({filteredTenants.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={`pb-3 transition-colors border-b-2 flex items-center space-x-2 ${
              activeTab === "analytics"
                ? "border-indigo-500 text-indigo-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <span>Platform Growth & Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab("admins")}
            className={`pb-3 transition-colors border-b-2 flex items-center space-x-2 ${
              activeTab === "admins"
                ? "border-indigo-500 text-indigo-400 font-bold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <span>Platform Administrators</span>
          </button>
        </div>

        {/* ─── TAB 1: TENANT FLEET DIRECTORY ─── */}
        {activeTab === "tenants" && (
          <div className="space-y-6">
            {/* Search and Filters Bar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
              {/* Search Bar */}
              <div className="md:col-span-6 relative">
                <input
                  type="text"
                  placeholder="Search by company name, subdomain, or admin email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                />
                <svg
                  className="w-5 h-5 text-slate-500 absolute left-3 top-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              {/* Industry Filter */}
              <div className="md:col-span-3">
                <select
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                >
                  <option value="ALL">All Industries</option>
                  {INDUSTRY_OPTIONS.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="md:col-span-3">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="SUSPENDED">Suspended Only</option>
                </select>
              </div>
            </div>

            {/* Tenant Directory Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              {loading ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center space-y-3">
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading platform tenants...</span>
                </div>
              ) : filteredTenants.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <svg
                    className="w-12 h-12 mx-auto text-slate-600 mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  <p className="text-base font-semibold text-slate-300">No Tenants Found</p>
                  <p className="text-xs text-slate-500">
                    Try refining your search terms or filter selection.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-6 py-4">Logistics Company</th>
                        <th className="px-6 py-4">Subdomain</th>
                        <th className="px-6 py-4">Industry</th>
                        <th className="px-6 py-4">Tenant Admin Email</th>
                        <th className="px-6 py-4 text-center">Fleet Stats</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredTenants.map((tenant) => (
                        <tr
                          key={tenant.id}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-lg bg-indigo-900/40 border border-indigo-700/50 flex items-center justify-center text-indigo-300 font-bold">
                                {tenant.companyName[0]?.toUpperCase() || "T"}
                              </div>
                              <div>
                                <div className="font-semibold text-white">
                                  {tenant.companyName}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  ID: {tenant.id.slice(0, 8)}...
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-indigo-300">
                            {tenant.subdomain}.platform.com
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                              {tenant.industry}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-200">{tenant.adminEmail}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center space-x-3 text-xs">
                              <span title="Total Users" className="text-slate-300 font-medium">
                                👤 {tenant.totalUsers}
                              </span>
                              <span title="Total Deliveries" className="text-violet-300 font-medium">
                                📦 {tenant.totalDeliveries}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {tenant.isActive ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-800/60">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5"></span>
                                Suspended
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            {/* View details */}
                            <button
                              onClick={() => setSelectedTenant(tenant)}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                            >
                              Details
                            </button>

                            {/* Suspend / Activate Toggle */}
                            <button
                              onClick={() => handleToggleStatus(tenant.id, tenant.isActive)}
                              disabled={togglingId === tenant.id}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                                tenant.isActive
                                  ? "bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/50"
                                  : "bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/50"
                              }`}
                            >
                              {togglingId === tenant.id ? "Updating..." : tenant.isActive ? "Suspend" : "Activate"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: PLATFORM ANALYTICS ─── */}
        {activeTab === "analytics" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Delivery Rate Breakdown */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Delivery Completion Throughput</span>
              </h3>
              <p className="text-xs text-slate-400">
                System-wide delivery status tracking across all onboarded logistics providers.
              </p>

              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">Completed Orders</span>
                    <span className="text-emerald-400">
                      {metrics ? metrics.completedDeliveries : 0} / {metrics ? metrics.totalDeliveries : 0}
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500"
                      style={{
                        width: `${
                          metrics && metrics.totalDeliveries > 0
                            ? (metrics.completedDeliveries / metrics.totalDeliveries) * 100
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-300">Active Tenant Ratio</span>
                    <span className="text-indigo-400">
                      {metrics ? metrics.activeTenants : 0} / {metrics ? metrics.totalTenants : 0}
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full transition-all duration-500"
                      style={{
                        width: `${
                          metrics && metrics.totalTenants > 0
                            ? (metrics.activeTenants / metrics.totalTenants) * 100
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Industry Distribution */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                </svg>
                <span>Tenant Industry Sector Distribution</span>
              </h3>
              <div className="grid grid-cols-2 gap-3 pt-2">
                {INDUSTRY_OPTIONS.map((ind) => {
                  const count = tenants.filter((t) => t.industry === ind).length;
                  return (
                    <div
                      key={ind}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between"
                    >
                      <span className="text-xs font-semibold text-slate-300">{ind}</span>
                      <span className="px-2 py-0.5 rounded bg-indigo-900/50 text-indigo-300 font-mono text-xs font-bold border border-indigo-700/50">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 3: PLATFORM ADMINISTRATORS ─── */}
        {activeTab === "admins" && (
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">Platform System Administrators</h3>
              <p className="text-xs text-slate-400">
                Manage global super admin accounts with permission to activate, inspect, or manage logistics tenants.
              </p>
            </div>

            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">
                    SA
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{user?.email}</div>
                    <div className="text-xs text-slate-400">Super Administrator (Current Session)</div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800 text-xs font-semibold">
                  PLATFORM_SUPER_ADMIN
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ─── TENANT DETAILS MODAL ─── */}
      {selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-6 p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-lg">
                  {selectedTenant.companyName[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedTenant.companyName}</h3>
                  <p className="text-xs font-mono text-indigo-400">
                    {selectedTenant.subdomain}.platform.com
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTenant(null)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 block">Industry Sector</span>
                  <span className="font-semibold text-slate-200">{selectedTenant.industry}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 block">Account Status</span>
                  <span
                    className={`font-semibold ${
                      selectedTenant.isActive ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {selectedTenant.isActive ? "Active" : "Suspended"}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400 block">Tenant Super Admin Email</span>
                <span className="font-mono text-indigo-300 font-medium">
                  {selectedTenant.adminEmail}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 block">Users</span>
                  <span className="text-lg font-bold text-white">{selectedTenant.totalUsers}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 block">Deliveries</span>
                  <span className="text-lg font-bold text-violet-400">
                    {selectedTenant.totalDeliveries}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 block">Vehicles</span>
                  <span className="text-lg font-bold text-cyan-400">
                    {selectedTenant.totalVehicles}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-500 text-center pt-2">
                Onboarded on: {new Date(selectedTenant.createdAt).toLocaleDateString()}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setSelectedTenant(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Close
              </button>
              <button
                onClick={() => handleToggleStatus(selectedTenant.id, selectedTenant.isActive)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg border ${
                  selectedTenant.isActive
                    ? "bg-rose-950/50 hover:bg-rose-900 text-rose-300 border-rose-800"
                    : "bg-emerald-950/50 hover:bg-emerald-900 text-emerald-300 border-emerald-800"
                }`}
              >
                {selectedTenant.isActive ? "Suspend Tenant" : "Activate Tenant"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
