import React, { useState, useEffect, Suspense } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { Navbar } from './components/Navbar';
import { BannerPromise } from './components/BannerPromise';
import { MenuSection } from './components/MenuSection';
import { PizzaCustomizerModal } from './components/PizzaCustomizerModal';
import { CartDrawer } from './components/CartDrawer';
import { LiveOrderTracker } from './components/LiveOrderTracker';
import { CustomerDetailsModal } from './components/CustomerDetailsModal';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { MenuPage } from './pages/MenuPage';
import { CategoryPage } from './pages/CategoryPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { DeliveryPage } from './pages/DeliveryPage';
import { PolicyPage } from './pages/PolicyPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { getRouteConfig, PUBLIC_ROUTES } from './routes';
import { updateDocumentMetadata } from './utils/updateDocumentMetadata';
import { FoodCategory, Order } from './types';
import { ShoppingBag, ArrowRight, Loader2 } from 'lucide-react';

// Code-split heavy interactive and admin components (Item 12)
const AdminApp = React.lazy(() =>
  import('./components/admin/AdminApp').then((m) => ({ default: m.AdminApp }))
);
const PlatformAdminApp = React.lazy(() =>
  import('./components/admin/PlatformAdminApp').then((m) => ({ default: m.PlatformAdminApp }))
);
const RazorpayCheckoutModal = React.lazy(() =>
  import('./components/RazorpayCheckoutModal').then((m) => ({ default: m.RazorpayCheckoutModal }))
);
const ShapeGuideModal = React.lazy(() =>
  import('./components/ShapeGuideModal').then((m) => ({ default: m.ShapeGuideModal }))
);

interface CustomerAppProps {
  currentPath: string;
  onNavigatePath: (path: string) => void;
}

/**
 * Customer Website Application
 * Supports both SEO-optimized static pre-rendered routes and interactive ordering
 */
const CustomerApp: React.FC<CustomerAppProps> = ({ currentPath, onNavigatePath }) => {
  const {
    itemCount,
    grandTotal,
    setIsCartOpen,
    isCustomerModalOpen,
    setIsCustomerModalOpen,
  } = useStore();

  // Fix Tracker Hydration (Item 11): Keep server and client HTML matched during initial mount ('page'),
  // then transition view in an effect after hydration completes.
  const [currentView, setCurrentView] = useState<'page' | 'track'>('page');

  const [isShapeGuideOpen, setIsShapeGuideOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Sync view state if URL query has ?view=track after mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'track' || window.location.pathname === '/track') {
        setCurrentView('track');
      }

      const handlePop = () => {
        const p = new URLSearchParams(window.location.search);
        if (p.get('view') === 'track' || window.location.pathname === '/track') {
          setCurrentView('track');
        } else {
          setCurrentView('page');
        }
      };
      window.addEventListener('popstate', handlePop);
      return () => window.removeEventListener('popstate', handlePop);
    }
  }, []);

  const handleOrderCompleted = (createdOrder: Order) => {
    setIsCheckoutOpen(false);
    setCurrentView('track');
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/?view=track');
    }
  };

  // Find SEO route config
  const normalizedPath = currentPath.split('?')[0].replace(/\/$/, '') || '/';
  const routeConfig = getRouteConfig(normalizedPath);

  // Implement Client-Side Metadata Updates (Item 7 & Task 5 route-aware head cleanup)
  useEffect(() => {
    updateDocumentMetadata(routeConfig, normalizedPath, {
      isTracking: currentView === 'track' || normalizedPath === '/track' || currentPath.includes('view=track'),
    });
  }, [routeConfig, normalizedPath, currentView, currentPath]);

  // Render the appropriate main content based on route
  const renderMainContent = () => {
    if (currentView === 'track' || normalizedPath === '/track') {
      return (
        <LiveOrderTracker
          onBackToMenu={() => {
            setCurrentView('page');
            onNavigatePath('/menu');
          }}
        />
      );
    }

    if (!routeConfig) {
      // Dynamic QR direct entry paths (e.g. /r/*, /table/*, /counter)
      if (
        normalizedPath.startsWith('/r/') ||
        normalizedPath.startsWith('/table/') ||
        normalizedPath.startsWith('/counter')
      ) {
        return (
          <>
            <BannerPromise
              onSelectCategory={() => {
                const el = document.getElementById('menu-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              onOpenShapeGuide={() => setIsShapeGuideOpen(true)}
            />
            <MenuSection
              selectedCategory="all"
              onSelectCategory={() => {}}
              onOpenShapeGuide={() => setIsShapeGuideOpen(true)}
            />
          </>
        );
      }
      return <NotFoundPage />;
    }

    switch (routeConfig.path) {
      case '/':
        return (
          <HomePage
            routeConfig={routeConfig}
            onOpenShapeGuide={() => setIsShapeGuideOpen(true)}
          />
        );

      case '/menu':
        return <MenuPage routeConfig={routeConfig} currentPath={currentPath} />;

      case '/chinese-restaurant-gachibowli':
      case '/chinese-starters-gachibowli':
      case '/veg-starters-gachibowli':
      case '/non-veg-starters-gachibowli':
      case '/pizza-gachibowli':
      case '/korean-pocket-pizza-hyderabad':
      case '/momos-gachibowli':
        return <CategoryPage routeConfig={routeConfig} />;

      case '/about':
        return <AboutPage routeConfig={routeConfig} />;

      case '/contact':
        return <ContactPage routeConfig={routeConfig} />;

      case '/delivery-information':
        return <DeliveryPage routeConfig={routeConfig} />;

      case '/privacy-policy':
      case '/terms-and-conditions':
      case '/refund-and-cancellation-policy':
        return <PolicyPage routeConfig={routeConfig} />;

      default:
        return <NotFoundPage />;
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Top Customer Navigation */}
      <Navbar
        currentView={currentView === 'track' ? 'track' : 'menu'}
        onNavigate={(view) => {
          if (view === 'track') {
            setCurrentView('track');
            onNavigatePath('/?view=track');
          } else {
            setCurrentView('page');
            onNavigatePath('/menu');
          }
        }}
        onOpenShapeGuide={() => setIsShapeGuideOpen(true)}
      />

      {/* Main Page Body */}
      <main className="flex-1">{renderMainContent()}</main>

      {/* Customer Footer with verified business info and crawlable internal links */}
      <Footer
        onNavigate={(view) => {
          if (view === 'track') {
            setCurrentView('track');
            onNavigatePath('/?view=track');
          } else {
            setCurrentView('page');
            onNavigatePath('/menu');
          }
        }}
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

      {isCheckoutOpen && (
        <Suspense fallback={null}>
          <RazorpayCheckoutModal
            isOpen={isCheckoutOpen}
            onClose={() => setIsCheckoutOpen(false)}
            onOrderCompleted={handleOrderCompleted}
          />
        </Suspense>
      )}

      {isShapeGuideOpen && (
        <Suspense fallback={null}>
          <ShapeGuideModal
            isOpen={isShapeGuideOpen}
            onClose={() => setIsShapeGuideOpen(false)}
          />
        </Suspense>
      )}

      {/* Floating Mobile Cart Bar */}
      {itemCount > 0 && currentView !== 'track' && (
        <div className="sm:hidden fixed bottom-4 inset-x-4 z-40 animate-in slide-in-from-bottom duration-200">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 text-white font-black text-sm shadow-xl shadow-rose-900/20 flex items-center justify-between border border-rose-400/30 active:scale-[0.98] transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white text-rose-600 text-xs flex items-center justify-center font-black shadow-xs">
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

export default function App({ initialPath }: { initialPath?: string }) {
  const [currentPath, setCurrentPath] = useState(() => {
    if (initialPath) return initialPath;
    if (typeof window !== 'undefined') {
      return window.location.pathname + window.location.search;
    }
    return '/';
  });

  const [currentHost, setCurrentHost] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.hostname;
    }
    return '';
  });

  // Client-side routing with popstate and delegated link interceptor
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname + window.location.search);
      setCurrentHost(window.location.hostname);
    };

    window.addEventListener('popstate', handleLocationChange);

    // Delegated click listener for internal `<a href="/...">` links
    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      if (!href) return;

      // Only handle internal relative links (starting with single '/')
      if (
        href.startsWith('/') &&
        !href.startsWith('//') &&
        !href.startsWith('/api') &&
        !target.getAttribute('download') &&
        target.getAttribute('target') !== '_blank'
      ) {
        // Allow standard modifier keys (Ctrl, Cmd, Shift, Alt) for opening in new tab
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
          return;
        }

        e.preventDefault();
        window.history.pushState({}, '', href);
        setCurrentPath(href);
        window.scrollTo(0, 0);
      }
    };

    document.addEventListener('click', handleDocumentClick);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

  const navigateTo = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
      window.scrollTo(0, 0);
    }
  };

  // Determine application mode based on path and subdomain
  const isPlatformAdmin = currentPath.startsWith('/platform-admin');
  const isAdminPortal =
    currentPath.startsWith('/admin') ||
    currentHost.startsWith('admin.') ||
    currentPath.startsWith('/restaurant-admin');

  // Ensure administrative and platform admin portals immediately set private noindex directives
  useEffect(() => {
    if (isPlatformAdmin || isAdminPortal) {
      updateDocumentMetadata(undefined, currentPath, { isAdmin: true });
    }
  }, [isPlatformAdmin, isAdminPortal, currentPath]);

  return (
    <StoreProvider>
      <AdminAuthProvider>
        {isPlatformAdmin ? (
          <Suspense
            fallback={
              <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
              </div>
            }
          >
            <PlatformAdminApp />
          </Suspense>
        ) : isAdminPortal ? (
          <Suspense
            fallback={
              <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
              </div>
            }
          >
            <AdminApp />
          </Suspense>
        ) : (
          <CustomerApp currentPath={currentPath} onNavigatePath={navigateTo} />
        )}
      </AdminAuthProvider>
    </StoreProvider>
  );
}
