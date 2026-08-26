import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { OrderStatus, Order } from '../types';
import {
  MapPin,
  Clock,
  Phone,
  CheckCircle2,
  ChefHat,
  PackageCheck,
  Bike,
  Sparkles,
  RefreshCw,
  Printer,
  MessageSquare,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { PrintModal } from './PrintModal';
import { OrderCalendarView } from './OrderCalendarView';

interface LiveOrderTrackerProps {
  onBackToMenu: () => void;
}

const STAGES: {
  status: OrderStatus;
  title: string;
  subtitle: string;
  icon: string;
}[] = [
  {
    status: 'placed',
    title: 'Order Placed',
    subtitle: 'Payment verified & sent to MOZZ Kitchen',
    icon: '📝',
  },
  {
    status: 'confirmed',
    title: 'Order Confirmed',
    subtitle: 'Kitchen assigned your pocket pizzas & wok order',
    icon: '✅',
  },
  {
    status: 'baking',
    title: 'Baking & Cooking',
    subtitle: 'Stone-deck oven baking Korean pocket pizzas',
    icon: '🔥',
  },
  {
    status: 'packing',
    title: 'Quality Check & Packing',
    subtitle: 'Sealed hot in thermal steam-release box',
    icon: '📦',
  },
  {
    status: 'out_for_delivery',
    title: 'Out for Delivery',
    subtitle: 'Rider is speeding your order to your door',
    icon: '🛵',
  },
  {
    status: 'delivered',
    title: 'Order Delivered',
    subtitle: 'Fresh & piping hot! Enjoy your meal',
    icon: '🎉',
  },
];

export const LiveOrderTracker: React.FC<LiveOrderTrackerProps> = ({ onBackToMenu }) => {
  const {
    orders,
    activeOrderId,
    activeOrder,
    setActiveOrderId,
    updateOrderStatus,
    cancelOrder,
  } = useStore();

  const [searchOrderId, setSearchOrderId] = useState('');
  const [etaRemainingSeconds, setEtaRemainingSeconds] = useState(720); // 12 mins default
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [trackerView, setTrackerView] = useState<'live' | 'calendar'>('live');

  // Live timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setEtaRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const order = activeOrder || orders[0];

  const getStageIndex = (status: OrderStatus) => {
    if (status === 'ready_for_pickup') return 4;
    const idx = STAGES.findIndex((s) => s.status === status);
    return idx === -1 ? 0 : idx;
  };

  const currentStageIndex = order ? getStageIndex(order.status) : 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchOrderId.trim().toUpperCase();
    const found = orders.find((o) => o.id.toUpperCase() === clean);
    if (found) {
      setActiveOrderId(found.id);
      setSearchOrderId('');
    } else {
      alert(`Order #${clean} not found. Please check order number.`);
    }
  };

  const advanceStatusDemo = () => {
    if (!order) return;
    const orderStatuses: OrderStatus[] = [
      'placed',
      'confirmed',
      'baking',
      'packing',
      'out_for_delivery',
      'delivered',
    ];
    const currentIndex = orderStatuses.indexOf(order.status);
    const nextStatus = orderStatuses[(currentIndex + 1) % orderStatuses.length];
    updateOrderStatus(order.id, nextStatus, `Live simulation update: ${nextStatus}`);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!order) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-3xl mx-auto mb-4">
          🔍
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Active Order Found</h2>
        <p className="text-xs text-slate-500 mb-6">
          Place your order from the menu or enter an existing Order ID to track live.
        </p>
        <button
          onClick={onBackToMenu}
          className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-xs"
        >
          Explore Menu
        </button>
      </div>
    );
  }

  const isDelivered = order.status === 'delivered';
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Controls: Search Bar & Switch Orders */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            <h1 className="text-lg sm:text-xl font-black text-slate-900">
              {trackerView === 'live' ? 'Live Kitchen & Delivery Tracking' : 'Order History & Calendar'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {trackerView === 'live'
              ? 'Real-time status synced with MOZZ Pizzateria POS & Delivery Fleet'
              : 'Browse all orders and daily summary by date on the calendar'}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Live vs Calendar View Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setTrackerView('live')}
              className={`px-3 py-1.5 rounded-xl transition ${
                trackerView === 'live'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Live Tracker
            </button>
            <button
              onClick={() => setTrackerView('calendar')}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
                trackerView === 'calendar'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>
          </div>

          {/* Search Order ID Form */}
          {trackerView === 'live' && (
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 sm:flex-none">
              <input
                type="text"
                value={searchOrderId}
                onChange={(e) => setSearchOrderId(e.target.value)}
                placeholder="Search Order # (e.g. MOZZ-8901)"
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 uppercase focus:outline-none focus:border-rose-500 focus:bg-white w-full sm:w-48 transition"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-xs"
              >
                Track
              </button>
            </form>
          )}
        </div>
      </div>

      {trackerView === 'calendar' ? (
        <OrderCalendarView
          orders={orders}
          onSelectOrder={(ord) => {
            setActiveOrderId(ord.id);
            setTrackerView('live');
          }}
          onPrintBill={(ord) => {
            setActiveOrderId(ord.id);
            setIsPrintModalOpen(true);
          }}
        />
      ) : (
        /* Main Tracking Grid */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Interactive Map & Live Timeline */}
        <div className="lg:col-span-7 space-y-6">
          {/* Animated Delivery Map Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
            {/* Header with ETA */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  {order.orderType.toUpperCase()} STATUS
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-1">
                  {isDelivered
                    ? 'Order Delivered!'
                    : isCancelled
                    ? 'Order Cancelled'
                    : order.orderType === 'takeaway'
                    ? 'Ready for Counter Pickup'
                    : 'Estimated Arrival in ' + formatTime(etaRemainingSeconds)}
                </h2>
              </div>

              {!isDelivered && !isCancelled && (
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase">Live ETA</div>
                  <div className="text-2xl font-mono font-black text-rose-600">
                    {Math.ceil(etaRemainingSeconds / 60)} mins
                  </div>
                </div>
              )}
            </div>

            {/* Simulated Live Route Canvas Visualization */}
            <div className="w-full h-56 sm:h-64 rounded-2xl bg-slate-950 border border-slate-800 relative overflow-hidden flex flex-col justify-between p-4 shadow-inner">
              {/* Map grid lines background */}
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#F43F5E_1px,transparent_1px)] [background-size:16px_16px]" />

              {/* Simulated Map Route Path */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M 60 180 Q 180 80, 320 120 T 520 70"
                  fill="none"
                  stroke="#F43F5E"
                  strokeWidth="4"
                  strokeDasharray="6 6"
                  className="animate-pulse"
                />
              </svg>

              {/* Kitchen Origin Marker */}
              <div className="relative z-10 flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-red-600 border-2 border-red-400 text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-red-950/60">
                  🥟
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1 text-[11px] shadow">
                  <div className="font-bold text-white">MOZZ Pizzateria Kitchen</div>
                  <div className="text-slate-400 text-[10px]">Stone-Deck Ovens Active</div>
                </div>
              </div>

              {/* Animated Moving Rider Marker */}
              <div
                className={`relative z-10 self-center transition-all duration-700 ${
                  order.status === 'out_for_delivery'
                    ? 'animate-bounce'
                    : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 p-0.5 shadow-xl shadow-rose-950/50">
                    <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center text-lg">
                      🛵
                    </div>
                  </div>
                  <div className="bg-rose-500 text-white font-bold px-2 py-0.5 rounded-full text-[10px] shadow">
                    {order.driverDetails?.name || 'Rider En Route'}
                  </div>
                </div>
              </div>

              {/* Destination Customer Marker */}
              <div className="relative z-10 flex items-center justify-end gap-2">
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1 text-[11px] shadow text-right">
                  <div className="font-bold text-emerald-400">
                    {order.orderType === 'dine_in' ? order.customer.tableNumber || 'Table' : 'Delivery Address'}
                  </div>
                  <div className="text-slate-400 text-[10px] max-w-[140px] truncate">
                    {order.customer.address || order.customer.name}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 border-2 border-emerald-400 text-white flex items-center justify-center font-bold text-sm shadow-lg">
                  📍
                </div>
              </div>
            </div>

            {/* Rider details card (if delivery) */}
            {order.orderType === 'delivery' && order.driverDetails && (
              <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-lg shadow-2xs">
                    🧑‍🍳
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{order.driverDetails.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                        Vaccinated & Verified
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">{order.driverDetails.vehicleNumber}</div>
                  </div>
                </div>

                <a
                  href={`tel:${order.driverDetails.phone}`}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-rose-600 font-bold text-xs border border-slate-200 flex items-center gap-1.5 transition shadow-2xs"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Rider</span>
                </a>
              </div>
            )}

            {/* Demo Fast-Forward Status Simulation Button */}
            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Interactive Preview Mode: Test status progression
              </span>
              <button
                onClick={advanceStatusDemo}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 transition"
              >
                <RefreshCw className="w-3 h-3 text-rose-600" />
                <span>Simulate Next Stage</span>
              </button>
            </div>
          </div>

          {/* Timeline Step-by-Step Pipeline */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600">
              Kitchen Preparation Pipeline
            </h3>

            <div className="space-y-4">
              {STAGES.map((stage, idx) => {
                const isPassed = idx <= currentStageIndex;
                const isCurrent = idx === currentStageIndex;

                return (
                  <div key={stage.status} className="flex items-start gap-4 relative">
                    {/* Connecting line */}
                    {idx < STAGES.length - 1 && (
                      <div
                        className={`absolute left-4 top-8 bottom-0 w-0.5 -ml-px transition-colors ${
                          idx < currentStageIndex ? 'bg-rose-500' : 'bg-slate-200'
                        }`}
                      />
                    )}

                    {/* Step Icon */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all relative z-10 ${
                        isCurrent
                          ? 'bg-rose-600 text-white ring-4 ring-rose-100 font-black shadow-xs'
                          : isPassed
                          ? 'bg-rose-100 text-rose-700 border border-rose-300'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    >
                      <span>{stage.icon}</span>
                    </div>

                    {/* Step Details */}
                    <div className="flex-1 pb-3">
                      <div className="flex items-center justify-between">
                        <h4
                          className={`text-sm font-bold ${
                            isCurrent ? 'text-rose-600' : isPassed ? 'text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          {stage.title}
                        </h4>
                        {isCurrent && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                            IN PROGRESS
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{stage.subtitle}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Order Summary Receipt & Support */}
        <div className="lg:col-span-5 space-y-6">
          {/* Order Details Receipt Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Order Reference
                </div>
                <div className="text-lg font-black text-rose-600 font-mono">#{order.id}</div>
              </div>

              <div className="text-right">
                <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {order.paymentStatus === 'paid' ? 'PAID VIA UPI' : 'COD PENDING'}
                </span>
                <div className="text-[10px] text-slate-400 mt-1">
                  {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {/* Customer Details */}
            <div className="text-xs space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div className="font-bold text-slate-700">Deliver To:</div>
              <div className="text-slate-900 font-semibold">{order.customer.name} ({order.customer.phone})</div>
              {order.customer.address && (
                <div className="text-slate-600 text-[11px] leading-relaxed">{order.customer.address}</div>
              )}
              {order.customer.landmark && (
                <div className="text-rose-600/80 text-[10px]">Landmark: {order.customer.landmark}</div>
              )}
            </div>

            {/* Itemized Order List */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Items in this Order
              </div>

              {order.items.map((item, i) => (
                <div key={i} className="flex items-start justify-between text-xs gap-2 py-1.5 border-b border-slate-100">
                  <div>
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <span>{item.quantity}x</span>
                      <span>{item.menuItem.name}</span>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {item.selectedShape && (
                        <span className="text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-1.5 rounded">
                          [{item.selectedShape}]{' '}
                          {item.selectedShape === 'R'
                            ? 'Rectangular'
                            : item.selectedShape === 'C'
                            ? 'Circular'
                            : 'Square'}
                        </span>
                      )}
                      {item.selectedCrust && (
                        <span className="text-[10px] text-slate-500">{item.selectedCrust}</span>
                      )}
                      {item.spiceLevel && (
                        <span className="text-[10px] text-rose-500">({item.spiceLevel})</span>
                      )}
                    </div>

                    {item.addons.length > 0 && (
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Addons: {item.addons.map((a) => a.name).join(', ')}
                      </div>
                    )}
                  </div>

                  <div className="font-black text-rose-600 text-sm">
                    ₹{item.unitPrice * item.quantity}
                  </div>
                </div>
              ))}
            </div>

            {/* Bill Summary */}
            <div className="pt-2 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Items Subtotal</span>
                <span className="text-slate-800 font-medium">₹{order.itemTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST (5%)</span>
                <span className="text-slate-800 font-medium">₹{order.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Fee</span>
                {order.deliveryFee === 0 ? (
                  <span className="text-emerald-600 font-bold">FREE</span>
                ) : (
                  <span className="text-slate-800 font-medium">₹{order.deliveryFee}</span>
                )}
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Coupon Discount ({order.couponCode})</span>
                  <span>-₹{order.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-black text-slate-900">
                <span>Grand Total Paid</span>
                <span className="text-base text-rose-600">₹{order.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions: Print Receipt & WhatsApp Support */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setIsPrintModalOpen(true)}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-200 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Bill</span>
              </button>

              <a
                href={`https://wa.me/?text=Hi%20MOZZ%20Team%2C%20I%20am%20tracking%20my%20Order%20%23${order.id}%20total%20INR%20${order.grandTotal}`}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center justify-center gap-1.5 border border-emerald-200 transition"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>WhatsApp Help</span>
              </a>
            </div>

            {/* Cancel Button for Wrongly Placed Orders */}
            {order.status !== 'delivered' && order.status !== 'cancelled' && (
              <div className="pt-2">
                <button
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to cancel Order #${order.id}?`)) {
                      cancelOrder(order.id, 'Cancelled by customer (wrongly placed)');
                    }
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold transition"
                >
                  Cancel Wrongly Placed Order ✕
                </button>
              </div>
            )}

            {order.status === 'cancelled' && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-center text-xs font-bold text-rose-700">
                This order was cancelled.
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Customer Thermal Receipt Modal */}
      {isPrintModalOpen && (
        <PrintModal
          order={order}
          type="receipt"
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}
    </div>
  );
};
