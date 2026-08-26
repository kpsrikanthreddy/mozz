import React, { useState } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Navbar } from './components/Navbar';
import { BannerPromise } from './components/BannerPromise';
import { MenuSection } from './components/MenuSection';
import { PizzaCustomizerModal } from './components/PizzaCustomizerModal';
import { CartDrawer } from './components/CartDrawer';
import { RazorpayCheckoutModal } from './components/RazorpayCheckoutModal';
import { LiveOrderTracker } from './components/LiveOrderTracker';
import { AdminPortal } from './components/AdminPortal';
import { ShapeGuideModal } from './components/ShapeGuideModal';
import { CustomerDetailsModal } from './components/CustomerDetailsModal';
import { Footer } from './components/Footer';
import { FoodCategory, Order } from './types';
import { ShoppingBag, ArrowRight, Sparkles } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const {
    itemCount,
    grandTotal,
    setIsCartOpen,
    activeOrder,
    isCustomerModalOpen,
    setIsCustomerModalOpen,
  } = useStore();

  const [currentView, setCurrentView] = useState<'menu' | 'track' | 'admin'>('menu');
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory | 'all'>('all');
  const [isShapeGuideOpen, setIsShapeGuideOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const handleSelectCategoryFromHero = (cat: FoodCategory) => {
    setSelectedCategory(cat);
    setCurrentView('menu');
    // Smooth scroll down to menu section
    setTimeout(() => {
      const el = document.getElementById('menu-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handleOrderCompleted = (createdOrder: Order) => {
    setIsCheckoutOpen(false);
    setCurrentView('track');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-800 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        onOpenShapeGuide={() => setIsShapeGuideOpen(true)}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {currentView === 'menu' && (
          <>
            <BannerPromise
              onSelectCategory={handleSelectCategoryFromHero}
              onOpenShapeGuide={() => setIsShapeGuideOpen(true)}
            />
            <MenuSection
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onOpenShapeGuide={() => setIsShapeGuideOpen(true)}
            />
          </>
        )}

        {currentView === 'track' && (
          <LiveOrderTracker onBackToMenu={() => setCurrentView('menu')} />
        )}

        {currentView === 'admin' && (
          <AdminPortal onBackToMenu={() => setCurrentView('menu')} />
        )}
      </main>

      {/* Footer */}
      <Footer
        onNavigate={(view) => setCurrentView(view)}
        onOpenShapeGuide={() => setIsShapeGuideOpen(true)}
      />

      {/* Modals & Drawers */}
      <CustomerDetailsModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
      />

      <PizzaCustomizerModal />

      <CartDrawer
        onOpenCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      <RazorpayCheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onOrderCompleted={handleOrderCompleted}
      />

      <ShapeGuideModal
        isOpen={isShapeGuideOpen}
        onClose={() => setIsShapeGuideOpen(false)}
      />

      {/* Floating Mobile Cart Bar */}
      {itemCount > 0 && currentView === 'menu' && (
        <div className="sm:hidden fixed bottom-4 inset-x-4 z-40 animate-in slide-in-from-bottom duration-200">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 text-white font-black text-sm shadow-xl shadow-rose-900/20 flex items-center justify-between border border-rose-400/30 active:scale-[0.98] transition"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white text-rose-600 text-xs flex items-center justify-center font-black shadow-sm">
                {itemCount}
              </div>
              <span className="text-white font-bold">View Cart</span>
            </div>
            <div className="flex items-center gap-1.5 font-black text-white">
              <span>₹{grandTotal.toFixed(2)}</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <MainAppContent />
    </StoreProvider>
  );
}
