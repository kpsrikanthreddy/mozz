import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Tag,
  ArrowRight,
  Sparkles,
  MapPin,
  Phone,
  User,
  ShieldCheck,
  Check,
  Lock,
  LocateFixed,
} from 'lucide-react';
import { OrderType } from '../types';
import { PROMO_COUPONS } from '../data/menuData';

interface CartDrawerProps {
  onOpenCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onOpenCheckout }) => {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    subtotal,
    tax,
    deliveryFee,
    discountAmount,
    grandTotal,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    orderType,
    setOrderType,
    tableNumber,
    setTableNumber,
    qrSession,
    isModeLocked,
    customerDetails,
    setCustomerDetails,
    promptCustomerVerification,
  } = useStore();

  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [validationError, setValidationError] = useState('');

  if (!isCartOpen) return null;

  const handleApplyCoupon = (code: string) => {
    setCouponError('');
    const res = applyCoupon(code);
    if (!res.success) {
      setCouponError(res.message);
    } else {
      setCouponInput('');
    }
  };

  const handleProceedToPayment = () => {
    setValidationError('');

    if (cart.length === 0) {
      setValidationError('Your cart is empty.');
      return;
    }

    const isVerified = promptCustomerVerification(() => {
      if (orderType === 'delivery' && !customerDetails.address?.trim()) {
        setValidationError('Please enter your delivery street address.');
        return;
      }
      onOpenCheckout();
    });

    if (!isVerified) {
      return;
    }

    if (orderType === 'delivery' && !customerDetails.address?.trim()) {
      setValidationError('Please enter your delivery street address.');
      return;
    }

    onOpenCheckout();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={() => setIsCartOpen(false)}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-slate-200 text-slate-800 flex flex-col shadow-2xl">
          {/* Header */}
          <div className="p-5 border-b border-slate-200 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Your Food Basket</h2>
                <p className="text-xs text-slate-500">
                  {cart.length} unique item{cart.length === 1 ? '' : 's'} in order
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-slate-400 hover:text-rose-600 transition font-medium"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Cart Scrollable Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {cart.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center text-3xl mb-3 shadow-xs">
                  🥟
                </div>
                <h3 className="text-base font-bold text-slate-900">Your basket is empty</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Add delicious Korean-Style Pocket Pizzas, crispy Chinese starters, or sweet dessert pizzas to start.
                </p>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="mt-4 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-xs"
                >
                  Browse Menu
                </button>
              </div>
            ) : (
              <>
                {/* Order Type / Mode */}
                {isModeLocked ? (
                  <div className="bg-gradient-to-r from-amber-50/90 via-rose-50/50 to-amber-50/90 border border-amber-200/90 rounded-2xl p-3.5 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-100/80 border border-amber-300 flex items-center justify-center text-base shrink-0 shadow-xs">
                          {qrSession.source === 'table_qr' ? '🍽️' : '🛍️'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-slate-900 text-sm">
                              {qrSession.source === 'table_qr'
                                ? `${tableNumber || qrSession.tableNumber || 'Table 1'} (Dine-In)`
                                : 'Counter Express (Takeaway)'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-0.5">
                              <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                              QR VERIFIED
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            {qrSession.source === 'table_qr'
                              ? 'Order mode locked to your table via scanned QR code.'
                              : 'Order mode locked to Counter Takeaway via scanned QR code.'}
                          </p>
                        </div>
                      </div>
                      <div className="p-1 rounded-lg bg-amber-100/60 text-amber-800 border border-amber-200" title="Locked by QR Scan">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Order Delivery Mode
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Online Website Access</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(['delivery', 'takeaway'] as OrderType[]).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setOrderType(type)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold text-center capitalize transition flex items-center justify-center gap-2 ${
                            orderType === type
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          <span className="text-base">{type === 'delivery' ? '🛵' : '🛍️'}</span>
                          <span>{type === 'delivery' ? 'Home Delivery' : 'Takeaway Pickup'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cart Items List */}
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Order Items
                  </div>

                  {cart.map((item) => (
                    <div
                      key={item.cartItemId}
                      className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-3 h-3 rounded-sm border flex items-center justify-center p-0.5 ${
                                item.menuItem.dietary === 'veg'
                                  ? 'border-emerald-500'
                                  : item.menuItem.dietary === 'non-veg'
                                  ? 'border-rose-500'
                                  : 'border-amber-500'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  item.menuItem.dietary === 'veg'
                                    ? 'bg-emerald-500'
                                    : item.menuItem.dietary === 'non-veg'
                                    ? 'bg-rose-500'
                                    : 'bg-amber-500'
                                }`}
                              />
                            </span>
                            <h4 className="font-bold text-slate-900 text-sm">{item.menuItem.name}</h4>
                          </div>

                          {/* Pocket Shape and customization tags */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {item.selectedShape && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                [{item.selectedShape}]{' '}
                                {item.selectedShape === 'R'
                                  ? 'Rectangular'
                                  : item.selectedShape === 'C'
                                  ? 'Circular'
                                  : 'Square'}
                              </span>
                            )}
                            {item.selectedCrust && item.selectedCrust.includes('Cheese Burst') && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                Cheese Burst
                              </span>
                            )}
                            {item.spiceLevel && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] text-slate-600 bg-slate-100">
                                {item.spiceLevel}
                              </span>
                            )}
                          </div>

                          {/* Addons */}
                          {item.addons.length > 0 && (
                            <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                              {item.addons.map((a) => (
                                <div key={a.id} className="flex items-center gap-1">
                                  <span className="text-rose-500">+</span>
                                  <span>{a.name} (₹{a.price})</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {item.specialInstructions && (
                            <div className="text-[10px] text-slate-500 italic mt-1">
                              Note: "{item.specialInstructions}"
                            </div>
                          )}
                        </div>

                        {/* Item Total Price */}
                        <div className="text-right">
                          <span className="text-sm font-black text-slate-900">
                            ₹{item.unitPrice * item.quantity}
                          </span>
                          <div className="text-[10px] text-slate-400">₹{item.unitPrice} each</div>
                        </div>
                      </div>

                      {/* Stepper & Delete */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <button
                          onClick={() => removeFromCart(item.cartItemId)}
                          className="text-slate-400 hover:text-rose-600 text-xs flex items-center gap-1 transition font-medium"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>

                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                          <button
                            onClick={() => updateCartQuantity(item.cartItemId, -1)}
                            className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-900 rounded transition"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 text-xs font-bold text-slate-900 min-w-[20px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(item.cartItemId, 1)}
                            className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-900 rounded transition"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Customer Contact & Address Form */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-rose-500" />
                    Customer & Delivery Details
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Your Full Name *</label>
                      <input
                        type="text"
                        value={customerDetails.name}
                        onChange={(e) => setCustomerDetails({ name: e.target.value })}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-600" />
                        <span>10-Digit WhatsApp Mobile Number *</span>
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-xs font-bold text-slate-500 pointer-events-none">
                          +91
                        </span>
                        <input
                          type="tel"
                          value={customerDetails.phone}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            if (val.length <= 10) setCustomerDetails({ phone: val });
                          }}
                          placeholder="9876543210"
                          maxLength={10}
                          className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 transition"
                        />
                      </div>
                    </div>

                    {orderType === 'delivery' && (
                      <>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Delivery Address (Flat / House / Street) *
                          </label>
                          <textarea
                            value={customerDetails.address || ''}
                            onChange={(e) => setCustomerDetails({ address: e.target.value })}
                            placeholder="Flat 204, Skylark Heights, 2nd Main Road..."
                            rows={2}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 resize-none transition"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Landmark / Directions (Optional)
                          </label>
                          <input
                            type="text"
                            value={customerDetails.landmark || ''}
                            onChange={(e) => setCustomerDetails({ landmark: e.target.value })}
                            placeholder="Near Apollo Pharmacy / Metro Gate 2"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 transition"
                          />
                        </div>

                        {/* Confirmed Delivery GPS Location Pin */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-700 min-w-0 pr-2">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate text-[11px]">
                              {customerDetails.latitude && customerDetails.longitude
                                ? `Confirmed Pin: ${customerDetails.latitude.toFixed(4)}°, ${customerDetails.longitude.toFixed(4)}°`
                                : 'Pin confirmed delivery coordinates'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (navigator.geolocation) {
                                navigator.geolocation.getCurrentPosition(
                                  (pos) => {
                                    setCustomerDetails({
                                      latitude: pos.coords.latitude,
                                      longitude: pos.coords.longitude,
                                    });
                                  },
                                  (err) => console.warn('Geolocation error:', err.message),
                                  { enableHighAccuracy: true, timeout: 8000 }
                                );
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-[11px] font-bold text-slate-800 transition shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
                          >
                            <LocateFixed className="w-3 h-3 text-emerald-600" />
                            <span>{customerDetails.latitude ? 'Update Pin' : 'Use My GPS'}</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Promo Code Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-rose-500" />
                      Promo & Discounts
                    </span>
                    {appliedCoupon && (
                      <button
                        onClick={removeCoupon}
                        className="text-[11px] text-rose-600 hover:underline font-semibold"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {appliedCoupon ? (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 font-bold" />
                        <span>Code '{appliedCoupon}' Applied!</span>
                      </div>
                      <span className="font-bold text-emerald-700">-₹{discountAmount}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                          placeholder="Enter Promo Code (e.g. MOZZFIRST)"
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 uppercase focus:outline-none focus:border-rose-500 transition"
                        />
                        <button
                          onClick={() => handleApplyCoupon(couponInput)}
                          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-2xs"
                        >
                          Apply
                        </button>
                      </div>

                      {couponError && (
                        <p className="text-[11px] text-rose-600 font-medium">{couponError}</p>
                      )}

                      {/* Quick 1-click pills */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {PROMO_COUPONS.slice(0, 3).map((cp) => (
                          <button
                            key={cp.code}
                            onClick={() => handleApplyCoupon(cp.code)}
                            className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-700 hover:border-rose-400 hover:text-rose-600 transition flex items-center gap-1 shadow-2xs"
                          >
                            <span>{cp.code}</span>
                            <span className="text-slate-400">
                              ({cp.discountType === 'percentage' ? `${cp.discountValue}%` : `₹${cp.discountValue}`})
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Detailed Bill Summary */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Bill Summary
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Items Subtotal</span>
                    <span className="font-semibold text-slate-900">₹{subtotal.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>GST (5%)</span>
                    <span className="font-semibold text-slate-900">₹{tax.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Delivery Charges</span>
                    {deliveryFee === 0 ? (
                      <span className="text-emerald-600 font-bold">FREE</span>
                    ) : (
                      <span className="font-semibold text-slate-900">₹{deliveryFee}</span>
                    )}
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Promo Discount</span>
                      <span>-₹{discountAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
                    <span>Grand Total</span>
                    <span className="text-lg font-black text-rose-600">₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sticky Checkout CTA Footer */}
          {cart.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-white space-y-3">
              {validationError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {validationError}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-rose-600" />
                  Razorpay 256-bit Secure UPI & Cards
                </span>
                <span className="text-slate-400">Instant Verification</span>
              </div>

              <button
                onClick={handleProceedToPayment}
                id="proceed-to-checkout-btn"
                className="w-full py-3.5 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md shadow-rose-600/20 active:scale-[0.99] transition flex items-center justify-between"
              >
                <span>Proceed to UPI & Pay</span>
                <div className="flex items-center gap-1.5 font-black text-base text-white">
                  <span>₹{grandTotal.toFixed(2)}</span>
                  <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
