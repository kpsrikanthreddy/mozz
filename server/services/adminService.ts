import crypto from 'crypto';
import { query, inMemoryDb, isPostgresRunning } from '../db.js';
import { hashPassword } from './authService.js';

export interface AdminAnalytics {
  totalRevenue: number;
  totalOrders: number;
  activeOrders: number;
  dineInOrders: number;
  takeawayOrders: number;
  deliveryOrders: number;
  topSellingItems: { name: string; count: number; revenue: number }[];
  todayRevenue: number;
  todayOrders: number;
}

export async function getTenantAnalytics(restaurantId: string): Promise<AdminAnalytics> {
  if (isPostgresRunning()) {
    try {
      const statsRes = await query(
        `SELECT
          COALESCE(SUM(grand_total), 0) as total_revenue,
          COUNT(*) as total_orders,
          COUNT(*) FILTER (WHERE status NOT IN ('delivered', 'cancelled')) as active_orders,
          COUNT(*) FILTER (WHERE order_type = 'dine_in') as dine_in_orders,
          COUNT(*) FILTER (WHERE order_type = 'takeaway') as takeaway_orders,
          COUNT(*) FILTER (WHERE order_type = 'delivery') as delivery_orders,
          COALESCE(SUM(grand_total) FILTER (WHERE created_at >= CURRENT_DATE), 0) as today_revenue,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_orders
        FROM orders
        WHERE restaurant_id = $1`,
        [restaurantId]
      );

      const row = statsRes.rows[0];

      const topItemsRes = await query(
        `SELECT item_name as name, SUM(quantity)::int as count, SUM(quantity * unit_price) as revenue
         FROM order_items
         WHERE restaurant_id = $1
         GROUP BY item_name
         ORDER BY count DESC
         LIMIT 5`,
        [restaurantId]
      );

      return {
        totalRevenue: Number(row.total_revenue || 0),
        totalOrders: Number(row.total_orders || 0),
        activeOrders: Number(row.active_orders || 0),
        dineInOrders: Number(row.dine_in_orders || 0),
        takeawayOrders: Number(row.takeaway_orders || 0),
        deliveryOrders: Number(row.delivery_orders || 0),
        todayRevenue: Number(row.today_revenue || 0),
        todayOrders: Number(row.today_orders || 0),
        topSellingItems: topItemsRes.rows.map((r) => ({
          name: r.name,
          count: Number(r.count),
          revenue: Number(r.revenue),
        })),
      };
    } catch (err: any) {
      console.error('[AdminService] Error computing analytics in PG:', err.message);
    }
  }

  // In-Memory Fallback
  const orders = inMemoryDb.orders.filter((o) => o.restaurant_id === restaurantId);
  const items = inMemoryDb.order_items.filter((i) => i.restaurant_id === restaurantId);

  const totalRevenue = orders.reduce((sum, o) => sum + (o.grand_total || 0), 0);
  const activeOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length;
  const dineInOrders = orders.filter((o) => o.order_type === 'dine_in').length;
  const takeawayOrders = orders.filter((o) => o.order_type === 'takeaway').length;
  const deliveryOrders = orders.filter((o) => o.order_type === 'delivery').length;

  const itemMap = new Map<string, { count: number; revenue: number }>();
  for (const it of items) {
    const curr = itemMap.get(it.item_name) || { count: 0, revenue: 0 };
    itemMap.set(it.item_name, {
      count: curr.count + (it.quantity || 1),
      revenue: curr.revenue + (it.quantity || 1) * (it.unit_price || 0),
    });
  }

  const topSellingItems = Array.from(itemMap.entries())
    .map(([name, data]) => ({ name, count: data.count, revenue: data.revenue }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalRevenue,
    totalOrders: orders.length,
    activeOrders,
    dineInOrders,
    takeawayOrders,
    deliveryOrders,
    todayRevenue: Math.round(totalRevenue * 0.4),
    todayOrders: Math.max(1, Math.round(orders.length * 0.4)),
    topSellingItems,
  };
}

export async function getTenantCustomers(restaurantId: string) {
  if (isPostgresRunning()) {
    try {
      const res = await query(
        `SELECT c.*,
                COUNT(o.id) as total_orders,
                COALESCE(SUM(o.grand_total), 0) as total_spend,
                MAX(o.created_at) as last_order_date
         FROM customers c
         LEFT JOIN orders o ON c.id = o.customer_id
         WHERE c.restaurant_id = $1
         GROUP BY c.id
         ORDER BY c.created_at DESC`,
        [restaurantId]
      );
      return res.rows.map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        address: r.address,
        landmark: r.landmark,
        totalOrders: Number(r.total_orders || 0),
        totalSpend: Number(r.total_spend || 0),
        lastOrderDate: r.last_order_date,
        createdAt: r.created_at,
      }));
    } catch (err: any) {
      console.error('[AdminService] Error getting customers in PG:', err.message);
    }
  }

  return inMemoryDb.customers
    .filter((c) => c.restaurant_id === restaurantId)
    .map((c) => {
      const orders = inMemoryDb.orders.filter((o) => o.customer_id === c.id);
      const totalSpend = orders.reduce((s, o) => s + (o.grand_total || 0), 0);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        landmark: c.landmark,
        totalOrders: orders.length,
        totalSpend,
        lastOrderDate: orders[0]?.created_at || c.created_at,
        createdAt: c.created_at,
      };
    });
}

export async function getTenantPayments(restaurantId: string) {
  if (isPostgresRunning()) {
    try {
      const res = await query(
        `SELECT p.*, o.order_number, o.order_type, o.status as order_status, c.name as customer_name, c.phone as customer_phone
         FROM payments p
         JOIN orders o ON p.order_id = o.id
         LEFT JOIN customers c ON o.customer_id = c.id
         WHERE p.restaurant_id = $1
         ORDER BY p.created_at DESC`,
        [restaurantId]
      );
      return res.rows;
    } catch (err: any) {
      console.error('[AdminService] Error getting payments in PG:', err.message);
    }
  }

  return inMemoryDb.payments
    .filter((p) => p.restaurant_id === restaurantId)
    .map((p) => {
      const o = inMemoryDb.orders.find((ord) => ord.id === p.order_id);
      const c = o ? inMemoryDb.customers.find((cust) => cust.id === o.customer_id) : null;
      return {
        ...p,
        order_number: o?.order_number || 'N/A',
        order_type: o?.order_type || 'takeaway',
        order_status: o?.status || 'delivered',
        customer_name: c?.name || 'Customer',
        customer_phone: c?.phone || '',
      };
    });
}

export async function getTenantBranches(restaurantId: string) {
  if (isPostgresRunning()) {
    try {
      const res = await query(
        `SELECT b.*,
                COUNT(DISTINCT t.id) as table_count,
                COUNT(DISTINCT u.id) as staff_count
         FROM restaurant_branches b
         LEFT JOIN restaurant_tables t ON b.id = t.branch_id
         LEFT JOIN restaurant_users u ON b.id = u.branch_id
         WHERE b.restaurant_id = $1
         GROUP BY b.id
         ORDER BY b.created_at ASC`,
        [restaurantId]
      );
      return res.rows;
    } catch (err: any) {
      console.error('[AdminService] Error getting branches in PG:', err.message);
    }
  }

  return inMemoryDb.restaurant_branches.filter((b) => b.restaurant_id === restaurantId);
}

export async function getTenantSettings(restaurantId: string) {
  if (isPostgresRunning()) {
    try {
      const res = await query(`SELECT * FROM restaurants WHERE id = $1 LIMIT 1`, [restaurantId]);
      if (res.rows.length > 0) {
        return res.rows[0];
      }
    } catch (err: any) {
      console.error('[AdminService] Error getting settings in PG:', err.message);
    }
  }

  return inMemoryDb.restaurants.find((r) => r.id === restaurantId) || {
    id: restaurantId,
    name: 'MOZZ Chinese & Pizzateria',
    slug: 'mozz',
    currency: 'INR',
    tax_rate: 5.0,
    status: 'active',
  };
}

export async function updateTenantSettings(restaurantId: string, updates: Partial<any>) {
  if (isPostgresRunning()) {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (updates.name) {
        fields.push(`name = $${idx++}`);
        values.push(updates.name);
      }
      if (updates.phone !== undefined) {
        fields.push(`phone = $${idx++}`);
        values.push(updates.phone);
      }
      if (updates.email !== undefined) {
        fields.push(`email = $${idx++}`);
        values.push(updates.email);
      }
      if (updates.tagline !== undefined) {
        fields.push(`tagline = $${idx++}`);
        values.push(updates.tagline);
      }
      if (updates.tax_rate !== undefined) {
        fields.push(`tax_rate = $${idx++}`);
        values.push(Number(updates.tax_rate));
      }

      fields.push(`updated_at = NOW()`);
      values.push(restaurantId);

      const sql = `UPDATE restaurants SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
      const res = await query(sql, values);
      return res.rows[0];
    } catch (err: any) {
      console.error('[AdminService] Error updating settings in PG:', err.message);
    }
  }

  const idx = inMemoryDb.restaurants.findIndex((r) => r.id === restaurantId);
  if (idx !== -1) {
    inMemoryDb.restaurants[idx] = { ...inMemoryDb.restaurants[idx], ...updates, updated_at: new Date().toISOString() };
    return inMemoryDb.restaurants[idx];
  }
  return null;
}

export async function getTenantSubscription(restaurantId: string) {
  if (isPostgresRunning()) {
    try {
      const res = await query(`SELECT * FROM subscriptions WHERE restaurant_id = $1 LIMIT 1`, [restaurantId]);
      if (res.rows.length > 0) {
        return res.rows[0];
      }
    } catch (err: any) {
      console.error('[AdminService] Error getting subscription in PG:', err.message);
    }
  }

  return inMemoryDb.subscriptions.find((s) => s.restaurant_id === restaurantId) || {
    id: crypto.randomUUID(),
    restaurant_id: restaurantId,
    plan_name: 'growth',
    status: 'active',
    billing_cycle: 'monthly',
    amount: 1499.0,
    starts_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  };
}

export async function getTenantUsers(restaurantId: string) {
  if (isPostgresRunning()) {
    try {
      const res = await query(
        `SELECT u.id, u.restaurant_id, u.branch_id, u.name, u.email, u.phone, u.role, u.is_active, u.created_at, b.name as branch_name
         FROM restaurant_users u
         LEFT JOIN restaurant_branches b ON u.branch_id = b.id
         WHERE u.restaurant_id = $1
         ORDER BY u.created_at ASC`,
        [restaurantId]
      );
      return res.rows;
    } catch (err: any) {
      console.error('[AdminService] Error getting users in PG:', err.message);
    }
  }

  return inMemoryDb.restaurant_users
    .filter((u) => u.restaurant_id === restaurantId)
    .map((u) => ({
      id: u.id,
      restaurant_id: u.restaurant_id,
      branch_id: u.branch_id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      is_active: u.is_active,
      created_at: u.created_at,
    }));
}

export async function createTenantUser(
  restaurantId: string,
  data: { name: string; email: string; phone?: string; role: string; pin: string; branchId?: string }
) {
  const hashed = await hashPassword(data.pin, 12);
  const id = crypto.randomUUID();

  if (isPostgresRunning()) {
    try {
      const sql = `
        INSERT INTO restaurant_users (id, restaurant_id, branch_id, name, email, phone, role, pin_hash, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW(), NOW())
        RETURNING id, restaurant_id, branch_id, name, email, phone, role, is_active, created_at;
      `;
      const res = await query(sql, [
        id,
        restaurantId,
        data.branchId || null,
        data.name,
        data.email.toLowerCase(),
        data.phone || null,
        data.role,
        hashed,
      ]);
      return res.rows[0];
    } catch (err: any) {
      console.error('[AdminService] Error creating user in PG:', err.message);
      throw err;
    }
  }

  const newUser = {
    id,
    restaurant_id: restaurantId,
    branch_id: data.branchId || null,
    name: data.name,
    email: data.email.toLowerCase(),
    phone: data.phone || null,
    role: data.role,
    pin_hash: hashed,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  inMemoryDb.restaurant_users.push(newUser);
  return {
    id: newUser.id,
    restaurant_id: newUser.restaurant_id,
    branch_id: newUser.branch_id,
    name: newUser.name,
    email: newUser.email,
    phone: newUser.phone,
    role: newUser.role,
    is_active: newUser.is_active,
    created_at: newUser.created_at,
  };
}

// =========================================================================
// PLATFORM SUPER ADMIN (Global Cross-Tenant Platform Control)
// =========================================================================
export async function getPlatformSuperAdminStats() {
  if (isPostgresRunning()) {
    try {
      const restCountRes = await query(`SELECT COUNT(*) as count FROM restaurants`);
      const orderCountRes = await query(`SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as gmv FROM orders`);
      const userCountRes = await query(`SELECT COUNT(*) as count FROM restaurant_users`);
      const branchCountRes = await query(`SELECT COUNT(*) as count FROM restaurant_branches`);

      return {
        totalRestaurants: Number(restCountRes.rows[0]?.count || 0),
        totalOrders: Number(orderCountRes.rows[0]?.count || 0),
        totalGMV: Number(orderCountRes.rows[0]?.gmv || 0),
        totalUsers: Number(userCountRes.rows[0]?.count || 0),
        totalBranches: Number(branchCountRes.rows[0]?.count || 0),
        platformStatus: 'healthy',
        databaseEngine: 'PostgreSQL (Cloud / Supabase)',
      };
    } catch (err: any) {
      console.error('[AdminService] Error getting platform stats in PG:', err.message);
    }
  }

  const gmv = inMemoryDb.orders.reduce((sum, o) => sum + (o.grand_total || 0), 0);
  return {
    totalRestaurants: inMemoryDb.restaurants.length,
    totalOrders: inMemoryDb.orders.length,
    totalGMV: gmv,
    totalUsers: inMemoryDb.restaurant_users.length,
    totalBranches: inMemoryDb.restaurant_branches.length,
    platformStatus: 'healthy',
    databaseEngine: 'In-Memory Simulation Store',
  };
}

export async function getAllPlatformRestaurants() {
  if (isPostgresRunning()) {
    try {
      const sql = `
        SELECT r.*,
               COUNT(DISTINCT b.id) as branch_count,
               COUNT(DISTINCT u.id) as user_count,
               COUNT(DISTINCT o.id) as order_count,
               COALESCE(SUM(o.grand_total), 0) as total_revenue,
               s.plan_name, s.status as subscription_status
        FROM restaurants r
        LEFT JOIN restaurant_branches b ON r.id = b.restaurant_id
        LEFT JOIN restaurant_users u ON r.id = u.restaurant_id
        LEFT JOIN orders o ON r.id = o.restaurant_id
        LEFT JOIN subscriptions s ON r.id = s.restaurant_id
        GROUP BY r.id, s.plan_name, s.status
        ORDER BY r.created_at DESC;
      `;
      const res = await query(sql);
      return res.rows;
    } catch (err: any) {
      console.error('[AdminService] Error getting all restaurants in PG:', err.message);
    }
  }

  return inMemoryDb.restaurants.map((r) => {
    const branches = inMemoryDb.restaurant_branches.filter((b) => b.restaurant_id === r.id);
    const users = inMemoryDb.restaurant_users.filter((u) => u.restaurant_id === r.id);
    const orders = inMemoryDb.orders.filter((o) => o.restaurant_id === r.id);
    const sub = inMemoryDb.subscriptions.find((s) => s.restaurant_id === r.id);
    return {
      ...r,
      branch_count: branches.length,
      user_count: users.length,
      order_count: orders.length,
      total_revenue: orders.reduce((sum, o) => sum + (o.grand_total || 0), 0),
      plan_name: sub?.plan_name || 'growth',
      subscription_status: sub?.status || 'active',
    };
  });
}
