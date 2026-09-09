import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { OrderStatus } from '../types';
import {
  MapPin,
  Clock,
  RefreshCw,
  Printer,
  MessageSquare,
  AlertCircle,
  Calendar as CalendarIcon,
  Store,
} from 'lucide-react';
import { PrintModal } from './PrintModal';
import { OrderCalendarView } from './OrderCalendarView';
import { GoogleMapsLiveTracker, MOZZ_RESTAURANT_LOCATION } from './GoogleMapsLiveTracker';

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
    title: 'Quality Check & Thermal Packing',
    subtitle: 'Sealed hot in thermal steam-release box for home delivery',
    icon: '📦',
  },
  {
    status: 'out_for_delivery',
    title: 'Out for Delivery',
    subtitle: 'Dispatched from MOZZ Kitchen to confirmed delivery location',
    icon: '🛵',
  },
  {
    status: 'delivered',
    title: 'Delivered to Doorstep',
    subtitle: 'Fresh & piping hot at your door! Enjoy your meal',
    icon: '🎉',
  },
];

export const LiveOrderTracker: React.FC<LiveOrderTrackerProps> = ({ onBackToMenu }) => {
  const {
    orders,
    activeOrderId,
    activeOrder,
    setActiveOrderId,
    fetchOrderById,
    cancelOrder,
  } = useStore();

  const [searchOrderId, setSearchOrderId] = useState('');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [trackerView, setTrackerView] = useState<'live' | 'calendar'>('live');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [detectedAddress, setDetectedAddress] = useState<string | null>(null);

  const order = activeOrder || (activeOrderId ? orders.find((o) => o.id === activeOrderId) : orders[0]);

  // Automatic 10-second polling for active order (stops when delivered or cancelled)
  useEffect(() => {
    const targetId = order?.id || activeOrderId;
    if (!targetId) return;

    if (order && (order.status === 'delivered' || order.status === 'cancelled')) {
      return;
    }

    const poll = async () => {
      try {
        await fetchOrderById(targetId);
      } catch (e) {
        console.warn('[OrderTracking] Status poll failed:', e);
      }
    };

    const interval = setInterval(poll, 10000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        poll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [order?.id, order?.status, activeOrderId, fetchOrderById]);

  const handleManualRefresh = async () => {
    if (!order?.id) return;
    setIsRefreshing(true);
    await fetchOrderById(order.id);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchOrderId.trim().toUpperCase();
    if (!query) return;

    const matched = orders.find(
      (o) =>
        o.id.toUpperCase() === query ||
        (o.orderNumber && o.orderNumber.toUpperCase() === query)
    );

    if (matched) {
      setActiveOrderId(matched.id);
      fetchOrderById(matched.id);
      setSearchOrderId('');
    } else {
      alert(`Order #${query} not found. Please check the order number.`);
    }
  };

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100">
          <Store className="w-10 h-10 text-rose-500" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">No Active Order Found</h2>
        <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
          You have not placed any orders yet, or the session was refreshed. Track an order by entering the order number below.
        </p>

        {/* Order search box */}
        <form onSubmit={handleSearch} className="flex gap-2 max-w-xs mx-auto mt-6">
          <input
            type="text"
            value={searchOrderId}
            onChange={(e) => setSearchOrderId(e.target.value)}
            placeholder="e.g. MOZZ-1234"
            className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 uppercase"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition"
          >
            Track
          </button>
        </form>

        <button
          onClick={onBackToMenu}
          className="mt-6 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition inline-flex items-center gap-2"
        >
          <span>Explore Menu & Place Order</span>
        </button>
      </div>
    );
  }

  const currentStageIndex = STAGES.findIndex((s) => s.status === order.status);
  const isDelivered = order.status === 'delivered';
  const isCancelled = order.status === 'cancelled';

  const getStatusHeadline = () => {
    switch (order.status) {
      case 'placed':
        return 'Order Placed • Sent to MOZZ Kitchen';
      case 'confirmed':
        return 'Order Confirmed • Assigned to Station';
      case 'baking':
        return 'Baking & Cooking in Stone-Deck Oven';
      case 'packing':
        return 'Quality Check & Thermal Packing';
      case 'out_for_delivery':
        return 'Out for Delivery • Dispatched from Kitchen';
      case 'delivered':
        return 'Order Delivered to Doorstep!';
      case 'cancelled':
        return 'Order Cancelled';
      default:
        return 'Order In Progress';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Controls: Search Bar & Switch Orders */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <h1 className="text-lg sm:text-xl font-black text-slate-900">
              {trackerView === 'live' ? 'Order Tracking' : 'Order History & Calendar'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {trackerView === 'live'
              ? 'Real-time kitchen order progress from MOZZ Chinese & Pizzateria'
              : 'Browse all orders and daily summary by date on the calendar'}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Tracker vs Calendar View Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setTrackerView('live')}
              className={`px-3 py-1.5 rounded-xl transition ${
                trackerView === 'live'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Order Tracking
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
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-xs cursor-pointer"
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
          {/* Left 7 Cols: Interactive Map & Genuine Timeline */}
          <div className="lg:col-span-7 space-y-6">
            {/* Google Maps Order Tracking Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
              {/* Header with Genuine Kitchen Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>KITCHEN & ORDER STATUS</span>
                  </span>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                    {getStatusHeadline()}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Estimated Time</div>
                    <div className="text-sm sm:text-base font-mono font-bold text-slate-800 flex items-center justify-end gap-1">
                      <Clock className="w-3.5 h-3.5 text-rose-500" />
                      <span>{order.estimatedDeliveryTimeMinutes || 35} mins</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Required Telemetry Disclaimer Notice */}
              <div className="mb-4 p-3 bg-amber-50/90 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">
                  Live rider location is not currently available. Order progress below reflects updates from the restaurant.
                </div>
              </div>

              {/* Google Maps Map displaying Restaurant location & Confirmed delivery location */}
              <div className="mb-4">
                <GoogleMapsLiveTracker
                  order={order}
                  onAddressDetected={(address) => setDetectedAddress(address)}
                />
              </div>

              {/* Status Sync Footer */}
              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isDelivered || isCancelled ? 'bg-slate-400' : 'bg-emerald-500'}`} />
                  <span className="text-[11px] text-slate-500 font-medium">
                    {isDelivered
                      ? 'Order delivered & completed'
                      : isCancelled
                      ? 'Order cancelled'
                      : 'Updated directly from MOZZ Restaurant POS'}
                  </span>
                </div>
                <button
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 transition disabled:opacity-50 cursor-pointer"
                  title="Refresh latest status from restaurant"
                >
                  <RefreshCw className={`w-3 h-3 text-rose-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
                </button>
              </div>
            </div>

            {/* Genuine Kitchen / Order-Status Timeline */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600">
                  Genuine Kitchen / Order-Status Timeline
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  Order #{order.id}
                </span>
              </div>

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
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                              CURRENT STATUS
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

          {/* Right 5 Cols: Order Summary Receipt & Details */}
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
                    {order.paymentStatus === 'paid' ? 'PAID' : 'COD PENDING'}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              {/* Customer Details: Confirmed delivery location */}
              <div className="text-xs space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Confirmed delivery location:</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-600" />
                    Confirmed location
                  </span>
                </div>
                <div className="text-slate-900 font-semibold">{order.customer?.name} ({order.customer?.phone})</div>
                <div className="text-slate-600 text-[11px] leading-relaxed">
                  {detectedAddress || order.customer?.address || 'Gachibowli, Hyderabad'}
                </div>
                {order.customer?.latitude && order.customer?.longitude && (
                  <div className="text-[10px] font-mono text-emerald-600">
                    GPS Coordinates: {Number(order.customer.latitude).toFixed(6)}, {Number(order.customer.longitude).toFixed(6)}
                  </div>
                )}
                {order.customer?.landmark && (
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

                      {item.addons && item.addons.length > 0 && (
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
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-200 transition cursor-pointer"
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
                    className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold transition cursor-pointer"
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
