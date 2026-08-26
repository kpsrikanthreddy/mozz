import React from 'react';
import { Sparkles, Flame, ShieldCheck, ArrowRight, Award, Layers } from 'lucide-react';
import { FoodCategory } from '../types';

interface BannerPromiseProps {
  onSelectCategory: (cat: FoodCategory) => void;
  onOpenShapeGuide: () => void;
}

export const BannerPromise: React.FC<BannerPromiseProps> = ({
  onSelectCategory,
  onOpenShapeGuide,
}) => {
  return (
    <div className="relative overflow-hidden bg-slate-50/60 border-b border-slate-200 py-8 px-4 sm:px-6 lg:px-8">
      {/* Background subtle glowing gradient orbs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Main Hero Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Hero Card - Korean Pocket Pizzas */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none text-9xl font-black text-white select-none">
              MOZZ
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-300 text-xs font-bold uppercase tracking-wider mb-4">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Introducing Korean-Style Pocket Pizzas
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight mb-3">
              Freshly Baked.{' '}
              <span className="bg-gradient-to-r from-rose-400 via-amber-300 to-amber-200 bg-clip-text text-transparent">
                Loaded with Love.
              </span>
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6 max-w-xl">
              Experience authentic Korean-Style Pocket Pizzas baked inside crispy hand-folded dough with molten cheese and savory fillings.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <button
                onClick={() => onSelectCategory('pocket_pizza_veg')}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-sm shadow-md shadow-rose-950/20 flex items-center gap-2 transition"
              >
                Order Pocket Pizzas
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onSelectCategory('chinese_starters')}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-sm shadow-md shadow-rose-950/20 flex items-center gap-2 transition"
              >
                Order MOZZ Chinese Special
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Shape selection badge banner */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Available in 3 Shapes
                </span>
                <button
                  onClick={onOpenShapeGuide}
                  className="text-xs text-slate-300 hover:text-amber-300 underline transition"
                >
                  View Shape Guide
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div
                  onClick={() => onSelectCategory('pocket_pizza_veg')}
                  className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 cursor-pointer transition"
                >
                  <div className="text-amber-400 font-extrabold text-xs">[R] Rectangular</div>
                  <div className="text-[10px] text-slate-400">Regular • Bigger Bites</div>
                </div>

                <div
                  onClick={() => onSelectCategory('pocket_pizza_nonveg')}
                  className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 hover:border-rose-400 cursor-pointer transition"
                >
                  <div className="text-rose-200 font-extrabold text-xs">[C] Circular</div>
                  <div className="text-[10px] text-slate-200">Classic • Most Popular</div>
                </div>

                <div
                  onClick={() => onSelectCategory('dessert_pizza')}
                  className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 cursor-pointer transition"
                >
                  <div className="text-amber-400 font-extrabold text-xs">[S] Square</div>
                  <div className="text-[10px] text-slate-400">Signature • Perfect Share</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Showcase Card - MOZZ Chinese & Promises */}
          <div className="lg:col-span-5 space-y-4">
            {/* Chinese Wok Spotlight */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🐉</span>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">MOZZ CHINESE</h3>
                    <p className="text-[11px] text-rose-600 font-medium">Different Flavors. Same Love.</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold">
                  WOK FIRED
                </span>
              </div>

              <p className="text-xs text-slate-600 mb-4">
                Sizzling Manchurian, Chilli Paneer, Garlic Chicken 65, Schezwan Fried Rice, Hakka Noodles & Steamed Momos starting at just ₹69!
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => onSelectCategory('chinese_starters')}
                  className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 text-center transition"
                >
                  Starters (₹99+)
                </button>
                <button
                  onClick={() => onSelectCategory('fried_rice')}
                  className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 text-center transition"
                >
                  Fried Rice (₹89+)
                </button>
                <button
                  onClick={() => onSelectCategory('momos')}
                  className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 text-center transition"
                >
                  Momo's (₹77+)
                </button>
              </div>
            </div>

            {/* 5 Promises Ribbon */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-slate-800">
                  Our Culinary Promise
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  <span><strong className="text-slate-800">Fresh Dough:</strong> Prepared daily in-house</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  <span><strong className="text-slate-800">100% In-House:</strong> Proprietary cheese blend for max stretch</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  <span><strong className="text-slate-800">Freshly Baked:</strong> Stone-deck oven fire to order</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
