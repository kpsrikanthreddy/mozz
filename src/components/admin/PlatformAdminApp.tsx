import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { AdminLogin } from './AdminLogin';
import {
  Building2,
  TrendingUp,
  DollarSign,
  Users,
  ShieldCheck,
  Server,
  Layers,
  ArrowLeft,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Database,
  Lock,
} from 'lucide-react';

export const PlatformAdminApp: React.FC = () => {
  const { user, isAuthenticated, isLoading, adminFetch, logout } = useAdminAuth();

  const [stats, setStats] = useState({
    totalRestaurants: 1,
    totalOrders: 0,
    totalGMV: 0,
    totalUsers: 2,
    totalBranches: 1,
    platformStatus: 'healthy',
    databaseEngine: 'PostgreSQL (Cloud / Supabase)',
  });

  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // New restaurant form state
  const [newRestaurant, setNewRestaurant] = useState({
    name: '',
    slug: '',
    phone: '',
    email: '',
    plan: 'growth',
  });

  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'superadmin';

  const loadPlatformData = async () => {
    setLoadingData(true);
    try {
      const statsRes = await adminFetch('/api/platform-admin/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      const restRes = await adminFetch('/api/platform-admin/restaurants');
      if (restRes.ok) {
        const restData = await restRes.json();
        setRestaurants(restData);
      }
    } catch (err) {
      console.error('[PlatformAdmin] Error fetching platform data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && isSuperAdmin) {
      loadPlatformData();
    }
  }, [isAuthenticated, isSuperAdmin]);

  // If not authenticated or loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Verifying Super Admin Session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-950 text-rose-400 border border-rose-800 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Access Restricted</h2>
          <p className="text-xs text-slate-400">
            You are logged in as <strong>{user?.name}</strong> with role <strong>{user?.role}</strong>. Only Starters4U platform administrators (role <code className="text-amber-400">SUPER_ADMIN</code>) can access global platform controls.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => {
                window.history.pushState({}, '', '/admin');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
              className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition"
            >
              Go to Restaurant Admin Portal
            </button>
            <button
              onClick={() => logout()}
              className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  const filteredRestaurants = restaurants.filter(
    (r) =>
      r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.slug?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Super Admin Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 p-0.5 shadow-md flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[9px] flex flex-col items-center justify-center p-0.5">
                  <Layers className="w-5 h-5 text-amber-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-sm sm:text-base text-white">
                    Starters4U Global Multi-Tenant Control
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-950 text-rose-300 border border-rose-800 font-bold">
                    SUPER ADMIN
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Global SaaS Telemetry & Tenant Fleet Management
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/admin');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition border border-slate-700"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Restaurant Portal</span>
              </button>

              <button
                onClick={loadPlatformData}
                disabled={loadingData}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                title="Refresh Metrics"
              >
                <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={() => logout()}
                className="px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs font-bold transition"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Total Tenants</span>
              <Building2 className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-black text-white">{stats.totalRestaurants}</div>
            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <span>{stats.totalBranches} Active Branch Outlets</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Global Orders</span>
              <TrendingUp className="w-5 h-5 text-rose-400" />
            </div>
            <div className="text-3xl font-black text-white">{stats.totalOrders}</div>
            <div className="text-[11px] text-slate-400 mt-1">Processed across platform</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Gross Platform GMV</span>
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-emerald-400">₹{stats.totalGMV.toLocaleString()}</div>
            <div className="text-[11px] text-slate-400 mt-1">Direct to Merchant Razorpay</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Database Engine</span>
              <Database className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="text-base font-extrabold text-white truncate">{stats.databaseEngine}</div>
            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Multi-Tenant Row Isolation Active</span>
            </div>
          </div>
        </div>

        {/* Restaurants Fleet Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                <span>Onboarded Restaurant Tenants</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Every tenant is isolated by <code className="text-rose-400">restaurant_id</code> in PostgreSQL.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by name or slug..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <button
                onClick={() => alert('Tenant onboarding wizard will connect new store database schema!')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Onboard Restaurant</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Restaurant</th>
                  <th className="px-6 py-3.5">Tenant Slug</th>
                  <th className="px-6 py-3.5">Branches</th>
                  <th className="px-6 py-3.5">Staff</th>
                  <th className="px-6 py-3.5">Orders & Revenue</th>
                  <th className="px-6 py-3.5">Subscription</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRestaurants.map((rest) => (
                  <tr key={rest.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-950 border border-rose-800 flex items-center justify-center font-bold text-rose-400">
                          {rest.name?.[0] || 'M'}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{rest.name}</p>
                          <p className="text-[11px] text-slate-400">{rest.phone || '+91 81796 20607'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono px-2 py-0.5 rounded bg-slate-950 text-amber-400 border border-slate-800">
                        {rest.slug}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-200">
                      {rest.branch_count || 1} Outlets
                    </td>
                    <td className="px-6 py-4 text-slate-200">
                      {rest.user_count || 1} Users
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-white">{rest.order_count || 0} orders</div>
                      <div className="text-[11px] text-emerald-400">₹{(rest.total_revenue || 0).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950/90 text-emerald-300 border border-emerald-800">
                        {rest.plan_name || 'growth'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          window.history.pushState({}, '', '/admin');
                          window.dispatchEvent(new PopStateEvent('popstate'));
                        }}
                        className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                      >
                        Manage Tenant →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
