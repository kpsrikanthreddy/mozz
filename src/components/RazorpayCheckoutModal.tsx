import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { PaymentMethod, Order } from '../types';
import confetti from 'canvas-confetti';
import {
  X,
  ShieldCheck,
  QrCode,
  Smartphone,
  CreditCard,
  Building2,
  Banknote,
  CheckCircle2,
  Lock,
  Zap,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

interface RazorpayCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCompleted: (order: Order) => void;
}

// Dynamically load Razorpay checkout.js script if not already present
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window.Razorpay === 'function') {
      resolve(true);
      return;
    }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export const RazorpayCheckoutModal: React.FC<RazorpayCheckoutModalProps> = ({
  isOpen,
  onClose,
  onOrderCompleted,
}) => {
  const { grandTotal, customerDetails, createOrder, orderType } = useStore();

  const [activeTab, setActiveTab] = useState<'standard' | 'upi' | 'card' | 'netbanking' | 'cod'>('standard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [processingStep, setProcessingStep] = useState('Connecting to Bank Gateway...');
  const [errorMessage, setErrorMessage] = useState('');
  const [razorpayAvailable, setRazorpayAvailable] = useState<boolean | null>(null);

  // Check Razorpay server gateway configuration on mount
  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage('');
    fetch('/api/razorpay/config')
      .then(async (res) => {
        if (!res.ok) {
          setRazorpayAvailable(false);
          const errData = await res.json().catch(() => ({}));
          setErrorMessage(errData.message || 'Online payment is temporarily unavailable. Please try again later.');
        } else {
          setRazorpayAvailable(true);
        }
      })
      .catch(() => {
        setRazorpayAvailable(false);
        setErrorMessage('Online payment is temporarily unavailable. Please try again later.');
      });
  }, [isOpen]);

  if (!isOpen) return null;

  // Real Razorpay Checkout Launcher (Production Only - No Simulations)
  const launchRazorpayCheckout = async (preferredFilter?: { method?: string }) => {
    setErrorMessage('');

    if (orderType === 'delivery') {
      if (typeof customerDetails.latitude !== 'number' || typeof customerDetails.longitude !== 'number') {
        setErrorMessage('Delivery orders require verified GPS coordinates. Please close this window and tap "Use My Current Location".');
        return;
      }
    }

    setIsProcessing(true);
    setProcessingStep('Connecting to secure payment gateway...');

    try {
      // 1. Create order on backend (/api/create-order)
      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: grandTotal,
          receipt: `rcpt_${Date.now().toString().slice(-8)}`,
          notes: {
            customer_name: customerDetails.name || 'Customer',
            customer_phone: customerDetails.phone || '',
          },
        }),
      });

      const orderData = await orderRes.json().catch(() => ({}));

      // If configuration is absent/invalid (HTTP 503) or order creation fails:
      if (!orderRes.ok || !orderData.order_id) {
        setIsProcessing(false);
        setErrorMessage(
          orderData.error ||
          orderData.message ||
          'Online payment is temporarily unavailable. Please try again later.'
        );
        return;
      }

      const razorpayOrderId: string = orderData.order_id || orderData.orderId;
      const keyId: string = orderData.key_id || orderData.keyId;

      // 2. Ensure Razorpay Checkout SDK is ready
      const sdkReady = await loadRazorpayScript();
      if (!sdkReady || typeof window.Razorpay !== 'function') {
        setIsProcessing(false);
        setErrorMessage('Could not load secure payment gateway. Please check your network connection.');
        return;
      }

      setIsProcessing(false);

      // 3. Configure official Razorpay Options
      const options: any = {
        key: keyId,
        order_id: razorpayOrderId,
        amount: Math.round(grandTotal * 100),
        currency: 'INR',
        name: 'MOZZ Chinese & Pizzateria',
        description: 'Korean Pocket Pizzas & Chinese Specials',
        image: '/favicon.svg',
        prefill: {
          name: customerDetails.name || 'MOZZ Customer',
          contact: customerDetails.phone || '',
          email: 'customer@mozzpizzateria.com',
        },
        notes: {
          address: customerDetails.address || 'Takeaway/Dine-In',
          restaurant: 'MOZZ Chinese & Pizzateria',
        },
        theme: {
          color: '#E11D48', // Rose 600
        },
        handler: async function (response: any) {
          setIsProcessing(true);
          setProcessingStep('Verifying payment signature with bank...');

          try {
            // 4. Verify signature on backend server-side
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json().catch(() => ({}));

            if (!verifyRes.ok || !verifyData.success) {
              setIsProcessing(false);
              setErrorMessage(
                verifyData.error ||
                'Payment verification failed. If money was debited, please contact support with reference: ' +
                  response.razorpay_payment_id
              );
              return;
            }

            // 5. Backend signature verified! Register confirmed order in PostgreSQL
            setProcessingStep('Payment Verified! Confirming order with MOZZ Kitchen...');
            const createdOrder = await createOrder('razorpay', response.razorpay_payment_id, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });

            setIsProcessing(false);
            setPaymentSuccess(true);

            try {
              confetti({
                particleCount: 120,
                spread: 80,
                origin: { y: 0.6 },
                colors: ['#F59E0B', '#EF4444', '#10B981', '#ffffff'],
              });
            } catch {}

            setTimeout(() => {
              onOrderCompleted(createdOrder);
              setPaymentSuccess(false);
              onClose();
            }, 2000);
          } catch (err: any) {
            console.error('Payment post-verification error:', err);
            setIsProcessing(false);
            setErrorMessage(err.message || 'Error completing verified order. Please contact support.');
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
            setErrorMessage('Payment was cancelled. You can try again when you are ready.');
          },
        },
      };

      // Optional method filter hint
      if (preferredFilter?.method) {
        options.config = {
          display: {
            blocks: {
              preferred: {
                name: 'Pay with ' + preferredFilter.method.toUpperCase(),
                instruments: [{ method: preferredFilter.method }],
              },
            },
            sequence: ['block.preferred'],
            preferences: {
              show_default_blocks: true,
            },
          },
        };
      }

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        console.error('Razorpay payment failed:', response);
        setErrorMessage(
          response.error?.description ||
          response.error?.reason ||
          'Payment could not be completed. Please try again.'
        );
        setIsProcessing(false);
      });
      rzp.open();
    } catch (err: any) {
      console.error('Razorpay checkout error:', err);
      setIsProcessing(false);
      setErrorMessage(
        err?.message || 'Online payment is temporarily unavailable. Please try again later.'
      );
    }
  };

  // Cash on Delivery Order Creation (Real COD order with cod_pending status)
  const handleConfirmCodOrder = async () => {
    try {
      setErrorMessage('');

      if (orderType === 'delivery') {
        if (typeof customerDetails.latitude !== 'number' || typeof customerDetails.longitude !== 'number') {
          setErrorMessage('Delivery orders require verified GPS coordinates. Please close this window and tap "Use My Current Location".');
          return;
        }
      }

      setIsProcessing(true);
      setProcessingStep('Confirming COD order with MOZZ Kitchen...');

      const createdOrder = await createOrder('cod');

      setIsProcessing(false);
      setPaymentSuccess(true);

      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#F59E0B', '#EF4444', '#10B981', '#ffffff'],
        });
      } catch {}

      setTimeout(() => {
        onOrderCompleted(createdOrder);
        setPaymentSuccess(false);
        onClose();
      }, 1800);
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err.message || 'Failed to place COD order. Please try again.');
    }
  };

  return (
    <div id="razorpay-checkout-modal-container" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div id="razorpay-checkout-modal-card" className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col text-slate-800 shadow-2xl overflow-hidden relative">
        {/* Processing / Success Full Overlay */}
        {isProcessing && (
          <div id="payment-processing-overlay" className="absolute inset-0 z-50 bg-white/95 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-rose-200 border-t-rose-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-rose-600">
                ₹
              </div>
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-base font-bold text-slate-900">Processing Payment</h3>
              <p className="text-xs text-rose-600 font-semibold animate-pulse">{processingStep}</p>
              <p className="text-[11px] text-slate-400">Do not refresh or close this window.</p>
            </div>
          </div>
        )}

        {paymentSuccess && (
          <div id="payment-success-overlay" className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center space-y-4 animate-in zoom-in-95">
            <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-500 text-emerald-600 flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                Order Received
              </span>
              <h3 className="text-2xl font-black text-slate-900">Order Confirmed!</h3>
              <p className="text-xs text-slate-500">
                Sent to MOZZ Kitchen for Korean-Style baking & wok-toss.
              </p>
            </div>
          </div>
        )}

        {/* Modal Header */}
        <div className="bg-slate-900 p-5 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-lg italic shadow-xs">
              R
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white">Razorpay Secure Checkout</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  VERIFIED
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Merchant: <strong className="text-white">MOZZ Chinese & Pizzateria</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Amount Payable</div>
              <div className="text-xl font-black text-amber-400">₹{grandTotal.toFixed(2)}</div>
            </div>
            <button
              id="btn-close-razorpay-modal"
              onClick={onClose}
              disabled={isProcessing}
              className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Customer Notification Bar */}
        <div className="bg-emerald-50/90 px-5 py-2 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-1 text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Customer: <strong className="font-bold">{customerDetails.name || 'Customer'}</strong> • Mobile:{' '}
              <strong className="font-bold font-mono">+91 {customerDetails.phone || '8179620607'}</strong>
            </span>
          </div>
          {orderType === 'delivery' && customerDetails.latitude && customerDetails.longitude ? (
            <span className="text-[11px] text-emerald-800 font-mono bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300">
              📍 GPS: {customerDetails.latitude.toFixed(4)}°, {customerDetails.longitude.toFixed(4)}° (±{Math.round(customerDetails.accuracy || 15)}m)
            </span>
          ) : (
            <span className="text-[11px] text-emerald-700 hidden sm:inline font-medium">Receipt & live status updates</span>
          )}
        </div>

        {/* Error Notification Banner */}
        {errorMessage && (
          <div id="payment-error-banner" className="p-3 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between px-5">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage('')} className="text-rose-500 hover:text-rose-700 font-bold text-xs ml-3 shrink-0">
              Dismiss
            </button>
          </div>
        )}

        {/* Unavailable Banner if 503 */}
        {razorpayAvailable === false && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center gap-2 px-5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Online payment is temporarily unavailable. Please try again later or choose <strong>Cash on Delivery (COD)</strong> below.
            </span>
          </div>
        )}

        {/* Modal Body: Left Tab Menu + Right Payment View */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          {/* Left Payment Options Sidebar */}
          <div className="md:col-span-4 bg-slate-50 border-r border-slate-200 p-3 space-y-1 text-xs">
            <button
              id="tab-razorpay-standard"
              onClick={() => setActiveTab('standard')}
              className={`w-full p-3 rounded-xl flex items-center gap-2.5 transition text-left ${
                activeTab === 'standard'
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <div>
                <div className="flex items-center gap-1">
                  <span>Razorpay Standard</span>
                  <span className="text-[9px] bg-amber-400 text-slate-950 px-1 rounded font-black">FAST</span>
                </div>
                <div className={`text-[10px] ${activeTab === 'standard' ? 'text-blue-100' : 'text-slate-400'}`}>
                  UPI, Cards, NetBanking
                </div>
              </div>
            </button>

            <button
              id="tab-razorpay-upi"
              onClick={() => setActiveTab('upi')}
              className={`w-full p-3 rounded-xl flex items-center gap-2.5 transition text-left ${
                activeTab === 'upi'
                  ? 'bg-rose-600 text-white font-bold shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <div>
                <div>UPI & QR</div>
                <div className={`text-[10px] ${activeTab === 'upi' ? 'text-rose-100' : 'text-slate-400'}`}>
                  GPay, PhonePe, Paytm
                </div>
              </div>
            </button>

            <button
              id="tab-razorpay-card"
              onClick={() => setActiveTab('card')}
              className={`w-full p-3 rounded-xl flex items-center gap-2.5 transition text-left ${
                activeTab === 'card'
                  ? 'bg-rose-600 text-white font-bold shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <div>
                <div>Cards</div>
                <div className={`text-[10px] ${activeTab === 'card' ? 'text-rose-100' : 'text-slate-400'}`}>
                  Visa, Mastercard, RuPay
                </div>
              </div>
            </button>

            <button
              id="tab-razorpay-netbanking"
              onClick={() => setActiveTab('netbanking')}
              className={`w-full p-3 rounded-xl flex items-center gap-2.5 transition text-left ${
                activeTab === 'netbanking'
                  ? 'bg-rose-600 text-white font-bold shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <div>
                <div>Net Banking</div>
                <div className={`text-[10px] ${activeTab === 'netbanking' ? 'text-rose-100' : 'text-slate-400'}`}>
                  All Major Indian Banks
                </div>
              </div>
            </button>

            <button
              id="tab-razorpay-cod"
              onClick={() => setActiveTab('cod')}
              className={`w-full p-3 rounded-xl flex items-center gap-2.5 transition text-left ${
                activeTab === 'cod'
                  ? 'bg-rose-600 text-white font-bold shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Banknote className="w-4 h-4" />
              <div>
                <div>Cash on Delivery</div>
                <div className={`text-[10px] ${activeTab === 'cod' ? 'text-rose-100' : 'text-slate-400'}`}>
                  Pay cash upon delivery
                </div>
              </div>
            </button>
          </div>

          {/* Right Tab Content View */}
          <div className="md:col-span-8 p-5 sm:p-6 overflow-y-auto max-h-[60vh] md:max-h-full bg-white">
            {/* 0. Razorpay Standard Tab */}
            {activeTab === 'standard' && (
              <div className="space-y-5 text-center py-2">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto text-2xl shadow-xs">
                  ⚡
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">Razorpay One-Click Checkout</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Pay securely using Google Pay, PhonePe, Paytm, UPI, Debit/Credit Cards or NetBanking.
                  </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Merchant:</span>
                    <span className="font-bold text-slate-900">MOZZ Chinese & Pizzateria</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Payment Protection:</span>
                    <span className="font-semibold text-emerald-600 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> 256-bit Bank Verified
                    </span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-slate-200">
                    <span className="text-slate-700 font-bold">Total Bill:</span>
                    <span className="font-black text-rose-600 text-sm">₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  id="btn-pay-razorpay-standard"
                  onClick={() => launchRazorpayCheckout()}
                  disabled={isProcessing}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-rose-600 to-amber-600 hover:opacity-95 text-white font-bold text-sm shadow-md shadow-blue-950/20 flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>Pay ₹{grandTotal.toFixed(2)} with Razorpay</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </button>
              </div>
            )}

            {/* 1. UPI & QR Tab */}
            {activeTab === 'upi' && (
              <div className="space-y-5 text-center py-2">
                <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-2xl shadow-xs">
                  <QrCode className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">UPI & QR Code Payment</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Pay instantly via Google Pay, PhonePe, Paytm, BHIM, or any UPI App through Razorpay.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                    Google Pay
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                    PhonePe
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                    Paytm UPI
                  </div>
                </div>

                <button
                  id="btn-pay-razorpay-upi"
                  onClick={() => launchRazorpayCheckout({ method: 'upi' })}
                  disabled={isProcessing}
                  className="w-full py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Pay ₹{grandTotal.toFixed(2)} via UPI Gateway</span>
                </button>
              </div>
            )}

            {/* 2. Debit & Credit Cards */}
            {activeTab === 'card' && (
              <div className="space-y-5 text-center py-2">
                <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-2xl shadow-xs">
                  <CreditCard className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">Debit & Credit Cards</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Visa, MasterCard, RuPay, Maestro and Diners Club cards accepted with OTP 3D-Secure verification.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800">Bank-Grade 3D Secure Protection</p>
                  <p className="text-[11px] text-slate-500">Your card credentials are encrypted directly with the RBI-authorized gateway.</p>
                </div>

                <button
                  id="btn-pay-razorpay-card"
                  onClick={() => launchRazorpayCheckout({ method: 'card' })}
                  disabled={isProcessing}
                  className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Pay ₹{grandTotal.toFixed(2)} via Secure Card</span>
                </button>
              </div>
            )}

            {/* 3. NetBanking */}
            {activeTab === 'netbanking' && (
              <div className="space-y-5 text-center py-2">
                <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-2xl shadow-xs">
                  <Building2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">Net Banking</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Over 50+ Indian banks supported including HDFC, ICICI, SBI, Axis, and Kotak.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto text-xs font-semibold text-slate-700">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">HDFC</div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">ICICI</div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">SBI</div>
                </div>

                <button
                  id="btn-pay-razorpay-netbanking"
                  onClick={() => launchRazorpayCheckout({ method: 'netbanking' })}
                  disabled={isProcessing}
                  className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Proceed to NetBanking Portal</span>
                </button>
              </div>
            )}

            {/* 4. Cash on Delivery (COD) */}
            {activeTab === 'cod' && (
              <div className="text-center space-y-4 py-3">
                <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-2xl shadow-2xs">
                  💵
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">Cash on Delivery (COD)</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Keep exact cash of ₹{grandTotal.toFixed(2)} ready at delivery. UPI on delivery is also accepted by the delivery rider.
                  </p>
                </div>

                <button
                  id="btn-confirm-cod-order"
                  onClick={handleConfirmCodOrder}
                  disabled={isProcessing}
                  className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition disabled:opacity-50"
                >
                  Confirm Order with Cash on Delivery
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Security Badge */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 px-5">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            PCI-DSS Level 1 Certified 256-bit Encryption
          </span>
          <span className="text-slate-700 font-semibold">MOZZ Kitchens Pvt Ltd</span>
        </div>
      </div>
    </div>
  );
};
