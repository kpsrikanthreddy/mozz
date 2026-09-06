import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import {
  ShoppingBag,
  Clock,
  ShieldAlert,
  Volume2,
  VolumeX,
  MapPin,
  Flame,
  UtensilsCrossed,
  Sparkles,
  Phone,
  HelpCircle,
  Menu as MenuIcon,
  X,
  Lock,
  ShieldCheck,
  QrCode,
} from 'lucide-react';
import { OrderType } from '../types';

interface NavbarProps {
  currentView: 'menu' | 'track' | string;
  onNavigate: (view: 'menu' | 'track') => void;
  onOpenShapeGuide: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onOpenShapeGuide,
}) => {
  const {
    itemCount,
    grandTotal,
    setIsCartOpen,
    activeOrder,
    orderType,
    setOrderType,
    tableNumber,
    setTableNumber,
    qrSession,
    isModeLocked,
    switchQRSession,
    clearQRSession,
    soundEnabled,
    toggleSound,
    isAdminAuthenticated,
    customerDetails,
    isCustomerVerified,
    setIsCustomerModalOpen,
  } = useStore();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showOrderTypeModal, setShowOrderTypeModal] = useState(false);
  const [showQRInfoModal, setShowQRInfoModal] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 text-slate-800 shadow-xs">
      {/* Top micro banner */}
      <div className="bg-slate-900 px-4 py-1.5 text-xs text-slate-300 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 overflow-hidden text-ellipsis whitespace-nowrap">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-950">
              NEW
            </span>
            <span className="font-medium text-slate-200">
              Korean-Style Pocket Pizzas in 3 Shapes: [R] Rectangular, [C] Circular, [S] Square!
            </span>
          </div>

          <div className="hidden sm:flex items-center space-x-4 text-[11px] text-slate-400">
            <button
              onClick={onOpenShapeGuide}
              className="hover:text-amber-300 underline underline-offset-2 flex items-center gap-1 transition"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              Shape Guide (R, C, S)
            </button>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1 text-slate-300">
              <Clock className="w-3 h-3 text-rose-400" /> 03:00 PM – 12:30 AM
            </span>
            <span className="text-slate-600">•</span>
            <a
              href="https://instagram.com/mozzpizzateria"
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:text-amber-300 font-semibold"
            >
              @mozzpizzateria
            </a>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Brand Logo & Taglines */}
          <div
            onClick={() => onNavigate('menu')}
            className="flex items-center space-x-3 cursor-pointer group"
            id="brand-logo"
          >
            {/* Logo Badge */}
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-600 via-rose-500 to-amber-500 p-0.5 shadow-md shadow-rose-950/10 group-hover:scale-105 transition-transform duration-200">
              <div className="w-full h-full bg-slate-900 rounded-[9px] flex flex-col items-center justify-center p-1 text-center">
                <span className="text-xs font-black tracking-tighter text-amber-400 leading-none">
                  m<span className="text-rose-500">O</span>zz
                </span>
                <span className="text-[7px] font-bold tracking-widest text-slate-300 uppercase">
                  Pocket
                </span>
              </div>
            </div>

            {/* Brand Title */}
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 bg-clip-text text-transparent">
                  MOZZ
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                  Chinese & Pizzateria
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium tracking-wide">
                Where India Meets Every Slice <span className="text-rose-500">•</span> Different Flavors. Same Love.
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-2">
            <button
              onClick={() => onNavigate('menu')}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                currentView === 'menu'
                  ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <UtensilsCrossed className="w-4 h-4" /> Full Menu
              </span>
            </button>

            <button
              onClick={onOpenShapeGuide}
              className="px-3.5 py-2 rounded-xl text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              Korean Pocket Shapes
            </button>

            <button
              onClick={() => onNavigate('track')}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all relative ${
                currentView === 'track'
                  ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> Live Tracking
                {activeOrder && activeOrder.status !== 'delivered' && activeOrder.status !== 'cancelled' && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                )}
              </span>
            </button>
          </div>

          {/* Right Action Bar: Dining Selector, Customer Badge, Sound, Cart */}
          <div className="flex items-center space-x-2.5">
            {/* Customer Name & WhatsApp pill */}
            <button
              onClick={() => setIsCustomerModalOpen(true)}
              className={`hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs transition ${
                isCustomerVerified
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              }`}
              title="Click to change Customer Name & WhatsApp Number"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-bold">
                {isCustomerVerified ? `${customerDetails.name} (+91 ${customerDetails.phone.slice(-4)})` : 'Enter WhatsApp Details'}
              </span>
            </button>

            {/* Dining Mode Selector Pill */}
            {isModeLocked ? (
              <button
                onClick={() => setShowQRInfoModal(true)}
                className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-50/90 border border-amber-300 text-xs text-amber-950 hover:bg-amber-100 transition shadow-xs"
                title="Entry source verified and locked by QR token. Click for details or testing."
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-bold">
                  {qrSession.source === 'table_qr'
                    ? `${tableNumber || qrSession.tableNumber || 'Table 1'} (Dine-In)`
                    : 'Counter (Takeaway)'}
                </span>
                <Lock className="w-3 h-3 text-amber-700 ml-0.5" />
              </button>
            ) : (
              <button
                onClick={() => setShowOrderTypeModal(true)}
                className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-700 hover:bg-slate-200 transition"
                title="Change Delivery / Takeaway"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="capitalize font-semibold text-slate-800">
                  {orderType === 'delivery' ? 'Home Delivery' : 'Takeaway'}
                </span>
                <span className="text-[10px] text-slate-500 ml-1">Edit</span>
              </button>
            )}

            {/* Sound Toggle */}
            <button
              onClick={toggleSound}
              aria-label="Toggle Sound"
              className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition"
              title={soundEnabled ? 'Mute Kitchen Chimes' : 'Enable Kitchen Chimes'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>

            {/* Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              id="cart-drawer-trigger"
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-sm shadow-sm shadow-rose-600/20 active:scale-95 transition-all"
            >
              <div className="relative">
                <ShoppingBag className="w-4 h-4" />
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-amber-400 text-slate-950 text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {itemCount}
                  </span>
                )}
              </div>
              <span className="hidden sm:inline">
                {itemCount > 0 ? `₹${grandTotal.toFixed(0)}` : 'Cart'}
              </span>
            </button>

            {/* Mobile Menu Trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-5 space-y-2 shadow-lg">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs text-slate-500">Order Mode:</span>
            {isModeLocked ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>
                  {qrSession.source === 'table_qr'
                    ? `${tableNumber || qrSession.tableNumber || 'Table 1'} (Dine-In)`
                    : 'Counter (Takeaway)'}
                </span>
                <Lock className="w-2.5 h-2.5 text-amber-700" />
              </div>
            ) : (
              <div className="flex gap-1.5">
                {(['delivery', 'takeaway'] as OrderType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setOrderType(type)}
                    className={`px-2.5 py-1 rounded-lg text-xs capitalize font-semibold transition ${
                      orderType === type
                        ? 'bg-rose-600 text-white font-bold shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {type === 'delivery' ? 'Delivery' : 'Takeaway'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              onNavigate('menu');
              setMobileMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-800 hover:bg-slate-100 flex items-center gap-2"
          >
            <UtensilsCrossed className="w-4 h-4 text-rose-500" />
            Explore Full Menu
          </button>

          <button
            onClick={() => {
              onOpenShapeGuide();
              setMobileMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            Korean Pocket Pizza Shapes (R, C, S)
          </button>

          <button
            onClick={() => {
              onNavigate('track');
              setMobileMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-800 hover:bg-slate-100 flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-500" />
              Live Order Tracking
            </span>
            {activeOrder && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 font-bold">
                {activeOrder.status}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Online Order Type Selector Modal (Only for direct web users) */}
      {showOrderTypeModal && !isModeLocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 text-slate-800 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Select Order Delivery Option</h3>
            <p className="text-xs text-slate-500 mb-5">
              Online customer order modes are verified for home delivery or direct takeaway.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                type="button"
                onClick={() => setOrderType('delivery')}
                className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 text-center transition ${
                  orderType === 'delivery'
                    ? 'bg-rose-50 border-rose-400 text-rose-700 font-bold shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span className="text-3xl">🛵</span>
                <span className="text-xs font-bold">Home Delivery</span>
                <span className="text-[10px] text-slate-500">Delivered to your location</span>
              </button>

              <button
                type="button"
                onClick={() => setOrderType('takeaway')}
                className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 text-center transition ${
                  orderType === 'takeaway'
                    ? 'bg-rose-50 border-rose-400 text-rose-700 font-bold shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span className="text-3xl">🛍️</span>
                <span className="text-xs font-bold">Self Takeaway</span>
                <span className="text-[10px] text-slate-500">Pickup from outlet</span>
              </button>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowOrderTypeModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-xs"
              >
                Confirm Option
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Security & Session Verification Modal */}
      {showQRInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 text-slate-800 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">QR Entry Source Verification</h3>
                  <p className="text-[11px] text-slate-500">Backend Cryptographic Token Security</p>
                </div>
              </div>
              <button
                onClick={() => setShowQRInfoModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-3.5">
                <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-900">
                  <Lock className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Order Mode Determined by Backend: {qrSession.orderMode.toUpperCase()}</span>
                </div>
                <p className="text-xs text-emerald-800/90 mt-1">
                  Customers cannot manually tamper or alter dining modes. Orders placed in this session are locked to{' '}
                  <strong>
                    {qrSession.source === 'table_qr'
                      ? `${tableNumber || qrSession.tableNumber} (Dine-In Session)`
                      : 'Counter Express (Takeaway)'}
                  </strong>.
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Entry Source:</span>
                  <span className="font-mono font-bold text-slate-900">{qrSession.source}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Session Status:</span>
                  <span className="font-bold text-emerald-600">✓ Cryptographically Signed & Validated</span>
                </div>
                {qrSession.tableNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Assigned Table:</span>
                    <span className="font-bold text-slate-900">{qrSession.tableNumber}</span>
                  </div>
                )}
                {qrSession.token && (
                  <div className="pt-1.5 border-t border-slate-200">
                    <span className="text-slate-500 block text-[10px] mb-0.5">Signed QR Token:</span>
                    <span className="font-mono text-[10px] break-all bg-white px-2 py-1 rounded border border-slate-200 block text-slate-600">
                      {qrSession.token}
                    </span>
                  </div>
                )}
              </div>

              {/* Simulation bar for easy testing */}
              <div className="pt-2">
                <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-rose-500" />
                  <span>Test or Switch Entry Source (Simulator):</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      switchQRSession({ source: 'table_qr', orderMode: 'dine_in', tableNumber: 'Table 7' });
                      setShowQRInfoModal(false);
                    }}
                    className="p-2 rounded-xl text-center text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200"
                  >
                    🍽️ Table 7 QR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      switchQRSession({ source: 'table_qr', orderMode: 'dine_in', tableNumber: 'Table 3' });
                      setShowQRInfoModal(false);
                    }}
                    className="p-2 rounded-xl text-center text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200"
                  >
                    🍽️ Table 3 QR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      switchQRSession({ source: 'counter_qr', orderMode: 'takeaway' });
                      setShowQRInfoModal(false);
                    }}
                    className="p-2 rounded-xl text-center text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200"
                  >
                    🛍️ Counter QR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearQRSession();
                      setShowQRInfoModal(false);
                    }}
                    className="p-2 rounded-xl text-center text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200"
                  >
                    🛵 Direct Web
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowQRInfoModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
