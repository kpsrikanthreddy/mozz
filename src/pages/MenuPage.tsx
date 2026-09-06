import React, { useState, useMemo } from 'react';
import { SeoRouteConfig } from '../types/seoTypes';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { SeoFaqSection } from '../components/SeoFaqSection';
import { FoodCard } from '../components/FoodCard';
import { INITIAL_MENU } from '../data/menuData';
import { FoodCategory, DietaryType } from '../types';
import { Search, SlidersHorizontal, Utensils, Check } from 'lucide-react';

const MENU_CATEGORIES: { id: FoodCategory; label: string }[] = [
  { id: 'pocket_pizza_veg', label: 'Veg Pocket Pizzas' },
  { id: 'pocket_pizza_nonveg', label: 'Non-Veg Pocket Pizzas' },
  { id: 'dessert_pizza', label: 'Dessert Pizzas' },
  { id: 'chinese_starters', label: 'Chinese Starters' },
  { id: 'fried_rice', label: 'Fried Rice' },
  { id: 'noodles', label: 'Noodles' },
  { id: 'maggie', label: 'Maggie' },
  { id: 'momos', label: 'Momos' },
  { id: 'drinks', label: 'Drinks' },
];

interface MenuPageProps {
  routeConfig: SeoRouteConfig;
}

export const MenuPage: React.FC<MenuPageProps> = ({ routeConfig }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dietaryFilter, setDietaryFilter] = useState<DietaryType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredItems = useMemo(() => {
    return INITIAL_MENU.filter((item) => {
      // Category match
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      // Dietary match
      if (dietaryFilter !== 'all' && item.dietary !== dietaryFilter) {
        return false;
      }
      // Search match
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesDesc = item.description?.toLowerCase().includes(query);
        return matchesName || matchesDesc;
      }
      return true;
    });
  }, [selectedCategory, dietaryFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-stone-50">
      <Breadcrumbs items={routeConfig.breadcrumbs} />

      {/* Header Banner */}
      <header className="bg-white border-b border-stone-200 py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-md mb-2">
            <Utensils className="w-3.5 h-3.5" />
            <span>Complete Food Menu</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-stone-900 font-display">
            {routeConfig.h1}
          </h1>
          <p className="text-stone-600 text-sm sm:text-base mt-2 max-w-3xl leading-relaxed">
            Browse our full selection of Korean-style pocket pizzas, Indo-Chinese starters, wok-tossed fried rice, noodles, and Himalayan momos prepared fresh in Gachibowli, Hyderabad. All items are available for direct online ordering and takeaway.
          </p>

          {/* Search & Dietary Bar */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pt-4 border-t border-stone-100">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search dishes, ingredients (e.g., paneer, chicken)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-stone-100 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition"
              />
            </div>

            {/* Dietary Filter Buttons */}
            <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl border border-stone-200 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setDietaryFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  dietaryFilter === 'all'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                All Dishes
              </button>
              <button
                type="button"
                onClick={() => setDietaryFilter('veg')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  dietaryFilter === 'veg'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Veg Only</span>
              </button>
              <button
                type="button"
                onClick={() => setDietaryFilter('non-veg')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  dietaryFilter === 'non-veg'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span>Non-Veg Only</span>
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition ${
                selectedCategory === 'all'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              All Categories ({INITIAL_MENU.length})
            </button>
            {MENU_CATEGORIES.map((cat) => {
              const count = INITIAL_MENU.filter((m) => m.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition ${
                    selectedCategory === cat.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {cat.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Menu Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs text-stone-500 font-medium">
            Showing <strong className="text-stone-900">{filteredItems.length}</strong> items
          </span>
          {(selectedCategory !== 'all' || dietaryFilter !== 'all' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setDietaryFilter('all');
                setSearchQuery('');
              }}
              className="text-xs text-primary-600 hover:text-primary-700 font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>

        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-stone-200">
            <Utensils className="w-8 h-8 text-stone-400 mx-auto mb-3" />
            <p className="text-stone-700 font-medium">No menu items match your criteria.</p>
            <p className="text-stone-500 text-xs mt-1">Try clearing your search query or filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredItems.map((item) => (
              <FoodCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>

      {/* Crawlable Landing Pages Directory */}
      <section className="bg-white border-t border-stone-200 py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-lg font-bold text-stone-900 font-display mb-4">
            Specialized Menu Guides & In-Depth Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { title: 'Chinese Starters in Gachibowli', path: '/chinese-starters-gachibowli' },
              { title: 'Vegetarian Starters (Paneer, Mushroom)', path: '/veg-starters-gachibowli' },
              { title: 'Non-Veg Starters (Chicken Specials)', path: '/non-veg-starters-gachibowli' },
              { title: 'Korean Pocket Pizzas in Gachibowli', path: '/pizza-gachibowli' },
              { title: 'Korean Pocket Pizza R, C, S Guide', path: '/korean-pocket-pizza-hyderabad' },
              { title: 'Steamed & Fried Momos in Gachibowli', path: '/momos-gachibowli' },
            ].map((link) => (
              <a
                key={link.path}
                href={link.path}
                className="p-3 rounded-xl border border-stone-200 hover:border-primary-400 hover:bg-primary-50/30 text-stone-800 hover:text-primary-700 text-xs sm:text-sm font-semibold transition"
              >
                {link.title} →
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <SeoFaqSection faqs={routeConfig.faqs} />
    </div>
  );
};
