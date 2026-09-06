import React from 'react';
import { SeoRouteConfig } from '../types/seoTypes';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { SeoFaqSection } from '../components/SeoFaqSection';
import { BUSINESS_INFO } from '../config/businessInfo';
import {
  PackageCheck,
  ShoppingBag,
  Clock,
  ShieldCheck,
  Truck,
  ArrowRight,
} from 'lucide-react';

interface DeliveryPageProps {
  routeConfig: SeoRouteConfig;
}

export const DeliveryPage: React.FC<DeliveryPageProps> = ({ routeConfig }) => {
  return (
    <div className="min-h-screen bg-stone-50">
      <Breadcrumbs items={routeConfig.breadcrumbs} />

      <header className="bg-white border-b border-stone-200 py-10 sm:py-14 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-md mb-3">
            <PackageCheck className="w-3.5 h-3.5" />
            <span>Packaging & Fulfillment</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 font-display">
            {routeConfig.h1}
          </h1>
          <p className="text-stone-600 text-base sm:text-lg mt-3 leading-relaxed">
            Learn how food orders from MOZZ Chinese & Pizzateria are prepared, packed, and fulfilled via Starters4U for customers across {BUSINESS_INFO.locality}, {BUSINESS_INFO.city}.
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Packaging Innovation */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200 shadow-xs">
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-display mb-3">
            Thermal Packaging for Pocket Pizzas & Starters
          </h2>
          <p className="text-stone-600 text-sm sm:text-base leading-relaxed mb-4">
            Delivering food hot without compromising texture requires purpose-designed packaging:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
              <strong className="text-stone-900 block font-semibold text-sm mb-1">
                Ventilated Pocket Pizza Boxes
              </strong>
              <p className="text-stone-600 text-xs sm:text-sm leading-relaxed">
                Our custom pocket pizza cartons incorporate micro-ventilation ports that let trapped baking steam vent out while locking in core oven heat. This prevents the hand-folded crust from turning soggy.
              </p>
            </div>
            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
              <strong className="text-stone-900 block font-semibold text-sm mb-1">
                Spill-Proof Wok Containers
              </strong>
              <p className="text-stone-600 text-xs sm:text-sm leading-relaxed">
                Indo-Chinese gravies, Schezwan fried rice, and Hakka noodles are packaged in high-density food-grade containers with tamper-evident seal rings to prevent transit leaks.
              </p>
            </div>
          </div>
        </section>

        {/* Fulfillment Options */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200 shadow-xs">
          <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-display mb-4">
            Delivery vs. Self-Takeaway Pickup
          </h2>
          <div className="space-y-4 text-stone-600 text-sm sm:text-base leading-relaxed">
            <div className="flex items-start gap-3">
              <Truck className="w-5 h-5 text-primary-600 mt-0.5 shrink-0" />
              <div>
                <strong className="text-stone-900 block font-semibold">Home & Office Delivery</strong>
                Place your order online through Starters4U. Enter your delivery address and landmark in Gachibowli, pay securely via Razorpay or choose pay-on-delivery, and monitor your order on our Live Tracker.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShoppingBag className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <strong className="text-stone-900 block font-semibold">Self-Takeaway Pickup</strong>
                Prefer to collect on your commute? Toggle "Takeaway" in the top bar. Your order will be boxed and waiting at the counter when you arrive.
              </div>
            </div>
          </div>
        </section>

        {/* Real-time Order Tracking */}
        <section className="bg-stone-900 text-white rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-white mb-1">
                Track an Active Order
              </h2>
              <p className="text-stone-300 text-xs sm:text-sm">
                Watch your order progress from Kitchen Confirmed → Baking & Wok Prep → Out for Delivery.
              </p>
            </div>
            <a
              href="/?view=track"
              className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs sm:text-sm font-semibold transition shrink-0"
            >
              Open Tracker
            </a>
          </div>
        </section>
      </main>

      <SeoFaqSection faqs={routeConfig.faqs} />
    </div>
  );
};
