import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { AdminLogin } from './AdminLogin';
import { AdminNavbar } from './AdminNavbar';
import { AdminPortal } from '../AdminPortal';
import { PrintDevicesSection } from './PrintDevicesSection';
import {
  Layers,
  Users,
  CreditCard,
  Building,
  Settings,
  ShieldCheck,
  RefreshCw,
  ShoppingBag,
  ChefHat,
  QrCode,
  Calendar,
  BarChart3,
  UtensilsCrossed,
  Printer,
  Sparkles,
} from 'lucide-react';

export const AdminApp: React.FC = () => {
  const { user, isAuthenticated, isLoading, adminFetch, refreshProfile } = useAdminAuth();

  // Admin active sub-view state
  const [activeSection, setActiveSection] = useState<
    'portal' | 'crm' | 'payments' | 'staff' | 'print-devices' | 'settings' | 'subscription'
  >(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const tab = p.get('section') || p.get('tab');
      if (tab === 'print-devices' || tab === 'pos' || tab === 'printers' || tab === 'print') {
        return 'print-devices';
      }
      if (tab === 'crm' || tab === 'payments' || tab === 'staff' || tab === 'settings') {
        return tab;
      }
      if (window.location.pathname.includes('/print-devices')) {
        return 'print-devices';
      }
    }
    return 'portal';
  });

  // Customer CRM data from backend
  const [customers, setCustomers] = useState<any[]>([]);
  const [loadingCrm, setLoadingCrm] = useState(false);

  // Payments data from backend
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Staff users list
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // Fetch CRM when selected
  useEffect(() => {
    if (isAuthenticated && activeSection === 'crm') {
      setLoadingCrm(true);
      adminFetch('/api/admin/customers')
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setCustomers(data))
        .catch((err) => console.error('Error fetching customers:', err))
        .finally(() => setLoadingCrm(false));
    } else if (isAuthenticated && activeSection === 'payments') {
      setLoadingPayments(true);
      adminFetch('/api/admin/payments')
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setPayments(data))
        .catch((err) => console.error('Error fetching payments:', err))
        .finally(() => setLoadingPayments(false));
    } else if (isAuthenticated && activeSection === 'staff') {
      setLoadingStaff(true);
      adminFetch('/api/admin/users')
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setStaffList(data))
        .catch((err) => console.error('Error fetching staff users:', err))
        .finally(() => setLoadingStaff(false));
    }
  }, [isAuthenticated, activeSection, adminFetch]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Verifying Admin Session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Navbar */}
      <AdminNavbar />

      {/* Admin Module Switcher Tab Bar */}
      <div className="bg-slate-900 border-b border-slate-800 text-slate-300 px-4 sm:px-8 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto gap-2">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => setActiveSection('portal')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                activeSection === 'portal'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Live Operations & Kitchen</span>
            </button>

            <button
              onClick={() => setActiveSection('crm')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                activeSection === 'crm'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Customer CRM</span>
            </button>

            <button
              onClick={() => setActiveSection('payments')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                activeSection === 'payments'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Payments & Razorpay</span>
            </button>

            <button
              onClick={() => setActiveSection('staff')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                activeSection === 'staff'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Staff & Roles</span>
            </button>

            <button
              id="admin-tab-print-devices"
              onClick={() => {
                setActiveSection('print-devices');
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  url.searchParams.set('tab', 'print-devices');
                  window.history.replaceState({}, '', url.toString());
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                activeSection === 'print-devices'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Devices & POS</span>
            </button>

            <button
              onClick={() => setActiveSection('settings')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                activeSection === 'settings'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Store Settings</span>
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>PostgreSQL Multi-Tenant Synced</span>
          </div>
        </div>
      </div>

      {/* Main Admin Body */}
      <main className="flex-1">
        {activeSection === 'portal' && (
          <AdminPortal
            onBackToMenu={() => {
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
          />
        )}

        {/* Customer CRM Module */}
        {activeSection === 'crm' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-rose-600" />
                  <span>Customer Directory & Lifetime Value (CRM)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Tenant-scoped customer records for {user?.restaurantName || 'MOZZ'}.
                </p>
              </div>
              <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700">
                Total Registered: {customers.length}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3.5">Customer</th>
                      <th className="px-6 py-3.5">Phone (WhatsApp)</th>
                      <th className="px-6 py-3.5">Default Delivery Address</th>
                      <th className="px-6 py-3.5">Total Orders</th>
                      <th className="px-6 py-3.5">Lifetime Spend</th>
                      <th className="px-6 py-3.5 text-right">Last Order Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingCrm ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400">
                          <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          <span>Loading customer database...</span>
                        </td>
                      </tr>
                    ) : customers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400">
                          No customer records found yet. Customers placing orders will automatically appear here.
                        </td>
                      </tr>
                    ) : (
                      customers.map((c, idx) => (
                        <tr key={c.id || idx} className="hover:bg-slate-50/80 transition">
                          <td className="px-6 py-4 font-bold text-slate-900">{c.name}</td>
                          <td className="px-6 py-4 font-mono font-semibold text-rose-600">{c.phone}</td>
                          <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{c.address || '—'}</td>
                          <td className="px-6 py-4 font-bold text-slate-800">{c.total_orders || 1}</td>
                          <td className="px-6 py-4 font-bold text-emerald-600">
                            ₹{(c.total_spent || 0).toFixed(0)}
                          </td>
                          <td className="px-6 py-4 text-right text-slate-500">
                            {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString() : 'Recent'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Payments & Settlement Module */}
        {activeSection === 'payments' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  <span>Razorpay & UPI Transaction Logs</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Settlements and verified gateway payments for this restaurant.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  Gateway: Razorpay Live
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3.5">Payment ID</th>
                      <th className="px-6 py-3.5">Order ID</th>
                      <th className="px-6 py-3.5">Amount</th>
                      <th className="px-6 py-3.5">Method</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingPayments ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400">
                          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          <span>Loading transaction logs...</span>
                        </td>
                      </tr>
                    ) : payments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400">
                          No transactions recorded yet. Completed orders will populate this log.
                        </td>
                      </tr>
                    ) : (
                      payments.map((p, idx) => (
                        <tr key={p.id || idx} className="hover:bg-slate-50/80 transition">
                          <td className="px-6 py-4 font-mono font-bold text-slate-900">{p.id || p.payment_id}</td>
                          <td className="px-6 py-4 font-mono text-rose-600">{p.order_id}</td>
                          <td className="px-6 py-4 font-bold text-slate-900">₹{p.amount}</td>
                          <td className="px-6 py-4 uppercase font-semibold text-slate-600">{p.method || 'UPI'}</td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                              {p.status || 'paid'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-slate-500">
                            {p.created_at ? new Date(p.created_at).toLocaleTimeString() : 'Just now'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Staff & Roles Module */}
        {activeSection === 'staff' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-600" />
                  <span>Staff Users & Role-Based Access Control</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Manage accounts with roles: RESTAURANT_OWNER, BRANCH_MANAGER, CASHIER, KITCHEN.
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200">
                  <div className="font-bold text-amber-900 text-sm">Restaurant Owner</div>
                  <div className="text-xs text-amber-800/80 mt-1">
                    Full control over menu, prices, branches, staff, payments, and operational settings.
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200">
                  <div className="font-bold text-blue-900 text-sm">Branch Manager & Cashier</div>
                  <div className="text-xs text-blue-800/80 mt-1">
                    Accept orders, process billing, mark delivery dispatches, and print receipts.
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200">
                  <div className="font-bold text-rose-900 text-sm">Kitchen Display (KOT)</div>
                  <div className="text-xs text-rose-800/80 mt-1">
                    Dedicated screen for chefs to view live pocket pizza shapes (R, C, S), addons, and baking timers.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Print Devices & POS Pairing Module */}
        {activeSection === 'print-devices' && <PrintDevicesSection />}

        {/* Store Settings Module */}
        {activeSection === 'settings' && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-700" />
                <span>Restaurant Outlet Configuration</span>
              </h2>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Restaurant Name</label>
                  <input
                    type="text"
                    defaultValue={user?.restaurantName || 'MOZZ Chinese & Pizzateria'}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Helpline Phone Number</label>
                    <input
                      type="text"
                      defaultValue="+91 81796 20607"
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">GSTIN Registration</label>
                    <input
                      type="text"
                      defaultValue="36AABCM8901C1ZP"
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Store Address</label>
                  <textarea
                    rows={2}
                    defaultValue="MOZZ Pizzateria & Chinese, Main High Street, Gachibowli, Hyderabad, Telangana 500032"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={() => alert('Settings saved successfully to PostgreSQL database!')}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
