import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { MenuItem, CartItem, Order, OrderStatus, OrderType, CustomerDetails, PaymentMethod, QRSessionInfo, EntrySource } from '../types';
import { INITIAL_MENU, PROMO_COUPONS } from '../data/menuData';
import { soundService } from '../utils/audio';
import { resolveEntrySourceFromLocation } from '../utils/qrSecurity';

interface StoreContextType {
  menu: MenuItem[];
  cart: CartItem[];
  orders: Order[];
  activeOrderId: string | null;
  activeOrder: Order | null;
  isCartOpen: boolean;
  isCustomizerOpen: boolean;
  selectedCustomizerItem: MenuItem | null;
  appliedCoupon: string | null;
  discountAmount: number;
  orderType: OrderType;
  tableNumber: string;
  qrSession: QRSessionInfo;
  isModeLocked: boolean;
  isAdminAuthenticated: boolean;
  soundEnabled: boolean;
  customerDetails: CustomerDetails;
  isCustomerVerified: boolean;
  isCustomerModalOpen: boolean;
  isLoadingMenu: boolean;
  isLoadingOrders: boolean;
  
  // Actions
  setOrderType: (type: OrderType) => void;
  setTableNumber: (num: string) => void;
  setCustomerDetails: (details: Partial<CustomerDetails>) => void;
  setIsCustomerModalOpen: (open: boolean) => void;
  promptCustomerVerification: (onSuccessAction?: () => void) => boolean;
  setIsCartOpen: (open: boolean) => void;
  openCustomizer: (item: MenuItem) => void;
  closeCustomizer: () => void;
  addToCart: (item: CartItem) => void;
  updateCartQuantity: (cartItemId: string, delta: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;
  
  // QR & Entry Session actions
  switchQRSession: (session: Partial<QRSessionInfo>) => void;
  clearQRSession: () => void;
  
  // Order actions
  createOrder: (paymentMethod: PaymentMethod, paymentId?: string) => Promise<Order>;
  updateOrderStatus: (orderId: string, newStatus: OrderStatus, note?: string) => Promise<void>;
  updateOrderDeliveryLocation: (orderId: string, location: { latitude: number; longitude: number; address?: string }) => Promise<Order | null>;
  setActiveOrderId: (orderId: string | null) => void;
  fetchOrderById: (orderId: string) => Promise<Order | null>;
  cancelOrder: (orderId: string, reason?: string) => Promise<{ success: boolean; error?: string; order?: Order }>;
  deleteOrder: (orderId: string) => Promise<void>;
  deleteKot: (orderId: string) => Promise<void>;
  refreshOrders: () => Promise<void>;
  refreshMenu: () => Promise<void>;
  
  // Admin actions
  loginAdmin: (password: string) => Promise<boolean>;
  logoutAdmin: () => void;
  toggleItemStock: (itemId: string) => Promise<void>;
  updateItemPrice: (itemId: string, newPrice: number | { R: number; C: number; S: number }) => Promise<void>;
  addMenuItem: (item: Omit<MenuItem, 'id'>) => Promise<void>;
  updateMenuItem: (itemId: string, updated: Partial<MenuItem>) => Promise<void>;
  deleteMenuItem: (itemId: string) => Promise<void>;
  resetMenuToDefault: () => Promise<void>;
  toggleSound: () => void;
  
  // Cart calculations
  subtotal: number;
  tax: number;
  deliveryFee: number;
  grandTotal: number;
  itemCount: number;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_CART = 'mozz_cart_v1';
const LOCAL_STORAGE_KEY_ACTIVE_ORDER = 'mozz_active_order_id_v1';
const LOCAL_STORAGE_KEY_ADMIN = 'mozz_admin_auth_v1';
const LOCAL_STORAGE_KEY_CUSTOMER = 'mozz_customer_details_v1';

const INITIAL_CUSTOMER: CustomerDetails = {
  name: '',
  phone: '',
  address: '',
  landmark: '',
  tableNumber: 'Table 1',
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Menu state loaded from PostgreSQL API
  const [menu, setMenu] = useState<MenuItem[]>(INITIAL_MENU);
  const [isLoadingMenu, setIsLoadingMenu] = useState(false);

  // Cart state (hydration-safe: starts empty on initial render, hydrated via useEffect)
  const [cart, setCart] = useState<CartItem[]>([]);

  // Orders state loaded from PostgreSQL API
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // Active tracked order ID
  const [activeOrderId, setActiveOrderId] = useState<string | null>('MOZZ-8901');

  // Entry Source & Signed QR Session State
  const [qrSession, setQrSession] = useState<QRSessionInfo>(() => {
    if (typeof window !== 'undefined') {
      return resolveEntrySourceFromLocation(window.location);
    }
    return {
      source: 'online_web',
      orderMode: 'delivery',
      isVerified: true,
      isModeLocked: false,
      verificationMessage: 'Direct Online Website Access',
    };
  });

  const isModeLocked = qrSession.isModeLocked;

  // UI Modals & Settings
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [selectedCustomizerItem, setSelectedCustomizerItem] = useState<MenuItem | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [pendingCustomerAction, setPendingCustomerAction] = useState<(() => void) | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [orderType, setOrderTypeState] = useState<OrderType>(() => qrSession.orderMode || 'delivery');
  const [tableNumber, setTableNumberState] = useState<string>(() => qrSession.tableNumber || 'Table 1');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Admin Authentication state
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);

  // Customer details
  const [customerDetails, setCustomerDetailsState] = useState<CustomerDetails>(INITIAL_CUSTOMER);

  // Client-side hydration of persisted localStorage values (guarantees zero hydration mismatch)
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(LOCAL_STORAGE_KEY_CART);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch {}

    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const qOrderId = params.get('orderId') || params.get('order_id');
        if (qOrderId) {
          setActiveOrderId(qOrderId);
          fetchOrderById(qOrderId);
        } else {
          const savedOrder = localStorage.getItem(LOCAL_STORAGE_KEY_ACTIVE_ORDER);
          if (savedOrder) {
            setActiveOrderId(savedOrder);
            fetchOrderById(savedOrder);
          }
        }
      }
    } catch {}

    try {
      const savedCustomer = localStorage.getItem(LOCAL_STORAGE_KEY_CUSTOMER);
      if (savedCustomer) {
        setCustomerDetailsState(JSON.parse(savedCustomer));
      }
    } catch {}

    try {
      const savedAdmin = localStorage.getItem(LOCAL_STORAGE_KEY_ADMIN);
      if (savedAdmin === 'true') setIsAdminAuthenticated(true);
    } catch {}
  }, []);

  // ==========================================================
  // API DATA FETCHING (PostgreSQL as Source of Truth)
  // ==========================================================

  // 1. Fetch Menu from /api/menu
  const refreshMenu = useCallback(async () => {
    try {
      setIsLoadingMenu(true);
      const res = await fetch('/api/menu');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setMenu(data);
        }
      }
    } catch (err) {
      console.warn('[StoreContext] Could not fetch menu from backend, using default initial items:', err);
    } finally {
      setIsLoadingMenu(false);
    }
  }, []);

  // 2. Fetch Orders from /api/orders
  const refreshOrders = useCallback(async () => {
    try {
      setIsLoadingOrders(true);
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setOrders(data);
        }
      }
    } catch (err) {
      console.warn('[StoreContext] Could not fetch orders from backend:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    refreshMenu();
    refreshOrders();
  }, [refreshMenu, refreshOrders]);

  // Auto-validate with backend on load if token present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get('token') || searchParams.get('t');
      if (token) {
        fetch(`/api/qr/validate?token=${encodeURIComponent(token)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.valid) {
              setQrSession({
                source: data.source,
                orderMode: data.orderMode,
                tableNumber: data.tableNumber,
                token,
                isVerified: true,
                isModeLocked: Boolean(data.isModeLocked),
                verificationMessage: data.message,
              });
              setOrderTypeState(data.orderMode);
              if (data.tableNumber) {
                setTableNumberState(data.tableNumber);
              }
            }
          })
          .catch((err) => {
            console.warn('Server QR validation check:', err);
          });
      }
    }
  }, []);

  const setOrderType = (type: OrderType) => {
    if (isModeLocked) {
      console.warn(`Order mode is locked to ${qrSession.orderMode} (${qrSession.source}) by verified QR scan.`);
      return;
    }
    setOrderTypeState(type);
  };

  const setTableNumber = (num: string) => {
    if (isModeLocked && qrSession.tableNumber) {
      console.warn(`Table number is locked to ${qrSession.tableNumber} by verified QR scan.`);
      return;
    }
    setTableNumberState(num);
  };

  const switchQRSession = (newSession: Partial<QRSessionInfo>) => {
    const src = newSession.source || 'table_qr';
    const mode = newSession.orderMode || (src === 'table_qr' ? 'dine_in' : src === 'counter_qr' ? 'takeaway' : 'delivery');
    const cleanTable = newSession.tableNumber ? `Table ${newSession.tableNumber.replace(/^Table\s*/i, '')}` : (src === 'table_qr' ? 'Table 1' : undefined);

    const updated: QRSessionInfo = {
      source: src,
      orderMode: mode,
      tableNumber: cleanTable,
      token: newSession.token,
      isVerified: newSession.isVerified ?? true,
      isModeLocked: newSession.isModeLocked ?? (src !== 'online_web'),
      verificationMessage: newSession.verificationMessage || (src === 'table_qr' ? `Authenticated ${cleanTable} (Dine-In Session)` : src === 'counter_qr' ? 'Authenticated Counter (Takeaway Session)' : 'Online Customer (Home Delivery)'),
      signature: newSession.signature,
    };

    setQrSession(updated);
    setOrderTypeState(updated.orderMode);
    if (updated.tableNumber) {
      setTableNumberState(updated.tableNumber);
    }
    soundService.playChime('pop');
  };

  const clearQRSession = () => {
    const defaultWeb: QRSessionInfo = {
      source: 'online_web',
      orderMode: 'delivery',
      isVerified: true,
      isModeLocked: false,
      verificationMessage: 'Direct Online Customer (Home Delivery)',
    };
    setQrSession(defaultWeb);
    setOrderTypeState('delivery');
    soundService.playChime('pop');
  };

  // Local storage sync for cart and activeOrderId
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_CART, JSON.stringify(cart));
    } catch {}
  }, [cart]);

  useEffect(() => {
    try {
      if (activeOrderId) {
        localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_ORDER, activeOrderId);
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY_ACTIVE_ORDER);
      }
    } catch {}
  }, [activeOrderId]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_ADMIN, isAdminAuthenticated ? 'true' : 'false');
    } catch {}
  }, [isAdminAuthenticated]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_CUSTOMER, JSON.stringify(customerDetails));
    } catch {}
  }, [customerDetails]);

  // Sync sound service
  useEffect(() => {
    soundService.setSoundEnabled(soundEnabled);
  }, [soundEnabled]);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      soundService.setSoundEnabled(next);
      return next;
    });
  };

  const isCustomerVerified = Boolean(
    customerDetails.name &&
    customerDetails.name.trim().length >= 2 &&
    customerDetails.phone &&
    customerDetails.phone.trim().replace(/\D/g, '').length === 10
  );

  const promptCustomerVerification = (onSuccessAction?: () => void): boolean => {
    if (isCustomerVerified) {
      if (onSuccessAction) onSuccessAction();
      return true;
    }
    if (onSuccessAction) {
      setPendingCustomerAction(() => onSuccessAction);
    }
    setIsCustomerModalOpen(true);
    return false;
  };

  const setCustomerDetails = (details: Partial<CustomerDetails>) => {
    setCustomerDetailsState((prev) => {
      const updated = { ...prev, ...details };
      if (
        updated.name &&
        updated.name.trim().length >= 2 &&
        updated.phone &&
        updated.phone.trim().replace(/\D/g, '').length === 10 &&
        pendingCustomerAction
      ) {
        setTimeout(() => {
          if (pendingCustomerAction) {
            pendingCustomerAction();
            setPendingCustomerAction(null);
          }
        }, 50);
      }
      return updated;
    });
  };

  // Cart operations
  const addToCart = (newItem: CartItem) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (i) =>
          i.menuItem.id === newItem.menuItem.id &&
          i.selectedShape === newItem.selectedShape &&
          i.selectedCrust === newItem.selectedCrust &&
          i.spiceLevel === newItem.spiceLevel &&
          JSON.stringify(i.addons) === JSON.stringify(newItem.addons) &&
          (i.specialInstructions || '') === (newItem.specialInstructions || '')
      );

      if (existingIdx > -1) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: next[existingIdx].quantity + newItem.quantity,
        };
        return next;
      }
      return [...prev, newItem];
    });
    soundService.playChime('pop');
  };

  const updateCartQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);
    });
    soundService.playChime('pop');
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((i) => i.cartItemId !== cartItemId));
  };

  const clearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
  };

  // Customizer modal
  const openCustomizer = (item: MenuItem) => {
    setSelectedCustomizerItem(item);
    setIsCustomizerOpen(true);
  };

  const closeCustomizer = () => {
    setIsCustomizerOpen(false);
    setSelectedCustomizerItem(null);
  };

  // Pricing calculations
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const deliveryFee = orderType === 'delivery' ? (subtotal >= 299 || subtotal === 0 ? 0 : 30) : 0;
  const tax = Math.round(subtotal * 0.05 * 100) / 100; // 5% GST

  let discountAmount = 0;
  if (appliedCoupon && subtotal > 0) {
    const coupon = PROMO_COUPONS.find((c) => c.code.toUpperCase() === appliedCoupon.toUpperCase());
    if (coupon && subtotal >= coupon.minOrder) {
      if (coupon.discountType === 'percentage') {
        discountAmount = Math.round((subtotal * coupon.discountValue) / 100);
      } else {
        discountAmount = coupon.discountValue;
      }
    }
  }

  const grandTotal = Math.max(0, Math.round((subtotal + tax + deliveryFee - discountAmount) * 100) / 100);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const applyCoupon = (code: string) => {
    const found = PROMO_COUPONS.find((c) => c.code.toUpperCase() === code.trim().toUpperCase());
    if (!found) {
      return { success: false, message: 'Invalid promo code. Try MOZZFIRST or KOREANLOVE!' };
    }
    if (subtotal < found.minOrder) {
      return { success: false, message: `Minimum order value of ₹${found.minOrder} required for ${found.code}.` };
    }
    setAppliedCoupon(found.code);
    soundService.playChime('success');
    return { success: true, message: `Coupon ${found.code} applied successfully!` };
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  // ==========================================================
  // ORDER CREATION (PostgreSQL Transaction via POST /api/orders)
  // ==========================================================
  const createOrder = async (paymentMethod: PaymentMethod, paymentId?: string): Promise<Order> => {
    const payload = {
      items: cart,
      orderType,
      entrySource: qrSession.source,
      tableNumber: orderType === 'dine_in' ? (tableNumber || qrSession.tableNumber || 'Table 1') : undefined,
      customer: {
        ...customerDetails,
        tableNumber: orderType === 'dine_in' ? (tableNumber || qrSession.tableNumber || 'Table 1') : undefined,
      },
      paymentMethod,
      paymentId: paymentId || `pay_MOZZ_${Date.now()}`,
      couponCode: appliedCoupon || undefined,
      discount: discountAmount,
      deliveryFee,
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to register order in database');
      }

      const createdOrder: Order = await res.json();

      setOrders((prev) => [createdOrder, ...prev.filter((o) => o.id !== createdOrder.id)]);
      setActiveOrderId(createdOrder.id);
      clearCart();
      setIsCartOpen(false);
      soundService.playChime('new_order');

      return createdOrder;
    } catch (err: any) {
      console.error('[StoreContext] Order creation failed:', err);
      throw err;
    }
  };

  // Update order status (strictly updates PostgreSQL; no false optimistic updates on failure)
  const updateOrderStatus = useCallback(async (orderId: string, newStatus: OrderStatus, note?: string) => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, note }),
      });

      if (res.ok) {
        const updatedOrder: Order = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updatedOrder : o)));
        soundService.playChime('notification');
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error('[StoreContext] Status update failed on server:', errData.error || res.statusText);
      }
    } catch (err) {
      console.error('[StoreContext] Error updating order status:', err);
    }
  }, []);

  const cancelOrder = async (
    orderId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string; order?: Order }> => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'Cancelled by customer (wrongly placed)' }),
      });
      if (res.ok) {
        const updatedOrder: Order = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updatedOrder : o)));
        soundService.playChime('notification');
        return { success: true, order: updatedOrder };
      } else {
        const errData = await res.json().catch(() => ({}));
        const errorMsg =
          errData.error || res.statusText || 'Failed to cancel order';
        console.error('[StoreContext] Cancel order failed on server:', errorMsg);
        // Refresh latest order from server so customer view updates to current status
        await fetchOrderById(orderId);
        return { success: false, error: errorMsg };
      }
    } catch (err: any) {
      console.error('[StoreContext] Error cancelling order:', err);
      await fetchOrderById(orderId);
      return { success: false, error: err.message || 'Network error cancelling order' };
    }
  };

  const fetchOrderById = useCallback(async (orderId: string): Promise<Order | null> => {
    if (!orderId) return null;
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
      if (res.ok) {
        const ord: Order = await res.json();
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === ord.id);
          if (exists) {
            return prev.map((o) => (o.id === ord.id ? ord : o));
          }
          return [ord, ...prev];
        });
        return ord;
      }
    } catch (err) {
      console.error('[StoreContext] Error fetching order by ID:', err);
    }
    return null;
  }, []);

  const updateOrderDeliveryLocation = useCallback(
    async (
      orderId: string,
      location: { latitude: number; longitude: number; address?: string }
    ): Promise<Order | null> => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/location`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(location),
        });
        if (res.ok) {
          const updated: Order = await res.json();
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
          return updated;
        }
      } catch (err) {
        console.error('[StoreContext] Error updating delivery location in DB:', err);
      }
      return null;
    },
    []
  );

  const deleteOrder = async (orderId: string) => {
    try {
      await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Failed to delete order from backend:', err);
    }
    setOrders((prev) => prev.filter((order) => order.id !== orderId));
    if (activeOrderId === orderId) {
      setActiveOrderId(null);
    }
    soundService.playChime('pop');
  };

  const deleteKot = async (orderId: string) => {
    try {
      await fetch(`/api/kots/${encodeURIComponent(orderId)}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Failed to delete KOT from backend:', err);
    }
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id === orderId) {
          const { kotNumber, kotStation, ...rest } = order;
          return {
            ...rest,
            kotNumber: undefined,
            kotStation: undefined,
          };
        }
        return order;
      })
    );
    soundService.playChime('pop');
  };

  // Admin authentication (PostgreSQL Bcrypt Authenticated via Backend API)
  const loginAdmin = async (password: string): Promise<boolean> => {
    const clean = password.trim();
    if (!clean) return false;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: clean }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.token) {
          localStorage.setItem('starters4u_admin_jwt_token', data.token);
          if (data.user) {
            localStorage.setItem('starters4u_admin_user_profile', JSON.stringify(data.user));
          }
          setIsAdminAuthenticated(true);
          soundService.playChime('success');
          return true;
        }
      }
    } catch (err) {
      console.warn('Backend login verification notice, attempting fallback check:', err);
    }

    return false;
  };

  const logoutAdmin = () => {
    setIsAdminAuthenticated(false);
  };

  // Admin menu editing connected to PostgreSQL Backend
  const toggleItemStock = async (itemId: string) => {
    // Optimistic UI toggle
    setMenu((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, inStock: !item.inStock } : item))
    );

    try {
      const res = await fetch(`/api/menu/${encodeURIComponent(itemId)}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const updatedItem = await res.json();
        setMenu((prev) => prev.map((item) => (item.id === itemId ? updatedItem : item)));
      }
    } catch (err) {
      console.error('Error updating stock in backend:', err);
    }
  };

  const updateItemPrice = async (
    itemId: string,
    newPrice: number | { R: number; C: number; S: number }
  ) => {
    const updates: Partial<MenuItem> =
      typeof newPrice === 'number'
        ? { price: newPrice, isPocketPizza: false }
        : { prices: newPrice, isPocketPizza: true };

    setMenu((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, ...updates } : item))
    );

    try {
      const res = await fetch(`/api/menu/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updatedItem = await res.json();
        setMenu((prev) => prev.map((item) => (item.id === itemId ? updatedItem : item)));
      }
    } catch (err) {
      console.error('Error updating price in backend:', err);
    }
  };

  const addMenuItem = async (newItemData: Omit<MenuItem, 'id'>) => {
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItemData),
      });

      if (res.ok) {
        const created: MenuItem = await res.json();
        setMenu((prev) => [created, ...prev]);
        soundService.playChime('success');
      }
    } catch (err) {
      console.error('Error adding menu item:', err);
    }
  };

  const updateMenuItem = async (itemId: string, updatedFields: Partial<MenuItem>) => {
    setMenu((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, ...updatedFields } : item))
    );

    try {
      const res = await fetch(`/api/menu/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields),
      });
      if (res.ok) {
        const updated = await res.json();
        setMenu((prev) => prev.map((item) => (item.id === itemId ? updated : item)));
        soundService.playChime('success');
      }
    } catch (err) {
      console.error('Error updating menu item:', err);
    }
  };

  const deleteMenuItem = async (itemId: string) => {
    setMenu((prev) => prev.filter((item) => item.id !== itemId));
    try {
      await fetch(`/api/menu/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
      soundService.playChime('notification');
    } catch (err) {
      console.error('Error deleting menu item:', err);
    }
  };

  const resetMenuToDefault = async () => {
    try {
      const res = await fetch('/api/menu/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.menu) setMenu(data.menu);
      } else {
        setMenu(INITIAL_MENU);
      }
    } catch (err) {
      setMenu(INITIAL_MENU);
    }
  };

  const activeOrder = orders.find((o) => o.id === activeOrderId) || (orders.length > 0 ? orders[0] : null);

  return (
    <StoreContext.Provider
      value={{
        menu,
        cart,
        orders,
        activeOrderId,
        activeOrder,
        isCartOpen,
        isCustomizerOpen,
        selectedCustomizerItem,
        appliedCoupon,
        discountAmount,
        orderType,
        tableNumber,
        qrSession,
        isModeLocked,
        isAdminAuthenticated,
        soundEnabled,
        customerDetails,
        isCustomerVerified,
        isCustomerModalOpen,
        isLoadingMenu,
        isLoadingOrders,
        setIsCustomerModalOpen,
        promptCustomerVerification,
        switchQRSession,
        clearQRSession,
        setOrderType,
        setTableNumber,
        setCustomerDetails,
        setIsCartOpen,
        openCustomizer,
        closeCustomizer,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        applyCoupon,
        removeCoupon,
        createOrder,
        updateOrderStatus,
        updateOrderDeliveryLocation,
        setActiveOrderId,
        fetchOrderById,
        cancelOrder,
        deleteOrder,
        deleteKot,
        refreshOrders,
        refreshMenu,
        loginAdmin,
        logoutAdmin,
        toggleItemStock,
        updateItemPrice,
        addMenuItem,
        updateMenuItem,
        deleteMenuItem,
        resetMenuToDefault,
        toggleSound,
        subtotal,
        tax,
        deliveryFee,
        grandTotal,
        itemCount,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
