import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { MenuItem, CartItem, Order, OrderStatus, OrderType, CustomerDetails, PaymentMethod } from '../types';
import { INITIAL_MENU, PROMO_COUPONS } from '../data/menuData';
import { soundService } from '../utils/audio';

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
  isAdminAuthenticated: boolean;
  soundEnabled: boolean;
  customerDetails: CustomerDetails;
  isCustomerVerified: boolean;
  isCustomerModalOpen: boolean;
  
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
  
  // Order actions
  createOrder: (paymentMethod: PaymentMethod, paymentId?: string) => Promise<Order>;
  updateOrderStatus: (orderId: string, newStatus: OrderStatus, note?: string) => void;
  setActiveOrderId: (orderId: string | null) => void;
  cancelOrder: (orderId: string, reason?: string) => void;
  
  // Admin actions
  loginAdmin: (password: string) => boolean;
  logoutAdmin: () => void;
  toggleItemStock: (itemId: string) => void;
  updateItemPrice: (itemId: string, newPrice: number | { R: number; C: number; S: number }) => void;
  addMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  updateMenuItem: (itemId: string, updated: Partial<MenuItem>) => void;
  deleteMenuItem: (itemId: string) => void;
  resetMenuToDefault: () => void;
  toggleSound: () => void;
  
  // Cart calculations
  subtotal: number;
  tax: number;
  deliveryFee: number;
  grandTotal: number;
  itemCount: number;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_MENU = 'mozz_menu_v2';
const LOCAL_STORAGE_KEY_CART = 'mozz_cart_v1';
const LOCAL_STORAGE_KEY_ORDERS = 'mozz_orders_v1';
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

const SAMPLE_INITIAL_ORDERS: Order[] = [
  {
    id: 'MOZZ-8901',
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    items: [
      {
        cartItemId: 'sample-1',
        menuItem: INITIAL_MENU[0], // Cheesy Margherita
        selectedShape: 'R',
        selectedCrust: 'Korean Pocket Crust',
        spiceLevel: 'Mild',
        addons: [{ id: 'cheese_burst', name: 'Extra Korean In-House Cheese Blend', price: 40 }],
        unitPrice: 189,
        quantity: 2,
      },
      {
        cartItemId: 'sample-2',
        menuItem: INITIAL_MENU[14], // Chilli Chicken
        addons: [],
        unitPrice: 179,
        quantity: 1,
      },
    ],
    orderType: 'delivery',
    customer: {
      name: 'Aditi Verma',
      phone: '9845012345',
      address: 'Villa 12, Green Park Avenue',
      landmark: 'Next to Central Bank',
    },
    status: 'out_for_delivery',
    paymentMethod: 'gpay',
    paymentStatus: 'paid',
    paymentId: 'pay_MOZZ_sim_8901',
    itemTotal: 557,
    tax: 27.85,
    deliveryFee: 0,
    discount: 50,
    couponCode: 'KOREANLOVE',
    grandTotal: 534.85,
    estimatedDeliveryTimeMinutes: 12,
    driverDetails: {
      name: 'Suresh Kumar',
      phone: '9876011223',
      vehicleNumber: 'TS 09 EZ 4521 (Electric Bike)',
    },
    statusHistory: [
      { status: 'placed', timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(), note: 'Order placed via Razorpay UPI' },
      { status: 'confirmed', timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), note: 'Kitchen accepted order' },
      { status: 'baking', timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(), note: 'Baking Rectangular Pocket Pizzas' },
      { status: 'packing', timestamp: new Date(Date.now() - 1000 * 60 * 6).toISOString(), note: 'Quality check and sealed in thermal box' },
      { status: 'out_for_delivery', timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(), note: 'Delivery rider Suresh picked up the order' },
    ],
  },
  {
    id: 'MOZZ-8902',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    items: [
      {
        cartItemId: 'sample-3',
        menuItem: INITIAL_MENU[11], // ABC Chicken Pocket
        selectedShape: 'S',
        selectedCrust: 'Korean Pocket Crust',
        spiceLevel: 'Medium',
        addons: [{ id: 'schezwan_dip', name: 'Signature Hot Schezwan Dip', price: 25 }],
        unitPrice: 354,
        quantity: 1,
      },
      {
        cartItemId: 'sample-4',
        menuItem: INITIAL_MENU[30], // Chicken Fried Rice
        addons: [],
        unitPrice: 137,
        quantity: 1,
      },
    ],
    orderType: 'takeaway',
    customer: {
      name: 'Karan Singh',
      phone: '9988776655',
    },
    status: 'baking',
    paymentMethod: 'phonepe',
    paymentStatus: 'paid',
    paymentId: 'pay_MOZZ_sim_8902',
    itemTotal: 491,
    tax: 24.55,
    deliveryFee: 0,
    discount: 0,
    grandTotal: 515.55,
    estimatedDeliveryTimeMinutes: 15,
    statusHistory: [
      { status: 'placed', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), note: 'Order placed for Takeaway' },
      { status: 'confirmed', timestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(), note: 'Kitchen accepted' },
      { status: 'baking', timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(), note: 'Chefs preparing in stone-deck oven' },
    ],
  },
];

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Menu state
  const [menu, setMenu] = useState<MenuItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_MENU);
      return saved ? JSON.parse(saved) : INITIAL_MENU;
    } catch {
      return INITIAL_MENU;
    }
  });

  // Cart state
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_CART);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Orders state
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_ORDERS);
      return saved ? JSON.parse(saved) : SAMPLE_INITIAL_ORDERS;
    } catch {
      return SAMPLE_INITIAL_ORDERS;
    }
  });

  // Active tracked order ID
  const [activeOrderId, setActiveOrderId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_ACTIVE_ORDER);
      return saved || 'MOZZ-8901';
    } catch {
      return 'MOZZ-8901';
    }
  });

  // UI Modals & Settings
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [selectedCustomizerItem, setSelectedCustomizerItem] = useState<MenuItem | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [pendingCustomerAction, setPendingCustomerAction] = useState<(() => void) | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<OrderType>('delivery');
  const [tableNumber, setTableNumber] = useState('Table 1');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Admin Authentication state
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LOCAL_STORAGE_KEY_ADMIN) === 'true';
    } catch {
      return false;
    }
  });

  // Customer details
  const [customerDetails, setCustomerDetailsState] = useState<CustomerDetails>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_CUSTOMER);
      return saved ? JSON.parse(saved) : INITIAL_CUSTOMER;
    } catch {
      return INITIAL_CUSTOMER;
    }
  });

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_MENU, JSON.stringify(menu));
    } catch {
      // storage quota fallback
    }
  }, [menu]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_CART, JSON.stringify(cart));
    } catch {}
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_ORDERS, JSON.stringify(orders));
    } catch {}
  }, [orders]);

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
      // Check if newly updated details verify customer
      if (
        updated.name &&
        updated.name.trim().length >= 2 &&
        updated.phone &&
        updated.phone.trim().replace(/\D/g, '').length === 10 &&
        pendingCustomerAction
      ) {
        // Execute pending action after brief tick
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
      // Check if identical item with same shape & addons already in cart
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

  // Delivery fee is ₹30, but FREE for orders above ₹299 or for Dine-in/Takeaway
  const deliveryFee = orderType === 'delivery' ? (subtotal >= 299 || subtotal === 0 ? 0 : 30) : 0;
  const tax = Math.round(subtotal * 0.05 * 100) / 100; // 5% GST

  // Discount calculation
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

  // Order creation
  const createOrder = async (paymentMethod: PaymentMethod, paymentId?: string): Promise<Order> => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newOrderId = `MOZZ-${randomSuffix}`;
    const kotSeq = Math.floor(100 + Math.random() * 900);
    const kotNumber = `KOT-${kotSeq}`;

    // Auto assign station based on cart items
    const hasPizzas = cart.some((it) => it.menuItem.isPocketPizza || it.menuItem.category.includes('pizza'));
    const hasChinese = cart.some(
      (it) =>
        it.menuItem.category === 'chinese_starters' ||
        it.menuItem.category === 'fried_rice' ||
        it.menuItem.category === 'noodles' ||
        it.menuItem.category === 'momos' ||
        it.menuItem.category === 'maggie'
    );
    let kotStation: 'Pizza Oven Station' | 'Chinese Wok Station' | 'All Stations' = 'All Stations';
    if (hasPizzas && !hasChinese) kotStation = 'Pizza Oven Station';
    if (!hasPizzas && hasChinese) kotStation = 'Chinese Wok Station';

    const newOrder: Order = {
      id: newOrderId,
      createdAt: new Date().toISOString(),
      items: [...cart],
      orderType,
      customer: { ...customerDetails },
      status: 'placed',
      paymentMethod,
      paymentStatus: paymentMethod === 'cod' ? 'cod_pending' : 'paid',
      paymentId: paymentId || `pay_MOZZ_${Date.now()}`,
      itemTotal: subtotal,
      tax,
      deliveryFee,
      discount: discountAmount,
      couponCode: appliedCoupon || undefined,
      grandTotal,
      estimatedDeliveryTimeMinutes: orderType === 'delivery' ? 30 : 15,
      kotNumber,
      kotStation,
      kotPrintCount: 0,
      receiptPrintCount: 0,
      waiterName: orderType === 'dine_in' ? 'Captain Ravi' : undefined,
      driverDetails:
        orderType === 'delivery'
          ? {
              name: 'Arjun Das',
              phone: '9876598765',
              vehicleNumber: 'TS 08 HG 8899 (MOZZ Express Scooter)',
            }
          : undefined,
      statusHistory: [
        {
          status: 'placed',
          timestamp: new Date().toISOString(),
          note: `Order placed via ${paymentMethod.toUpperCase()}${orderType === 'dine_in' ? ` | KOT #${kotNumber} assigned to ${kotStation}` : ''}`,
        },
      ],
    };

    setOrders((prev) => [newOrder, ...prev]);
    setActiveOrderId(newOrderId);
    clearCart();
    setIsCartOpen(false);
    soundService.playChime('new_order');

    return newOrder;
  };

  // Update order status (Admin or Automatic simulator)
  const updateOrderStatus = useCallback((orderId: string, newStatus: OrderStatus, note?: string) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id === orderId) {
          const newHistory = [
            ...order.statusHistory,
            {
              status: newStatus,
              timestamp: new Date().toISOString(),
              note: note || `Status updated to ${newStatus.replace(/_/g, ' ')}`,
            },
          ];
          return {
            ...order,
            status: newStatus,
            statusHistory: newHistory,
          };
        }
        return order;
      })
    );
    soundService.playChime('notification');
  }, []);

  const cancelOrder = (orderId: string, reason?: string) => {
    updateOrderStatus(orderId, 'cancelled', reason || 'Order cancelled by user');
  };

  // Admin authentication (Default master PIN: mozz8888 or admin123)
  const loginAdmin = (password: string): boolean => {
    const clean = password.trim();
    if (clean === 'mozz8888' || clean === 'admin123' || clean === '8888') {
      setIsAdminAuthenticated(true);
      soundService.playChime('success');
      return true;
    }
    return false;
  };

  const logoutAdmin = () => {
    setIsAdminAuthenticated(false);
  };

  // Admin menu editing
  const toggleItemStock = (itemId: string) => {
    setMenu((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, inStock: !item.inStock } : item))
    );
  };

  const updateItemPrice = (itemId: string, newPrice: number | { R: number; C: number; S: number }) => {
    setMenu((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          if (typeof newPrice === 'number') {
            return { ...item, price: newPrice };
          }
          return { ...item, prices: newPrice };
        }
        return item;
      })
    );
  };

  const addMenuItem = (newItemData: Omit<MenuItem, 'id'>) => {
    const newId = `item_${Date.now()}`;
    const newItem: MenuItem = {
      ...newItemData,
      id: newId,
    };
    setMenu((prev) => [newItem, ...prev]);
    soundService.playChime('success');
  };

  const updateMenuItem = (itemId: string, updatedFields: Partial<MenuItem>) => {
    setMenu((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, ...updatedFields } : item))
    );
    soundService.playChime('success');
  };

  const deleteMenuItem = (itemId: string) => {
    setMenu((prev) => prev.filter((item) => item.id !== itemId));
    soundService.playChime('notification');
  };

  const resetMenuToDefault = () => {
    setMenu(INITIAL_MENU);
  };

  const activeOrder = orders.find((o) => o.id === activeOrderId) || null;

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
        isAdminAuthenticated,
        soundEnabled,
        customerDetails,
        isCustomerVerified,
        isCustomerModalOpen,
        setIsCustomerModalOpen,
        promptCustomerVerification,
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
        setActiveOrderId,
        cancelOrder,
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
