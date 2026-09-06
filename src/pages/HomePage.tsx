import React from 'react';
import { SeoRouteConfig } from '../types/seoTypes';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { SeoFaqSection } from '../components/SeoFaqSection';
import { SeoFoodGrid } from '../components/SeoFoodGrid';
import { INITIAL_MENU } from '../data/menuData';
import {
  UtensilsCrossed,
  Layers,
  Flame,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  ShieldCheck,
  Clock,
  MapPin,
} from 'lucide-react';

interface HomePageProps {
  routeConfig: SeoRouteConfig;
  onOpenShapeGuide?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ routeConfig, onOpenShapeGuide }) => {
  // Select featured items from the static menu dataset
  const featuredPocketPizzas = INITIAL_MENU.filter(
    (item) => item.category === 'pocket_pizza_veg' || item.category === 'pocket_pizza_nonveg'
  ).slice(0, 4);

  const featuredChineseStarters = INITIAL_MENU.filter(
    (item) => item.category === 'chinese_starters'
  ).slice(0, 4);

  const featuredMomos = INITIAL_MENU.filter((item) => item.category === 'momos').slice(0, 4);

  return (
    <div className="min-h-screen bg-stone-50">
      <Breadcrumbs items={routeConfig.breadcrumbs} />

      {/* Hero Banner Section */}
      <section className="bg-[#0B1120] text-white py-12 sm:py-16 px-4 sm:px-6 relative overflow-hidden border-b border-slate-800">
        {/* Glowing atmospheric gradient background blurs */}
        <div className="absolute -top-28 -left-28 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-28 -right-28 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Subtle MOZZ watermark text in the background */}
        <div className="absolute top-2 right-4 sm:right-10 opacity-[0.04] pointer-events-none text-8xl sm:text-9xl md:text-[11rem] font-black text-white select-none tracking-tight">
          MOZZ
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          {/* Header pill badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Introducing Korean-Style Pocket Pizzas</span>
          </div>

          {/* Subtle branding & ordering context */}
          <div className="text-xs sm:text-sm font-medium text-slate-400 tracking-wide mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            <span>Order Online from MOZZ Chinese & Pizzateria on Starters4U</span>
          </div>

          {/* Prominent Hero Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black font-display tracking-tight text-white leading-tight mb-4 max-w-4xl">
            Freshly Baked.{' '}
            <span className="bg-gradient-to-r from-[#FF4B72] via-[#FF8533] to-[#FACC15] bg-clip-text text-transparent">
              Loaded with Love.
            </span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-7 max-w-2xl">
            Enjoy Korean-Style Pocket Pizzas baked inside hand-folded dough with cheese and savory fillings, alongside wok-tossed Chinese starters, fried rice & Himalayan momos.
          </p>

          {/* Vibrant Action Buttons */}
          <div className="flex flex-wrap items-center gap-3.5 mb-8">
            <a
              href="/pizza-gachibowli"
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#E1144B] to-[#EA580C] hover:from-[#D01042] hover:to-[#D94E08] text-white font-bold text-sm shadow-lg shadow-rose-950/40 flex items-center gap-2 transition duration-200"
            >
              <span>Order Pocket Pizzas</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <a
              href="/chinese-starters-gachibowli"
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#E1144B] to-[#EA580C] hover:from-[#D01042] hover:to-[#D94E08] text-white font-bold text-sm shadow-lg shadow-rose-950/40 flex items-center gap-2 transition duration-200"
            >
              <span>Order MOZZ Chinese Special</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <a
              href="/menu"
              className="px-5 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-semibold text-sm transition border border-slate-700/80 flex items-center gap-2"
            >
              <ShoppingBag className="w-4 h-4 text-amber-400" />
              <span>Explore Full Menu</span>
            </a>
          </div>

          {/* Quick trust metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-800/80 text-xs sm:text-sm text-slate-400">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Strict Veg & Non-Veg Kitchen Segregation</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Fresh Cooked to Order in Gachibowli</span>
            </div>
            <div className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Serving Gachibowli, Hyderabad</span>
            </div>
          </div>
        </div>
      </section>

      {/* Crawlable Category Hub */}
      <section className="py-10 bg-white border-b border-stone-200" aria-label="Explore Categories">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="mb-6">
            <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">Quick Navigation</span>
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900 font-display mt-0.5">
              Popular Ordering Categories in Gachibowli
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                title: 'Chinese Starters',
                path: '/chinese-starters-gachibowli',
                desc: 'Manchurian & 65',
              },
              {
                title: 'Veg Starters',
                path: '/veg-starters-gachibowli',
                desc: 'Paneer & Mushroom',
              },
              {
                title: 'Non-Veg Starters',
                path: '/non-veg-starters-gachibowli',
                desc: 'Chicken Specialties',
              },
              {
                title: 'Pocket Pizzas',
                path: '/pizza-gachibowli',
                desc: 'R, C, S Shapes',
              },
              {
                title: 'Korean Pizzas',
                path: '/korean-pocket-pizza-hyderabad',
                desc: 'Handheld Crusts',
              },
              {
                title: 'Himalayan Momos',
                path: '/momos-gachibowli',
                desc: 'Steamed & Fried',
              },
            ].map((cat) => (
              <a
                key={cat.path}
                href={cat.path}
                className="p-3.5 rounded-xl border border-stone-200 hover:border-primary-400 hover:bg-primary-50/40 transition group bg-white shadow-2xs"
              >
                <div className="font-semibold text-stone-900 text-sm group-hover:text-primary-700 transition-colors">
                  {cat.title}
                </div>
                <div className="text-stone-500 text-xs mt-0.5">{cat.desc}</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Pocket Pizza Feature Section */}
      <section className="py-12 bg-stone-50" aria-label="Korean Pocket Pizza Specialties">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-stone-200 shadow-xs mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-8">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md mb-2">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Unique Korean Format</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 font-display">
                  Handheld Korean Pocket Pizzas
                </h2>
                <p className="text-stone-600 text-sm sm:text-base mt-2 leading-relaxed max-w-2xl">
                  Unlike conventional open-faced flat pizzas, MOZZ pocket pizzas feature hand-crimped crust edges that seal molten cheese, secret herbs, and fillings inside. Available in three shape sizes: [R] Rectangular for solo snacking, [C] Circular for sharing, and [S] Square for gatherings.
                </p>
              </div>
              <div className="lg:col-span-4 flex flex-col gap-2.5 sm:flex-row lg:flex-col justify-end">
                <a
                  href="/korean-pocket-pizza-hyderabad"
                  className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-semibold text-center transition"
                >
                  Read Shape & Crust Guide
                </a>
                <a
                  href="/pizza-gachibowli"
                  className="px-5 py-2.5 rounded-xl border border-stone-300 hover:border-stone-400 text-stone-800 text-xs sm:text-sm font-semibold text-center transition"
                >
                  View All Pocket Pizzas
                </a>
              </div>
            </div>
          </div>

          <SeoFoodGrid
            items={featuredPocketPizzas}
            title="Featured Pocket Pizzas"
            description="Freshly prepared pocket pizzas ready for online ordering in Gachibowli."
          />
        </div>
      </section>

      {/* Chinese Starters Showcase */}
      <section className="py-8 bg-white border-t border-stone-200">
        <SeoFoodGrid
          items={featuredChineseStarters}
          title="Indo-Chinese Starters"
          description="Wok-tossed starters seasoned with fresh ginger, garlic, and signature spices."
        />
        <div className="text-center pb-8">
          <a
            href="/chinese-starters-gachibowli"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800 hover:underline"
          >
            <span>View all veg and non-veg Chinese starters in Gachibowli</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Momos Showcase */}
      <section className="py-8 bg-stone-50 border-t border-stone-200">
        <SeoFoodGrid
          items={featuredMomos}
          title="Steamed & Fried Momos"
          description="Himalayan-style dumplings served with fiery garlic-chili momo chutney and dipping sauce."
        />
        <div className="text-center pb-8">
          <a
            href="/momos-gachibowli"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800 hover:underline"
          >
            <span>View all steamed, fried, and peri peri momos</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* FAQs */}
      <SeoFaqSection faqs={routeConfig.faqs} />
    </div>
  );
};
