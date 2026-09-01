import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { INITIAL_MENU } from '../src/data/menuData.js';

dotenv.config();

const { Pool } = pg;

// Detect database connection URL from environment variables
const DATABASE_URL = process.env.DATABASE_URL;

let pool: pg.Pool | null = null;
let isPostgresActive = false;

// Default admin bcrypt hash (cost 10) for PIN 8888
const DEFAULT_ADMIN_BCRYPT = bcrypt.hashSync('8888', 10);

// Reusable Database connection module
export function getDbPool(): pg.Pool | null {
  if (pool) return pool;

  if (!DATABASE_URL) {
    console.info('[DB] DATABASE_URL not detected in environment variables. Running with in-memory persistence fallback.');
    return null;
  }

  try {
    const isLocal = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 20, // Max clients in pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[DB] Unexpected error on idle PostgreSQL client:', err);
    });

    return pool;
  } catch (err) {
    console.error('[DB] Failed to initialize PostgreSQL pool:', err);
    return null;
  }
}

// In-Memory Multi-Tenant Store for Fallback / Local Simulation Mode
export interface InMemoryDbState {
  restaurants: any[];
  restaurant_branches: any[];
  restaurant_users: any[];
  restaurant_tables: any[];
  customers: any[];
  menu_categories: any[];
  menu_items: any[];
  orders: any[];
  order_items: any[];
  order_status_history: any[];
  payments: any[];
  kots: any[];
  qr_codes: any[];
  subscriptions: any[];
}

export const inMemoryDb: InMemoryDbState = {
  restaurants: [
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      name: 'MOZZ Chinese & Pizzateria',
      slug: 'mozz',
      phone: '+91 98450 12345',
      email: 'contact@mozzpizzateria.com',
      logo_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200',
      tagline: 'Korean-Style Pocket Pizzas & Indo-Chinese Delicacies',
      currency: 'INR',
      tax_rate: 5.0,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  restaurant_branches: [
    {
      id: 'b0000000-0000-0000-0000-000000000001',
      restaurant_id: 'a0000000-0000-0000-0000-000000000001',
      name: 'Main Branch - Flagship Outlet',
      slug: 'main-outlet',
      address: 'Shop #4, Ground Floor, Food Street Hub, Near Metro Pillar 124 (Placeholder)',
      latitude: 17.448294,
      longitude: 78.391485,
      delivery_radius_km: 12.0,
      phone: '+91 98450 12345',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  restaurant_users: [
    {
      id: 'c0000000-0000-0000-0000-000000000001',
      restaurant_id: 'a0000000-0000-0000-0000-000000000001',
      branch_id: 'b0000000-0000-0000-0000-000000000001',
      name: 'Store Manager (Admin)',
      email: 'admin@mozzpizzateria.com',
      phone: '+91 98450 12345',
      role: 'admin',
      pin_hash: DEFAULT_ADMIN_BCRYPT,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  restaurant_tables: Array.from({ length: 20 }, (_, i) => ({
    id: `00000000-0000-0000-0000-0000000000${String(i + 1).padStart(2, '0')}`,
    restaurant_id: 'a0000000-0000-0000-0000-000000000001',
    branch_id: 'b0000000-0000-0000-0000-000000000001',
    table_number: String(i + 1),
    table_name: `Table ${i + 1}`,
    capacity: i === 19 ? 12 : i >= 7 && i <= 8 ? 8 : 4,
    qr_token_id: `qr-token-tbl-${i + 1}`,
    is_active: true,
    created_at: new Date().toISOString(),
  })),
  customers: [],
  menu_categories: [
    { id: 'cat-1', restaurant_id: 'a0000000-0000-0000-0000-000000000001', slug: 'pocket_pizza_veg', name: 'Veg Pocket Pizzas', display_order: 1 },
    { id: 'cat-2', restaurant_id: 'a0000000-0000-0000-0000-000000000001', slug: 'pocket_pizza_nonveg', name: 'Non-Veg Pocket Pizzas', display_order: 2 },
    { id: 'cat-3', restaurant_id: 'a0000000-0000-0000-0000-000000000001', slug: 'dessert_pizza', name: 'Dessert Pocket Pizzas', display_order: 3 },
    { id: 'cat-4', restaurant_id: 'a0000000-0000-0000-0000-000000000001', slug: 'chinese_starters', name: 'Chinese Starters', display_order: 4 },
    { id: 'cat-5', restaurant_id: 'a0000000-0000-0000-0000-000000000001', slug: 'fried_rice', name: 'Fried Rice Delights', display_order: 5 },
    { id: 'cat-6', restaurant_id: 'a0000000-0000-0000-0000-000000000001', slug: 'noodles', name: 'Wok Tossed Noodles', display_order: 6 },
    { id: 'cat-7', restaurant_id: 'a0000000-0000-0000-0000-000000000001', slug: 'maggie', name: 'Fusion Maggie Bowls', display_order: 7 },
    { id: 'cat-8', restaurant_id: 'a0000000-0000-0000-0000-000000000001', slug: 'momos', name: 'Steamed & Fried Momos', display_order: 8 },
    { id: 'cat-9', restaurant_id: 'a0000000-0000-0000-0000-000000000001', slug: 'drinks', name: 'Chilled Beverages', display_order: 9 },
  ],
  menu_items: INITIAL_MENU.map((item) => ({
    id: item.id,
    restaurant_id: 'a0000000-0000-0000-0000-000000000001',
    branch_id: 'b0000000-0000-0000-0000-000000000001',
    category: item.category,
    name: item.name,
    description: item.description,
    dietary_type: item.dietary,
    price: item.price ?? null,
    price_r: item.prices?.R ?? null,
    price_c: item.prices?.C ?? null,
    price_s: item.prices?.S ?? null,
    is_pocket_pizza: !!item.isPocketPizza,
    is_popular: !!item.isPopular,
    is_chef_special: !!item.isChefSpecial,
    spicy_level: item.spicyLevel ?? 0,
    in_stock: item.inStock !== false,
    image_url: item.image ?? null,
    badge: item.badge ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })),
  orders: [],
  order_items: [],
  order_status_history: [],
  payments: [],
  kots: [],
  qr_codes: [],
  subscriptions: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      restaurant_id: 'a0000000-0000-0000-0000-000000000001',
      plan_name: 'enterprise_growth',
      status: 'active',
      billing_cycle: 'annual',
      amount: 14999,
      starts_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ],
};

// Seed sample orders for immediate richness if in memory
export function seedSampleOrdersInMemory() {
  if (inMemoryDb.orders.length > 0) return;

  const sampleCustId = '00000000-0000-0000-0000-000000000101';
  const sampleOrderId = 'd0000000-0000-0000-0000-000000008901';

  const sampleCustomer = {
    id: sampleCustId,
    restaurant_id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Aditi Verma',
    phone: '9845012345',
    email: 'aditi.verma@example.com',
    address: 'Villa 12, Green Park Avenue',
    landmark: 'Next to Central Bank',
    created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  };
  inMemoryDb.customers.push(sampleCustomer);

  const sampleOrder = {
    id: sampleOrderId,
    order_number: 'MOZZ-8901',
    restaurant_id: 'a0000000-0000-0000-0000-000000000001',
    branch_id: 'b0000000-0000-0000-0000-000000000001',
    customer_id: sampleCustId,
    order_type: 'delivery',
    entry_source: 'online_web',
    table_id: null,
    table_number: null,
    status: 'out_for_delivery',
    payment_method: 'gpay',
    payment_status: 'paid',
    payment_id: 'pay_MOZZ_sim_8901',
    item_total: 557,
    tax: 27.85,
    delivery_fee: 0,
    discount: 50,
    coupon_code: 'KOREANLOVE',
    grand_total: 534.85,
    estimated_delivery_time_minutes: 12,
    kot_number: 'KOT-8901',
    kot_station: 'All Stations',
    driver_name: 'Suresh Kumar',
    driver_phone: '9876011223',
    driver_vehicle: 'TS 09 EZ 4521 (Electric Bike)',
    customer_snapshot: {
      name: 'Aditi Verma',
      phone: '9845012345',
      address: 'Villa 12, Green Park Avenue',
      landmark: 'Next to Central Bank',
    },
    created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
  };
  inMemoryDb.orders.push(sampleOrder);

  inMemoryDb.order_items.push(
    {
      id: '00000000-0000-0000-0000-000000000101',
      order_id: sampleOrderId,
      restaurant_id: 'a0000000-0000-0000-0000-000000000001',
      menu_item_id: 'vp-1',
      item_name: 'Cheesy Margherita',
      quantity: 2,
      unit_price: 189,
      selected_shape: 'R',
      selected_crust: 'Korean Pocket Crust',
      spice_level: 'Mild',
      addons: [{ id: 'cheese_burst', name: 'Extra Korean In-House Cheese Blend', price: 40 }],
      special_instructions: '',
      created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000102',
      order_id: sampleOrderId,
      restaurant_id: 'a0000000-0000-0000-0000-000000000001',
      menu_item_id: 'cs-1',
      item_name: 'Chilli Chicken Dry (Indo-Chinese)',
      quantity: 1,
      unit_price: 179,
      selected_shape: null,
      selected_crust: null,
      spice_level: 'Medium',
      addons: [],
      special_instructions: '',
      created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    }
  );

  inMemoryDb.order_status_history.push(
    { id: '00000000-0000-0000-0000-000000000111', order_id: sampleOrderId, restaurant_id: 'a0000000-0000-0000-0000-000000000001', status: 'placed', note: 'Order placed via Razorpay UPI', created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString() },
    { id: '00000000-0000-0000-0000-000000000112', order_id: sampleOrderId, restaurant_id: 'a0000000-0000-0000-0000-000000000001', status: 'confirmed', note: 'Kitchen accepted order', created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
    { id: '00000000-0000-0000-0000-000000000113', order_id: sampleOrderId, restaurant_id: 'a0000000-0000-0000-0000-000000000001', status: 'baking', note: 'Baking Rectangular Pocket Pizzas', created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString() },
    { id: '00000000-0000-0000-0000-000000000114', order_id: sampleOrderId, restaurant_id: 'a0000000-0000-0000-0000-000000000001', status: 'packing', note: 'Quality check and sealed in thermal box', created_at: new Date(Date.now() - 1000 * 60 * 6).toISOString() },
    { id: '00000000-0000-0000-0000-000000000115', order_id: sampleOrderId, restaurant_id: 'a0000000-0000-0000-0000-000000000001', status: 'out_for_delivery', note: 'Delivery rider Suresh picked up the order', created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString() }
  );

  inMemoryDb.kots.push({
    id: '00000000-0000-0000-0000-000000000121',
    restaurant_id: 'a0000000-0000-0000-0000-000000000001',
    branch_id: 'b0000000-0000-0000-0000-000000000001',
    order_id: sampleOrderId,
    kot_number: 'KOT-8901',
    station: 'All Stations',
    print_count: 1,
    status: 'active',
    created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  });
}

seedSampleOrdersInMemory();

// Database Query Wrapper
export async function query(text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
  const currentPool = getDbPool();
  if (currentPool && isPostgresActive) {
    try {
      const res = await currentPool.query(text, params);
      return { rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
    } catch (err: any) {
      console.error('[DB Query Error]', { text, error: err.message });
      throw err;
    }
  }

  return executeInMemoryQuery(text, params);
}

// Transaction Client Helper
export async function getClient() {
  const currentPool = getDbPool();
  if (currentPool && isPostgresActive) {
    return await currentPool.connect();
  }
  return null;
}

// In-Memory query simulator for non-SQL fallback
function executeInMemoryQuery(text: string, params: any[] = []): { rows: any[]; rowCount: number } {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (lower.startsWith('select') && lower.includes('from restaurants')) {
    return { rows: inMemoryDb.restaurants, rowCount: inMemoryDb.restaurants.length };
  }
  if (lower.startsWith('select') && lower.includes('from menu_items')) {
    return { rows: inMemoryDb.menu_items, rowCount: inMemoryDb.menu_items.length };
  }
  if (lower.startsWith('select') && lower.includes('from orders')) {
    return { rows: inMemoryDb.orders, rowCount: inMemoryDb.orders.length };
  }
  if (lower.startsWith('select') && lower.includes('from restaurant_tables')) {
    return { rows: inMemoryDb.restaurant_tables, rowCount: inMemoryDb.restaurant_tables.length };
  }

  return { rows: [], rowCount: 0 };
}

// Initialize and auto-migrate PostgreSQL on startup if DATABASE_URL is present
export async function initializeDatabase() {
  const currentPool = getDbPool();
  if (!currentPool) {
    console.info('[DB] Running with in-memory multi-tenant storage.');
    return { success: true, mode: 'in_memory' };
  }

  try {
    const client = await currentPool.connect();
    try {
      console.info('[DB] Successfully connected to PostgreSQL instance.');
      isPostgresActive = true;

      // Run schema initialization (Creates or modifies existing tables, columns, constraints, triggers, indexes)
      const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
        await client.query(schemaSql);
        console.info('[DB] PostgreSQL multi-tenant schema verified/applied (created or modified objects).');
      }

      // Apply seed script (Idempotently creates or modifies base restaurant, branch, tables, categories & menu items)
      const seedPath = path.join(process.cwd(), 'database', 'seed.sql');
      if (fs.existsSync(seedPath)) {
        const seedSql = fs.readFileSync(seedPath, 'utf-8');
        await client.query(seedSql);
        console.info('[DB] Seed data verified/applied (created or modified existing objects).');
      }

      return { success: true, mode: 'postgresql' };
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn('[DB] Could not connect to PostgreSQL with DATABASE_URL, continuing with in-memory store:', err.message);
    isPostgresActive = false;
    return { success: false, mode: 'in_memory', error: err.message };
  }
}

export function isPostgresRunning(): boolean {
  return isPostgresActive;
}
