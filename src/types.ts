export type PizzaShape = 'R' | 'C' | 'S'; // R = Rectangular, C = Circular, S = Square

export type FoodCategory =
  | 'pocket_pizza_veg'
  | 'pocket_pizza_nonveg'
  | 'dessert_pizza'
  | 'chinese_starters'
  | 'fried_rice'
  | 'noodles'
  | 'maggie'
  | 'momos'
  | 'drinks';

export type DietaryType = 'veg' | 'non-veg' | 'egg' | 'dessert';

export interface MenuItem {
  id: string;
  itemCode?: string;
  name: string;
  category: FoodCategory;
  dietary: DietaryType;
  description: string;
  isPocketPizza?: boolean;
  // Prices for pocket pizzas have 3 shape tiers; regular items have a single base price
  prices?: {
    R: number; // Regular Rectangular
    C: number; // Classic Circular
    S: number; // Signature Square
  };
  price?: number; // For non-pizza items
  isPopular?: boolean;
  isChefSpecial?: boolean;
  spicyLevel?: 0 | 1 | 2 | 3;
  inStock: boolean;
  image?: string;
  badge?: string;
}

export interface CartItemAddon {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  cartItemId: string;
  menuItem: MenuItem;
  selectedShape?: PizzaShape; // For pocket pizzas
  selectedCrust?: string; // e.g., 'Korean Pocket Crust', 'Cheese Burst Pocket'
  spiceLevel?: 'Mild' | 'Medium' | 'Authentic Spicy';
  addons: CartItemAddon[];
  specialInstructions?: string;
  unitPrice: number;
  quantity: number;
}

export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'baking'
  | 'packing'
  | 'out_for_delivery'
  | 'ready_for_pickup'
  | 'delivered'
  | 'cancelled';

export type OrderType = 'delivery' | 'takeaway' | 'dine_in';

export type EntrySource = 'table_qr' | 'counter_qr' | 'online_web';

export interface QRSessionInfo {
  source: EntrySource;
  orderMode: OrderType;
  tableNumber?: string;
  token?: string;
  isVerified: boolean;
  isModeLocked: boolean;
  verificationMessage?: string;
  signature?: string;
}

export type PaymentMethod = 'razorpay' | 'upi_qr' | 'gpay' | 'phonepe' | 'paytm' | 'card' | 'netbanking' | 'cod';

export interface CustomerDetails {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  landmark?: string;
  tableNumber?: string;
  notes?: string;
}

export interface Order {
  id: string;
  restaurantId?: string;
  branchId?: string;
  orderNumber?: string;
  tableNumber?: string;
  createdAt: string;
  items: CartItem[];
  orderType: OrderType;
  entrySource?: EntrySource;
  qrSession?: QRSessionInfo;
  customer: CustomerDetails;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: 'pending' | 'paid' | 'cod_pending' | 'failed';
  paymentId?: string;
  itemTotal: number;
  tax: number; // 5% GST
  deliveryFee: number;
  discount: number;
  couponCode?: string;
  grandTotal: number;
  estimatedDeliveryTimeMinutes: number;
  kotNumber?: string;
  kotStation?: 'Pizza Oven Station' | 'Chinese Wok Station' | 'All Stations';
  waiterName?: string;
  kotPrintCount?: number;
  receiptPrintCount?: number;
  driverDetails?: {
    name: string;
    phone: string;
    vehicleNumber: string;
    currentLocationLat?: number;
    currentLocationLng?: number;
  };
  statusHistory: {
    status: OrderStatus;
    timestamp: string;
    note: string;
  }[];
}

export interface Coupon {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrder: number;
  description: string;
}
