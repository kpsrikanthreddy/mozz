import express from 'express';
import path from 'path';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import { initializeDatabase, isPostgresRunning, inMemoryDb } from './server/db.js';
import * as menuService from './server/services/menuService.js';
import * as orderService from './server/services/orderService.js';
import * as customerService from './server/services/customerService.js';
import * as qrService from './server/services/qrService.js';
import * as authService from './server/services/authService.js';
import * as adminService from './server/services/adminService.js';
import { requireAuth, requireRole } from './server/middleware/authMiddleware.js';

dotenv.config();

// Razorpay client configuration from environment variables
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

let razorpayInstance: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!razorpayInstance) {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) must be set in environment variables.');
    }
    razorpayInstance = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Initialize and auto-migrate PostgreSQL connection
  await initializeDatabase();
  await authService.ensureAdminUserInitialized();

  // ==========================================================
  // HEALTH & SYSTEM STATUS
  // ==========================================================
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      database: isPostgresRunning() ? 'PostgreSQL' : 'In-Memory Simulation',
      time: new Date().toISOString(),
    });
  });

  app.get('/api/database/status', (_req, res) => {
    res.json({
      activeDatabase: isPostgresRunning() ? 'PostgreSQL (Cloud / Supabase)' : 'In-Memory Multi-Tenant Store',
      isPostgresRunning: isPostgresRunning(),
      multiTenantReady: true,
      tablesConfigured: [
        'restaurants',
        'restaurant_branches',
        'restaurant_users',
        'restaurant_tables',
        'customers',
        'menu_categories',
        'menu_items',
        'orders',
        'order_items',
        'order_status_history',
        'payments',
        'kots',
        'qr_codes',
        'subscriptions',
      ],
      stats: {
        totalMenuItems: inMemoryDb.menu_items.length,
        totalOrders: inMemoryDb.orders.length,
        totalTables: inMemoryDb.restaurant_tables.length,
      },
    });
  });

  // ==========================================================
  // 1. ADMIN AUTHENTICATION ENDPOINTS (Bcrypt + JWT)
  // ==========================================================
  app.post('/api/admin/login', async (req, res) => {
    try {
      const { email, password, pin, restaurantSlug } = req.body;
      const pass = password || pin;
      const result = await authService.authenticateAdminUser(email, pass, restaurantSlug);

      if (!result.success || !result.token) {
        return res.status(401).json({ error: result.message || 'Invalid credentials' });
      }

      // Set secure HTTP-only cookie
      res.cookie('mozz_admin_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json(result);
    } catch (err: any) {
      console.error('[Admin Auth API] Error during admin login:', err);
      res.status(500).json({ error: 'Authentication failed', details: err.message });
    }
  });

  // Backward compatibility alias for legacy PIN login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { pin, email = 'admin@mozzpizzateria.com', restaurantSlug } = req.body;
      const result = await authService.authenticateAdminUser(email, pin, restaurantSlug);
      if (!result.success) {
        return res.status(401).json({ error: result.message || 'Invalid PIN' });
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Authentication failed', details: err.message });
    }
  });

  app.post('/api/admin/logout', (_req, res) => {
    res.clearCookie('mozz_admin_token');
    res.json({ success: true, message: 'Logged out successfully' });
  });

  app.get('/api/admin/me', requireAuth, (req, res) => {
    res.json({
      authenticated: true,
      user: req.user,
    });
  });

  // ==========================================================
  // 2. PROTECTED ADMIN APIS (Strict Server-Side Tenant Isolation)
  // Restaurant A can NEVER access Restaurant B data.
  // ==========================================================
  app.get('/api/admin/orders', requireAuth, async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const branchId = req.user!.branchId;
      const status = (req.query.status as string) || 'all';
      const limit = parseInt((req.query.limit as string) || '100', 10);

      const orders = await orderService.getOrders(restaurantId, branchId, status, limit);
      res.json(orders);
    } catch (err: any) {
      console.error('[Admin API] Error fetching tenant orders:', err);
      res.status(500).json({ error: 'Failed to fetch orders', details: err.message });
    }
  });

  app.get('/api/admin/orders/:id', requireAuth, async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const order = await orderService.getOrderById(req.params.id, restaurantId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found in your restaurant' });
      }
      res.json(order);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch order', details: err.message });
    }
  });

  app.patch('/api/admin/orders/:id/status', requireAuth, async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const { status, note } = req.body;
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }
      const updated = await orderService.updateOrderStatus(req.params.id, status, note, restaurantId);
      if (!updated) {
        return res.status(404).json({ error: 'Order not found in your restaurant' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update order status', details: err.message });
    }
  });

  app.delete('/api/admin/orders/:id', requireAuth, requireRole(['SUPER_ADMIN', 'RESTAURANT_OWNER', 'BRANCH_MANAGER']), async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const success = await orderService.deleteOrder(req.params.id, restaurantId);
      if (!success) {
        return res.status(404).json({ error: 'Order not found in your restaurant' });
      }
      res.json({ success: true, message: 'Order removed successfully' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete order', details: err.message });
    }
  });

  app.get('/api/admin/kots', requireAuth, async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const branchId = req.user!.branchId;
      const activeOrders = await orderService.getOrders(restaurantId, branchId, 'all', 50);
      const kots = activeOrders
        .filter((o) => o.status !== 'delivered' && o.status !== 'cancelled')
        .map((o) => ({
          id: o.id,
          orderId: o.id,
          orderNumber: o.orderNumber,
          kotNumber: o.kotNumber || `KOT-${o.orderNumber.replace(/[^0-9]/g, '')}`,
          kotStation: o.kotStation || 'All Stations',
          tableNumber: o.customer.tableNumber || (o.orderType === 'dine_in' ? 'Table 1' : 'Takeaway Counter'),
          orderType: o.orderType,
          items: o.items,
          status: o.status,
          createdAt: o.createdAt,
          waiterName: o.waiterName || 'Ramesh',
        }));
      res.json(kots);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch KOTs', details: err.message });
    }
  });

  app.delete('/api/admin/kots/:orderId', requireAuth, async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const success = await orderService.deleteKot(req.params.orderId, restaurantId);
      res.json({ success, message: 'KOT ticket dismissed' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete KOT', details: err.message });
    }
  });

  // Menu Management (Tenant Scoped)
  app.get('/api/admin/menu', requireAuth, async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const menu = await menuService.getMenu(restaurantId);
      res.json(menu);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch menu items', details: err.message });
    }
  });

  app.post('/api/admin/menu', requireAuth, requireRole(['SUPER_ADMIN', 'RESTAURANT_OWNER', 'BRANCH_MANAGER']), async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const branchId = req.user!.branchId;
      const { name, category, dietary } = req.body;
      if (!name || !category || !dietary) {
        return res.status(400).json({ error: 'Name, category, and dietary type are required' });
      }
      const created = await menuService.createMenuItem({
        ...req.body,
        restaurant_id: restaurantId,
        branch_id: branchId,
      });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create menu item', details: err.message });
    }
  });

  app.patch('/api/admin/menu/:id', requireAuth, requireRole(['SUPER_ADMIN', 'RESTAURANT_OWNER', 'BRANCH_MANAGER']), async (req, res) => {
    try {
      const updated = await menuService.updateMenuItem(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Menu item not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update menu item', details: err.message });
    }
  });

  app.patch('/api/admin/menu/:id/stock', requireAuth, async (req, res) => {
    try {
      const explicitInStock = typeof req.body?.inStock === 'boolean' ? req.body.inStock : undefined;
      const updated = await menuService.toggleStock(req.params.id, explicitInStock);
      if (!updated) {
        return res.status(404).json({ error: 'Menu item not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update stock', details: err.message });
    }
  });

  app.delete('/api/admin/menu/:id', requireAuth, requireRole(['SUPER_ADMIN', 'RESTAURANT_OWNER']), async (req, res) => {
    try {
      const success = await menuService.deleteMenuItem(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Item not found' });
      }
      res.json({ success: true, message: 'Item deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete item', details: err.message });
    }
  });

  app.post('/api/admin/menu/reset', requireAuth, requireRole(['SUPER_ADMIN', 'RESTAURANT_OWNER']), async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const resetMenu = await menuService.resetMenuToDefault(restaurantId);
      res.json({ success: true, message: 'Menu reset to default recipe set', menu: resetMenu });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to reset menu', details: err.message });
    }
  });

  // Admin Tables, QR Codes, Customers, Payments, Branches, Analytics
  app.get('/api/admin/tables', requireAuth, async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const tables = await qrService.getRestaurantTables(restaurantId);
      res.json(tables);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch tables', details: err.message });
    }
  });

  app.get('/api/admin/qr-codes', requireAuth, async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const catalog = await qrService.getTableCatalog(restaurantId);
      res.json(catalog);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch QR catalog', details: err.message });
    }
  });

  app.post('/api/admin/qr-codes/generate', requireAuth, (req, res) => {
    const restaurantId = req.user!.restaurantId;
    const branchId = req.user!.branchId;
    const restaurantSlug = req.user!.restaurantSlug || 'mozz';
    const { mode = 'dine_in', table = '1' } = req.body;
    const generated = qrService.generateSignedToken(mode, table, restaurantSlug, restaurantId, branchId);
    res.json(generated);
  });

  app.get('/api/admin/customers', requireAuth, async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const customers = await adminService.getTenantCustomers(restaurantId);
      res.json(customers);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch customers', details: err.message });
    }
  });

  app.get('/api/admin/payments', requireAuth, async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const payments = await adminService.getTenantPayments(restaurantId);
      res.json(payments);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch payments', details: err.message });
    }
  });

  app.get('/api/admin/branches', requireAuth, async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const branches = await adminService.getTenantBranches(restaurantId);
      res.json(branches);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch branches', details: err.message });
    }
  });

  app.get('/api/admin/settings', requireAuth, async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const settings = await adminService.getTenantSettings(restaurantId);
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch settings', details: err.message });
    }
  });

  app.patch('/api/admin/settings', requireAuth, requireRole(['SUPER_ADMIN', 'RESTAURANT_OWNER']), async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const updated = await adminService.updateTenantSettings(restaurantId, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update settings', details: err.message });
    }
  });

  app.get('/api/admin/subscription', requireAuth, async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const sub = await adminService.getTenantSubscription(restaurantId);
      res.json(sub);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch subscription', details: err.message });
    }
  });

  app.get('/api/admin/analytics', requireAuth, async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const analytics = await adminService.getTenantAnalytics(restaurantId);
      res.json(analytics);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch analytics', details: err.message });
    }
  });

  app.get('/api/admin/users', requireAuth, requireRole(['SUPER_ADMIN', 'RESTAURANT_OWNER', 'BRANCH_MANAGER']), async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const users = await adminService.getTenantUsers(restaurantId);
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch users', details: err.message });
    }
  });

  app.post('/api/admin/users', requireAuth, requireRole(['SUPER_ADMIN', 'RESTAURANT_OWNER']), async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const { name, email, phone, role, pin, branchId } = req.body;
      if (!name || !email || !pin || !role) {
        return res.status(400).json({ error: 'Name, email, role, and PIN are required' });
      }
      const user = await adminService.createTenantUser(restaurantId, { name, email, phone, role, pin, branchId });
      res.status(201).json(user);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create user', details: err.message });
    }
  });

  // ==========================================================
  // 3. PLATFORM SUPER ADMIN APIS (Platform-Level Management)
  // Protected strictly for SUPER_ADMIN role
  // ==========================================================
  app.get('/api/platform-admin/stats', requireAuth, requireRole(['SUPER_ADMIN']), async (_req, res) => {
    try {
      const stats = await adminService.getPlatformSuperAdminStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch platform stats', details: err.message });
    }
  });

  app.get('/api/platform-admin/restaurants', requireAuth, requireRole(['SUPER_ADMIN']), async (_req, res) => {
    try {
      const restaurants = await adminService.getAllPlatformRestaurants();
      res.json(restaurants);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch platform restaurants', details: err.message });
    }
  });

  // ==========================================================
  // 4. PUBLIC CUSTOMER APIS (Customer Website & Online Ordering)
  // ==========================================================
  app.get('/api/menu', async (req, res) => {
    try {
      const restaurantId = (req.query.restaurant_id as string) || undefined;
      const branchId = (req.query.branch_id as string) || undefined;
      const menu = await menuService.getMenu(restaurantId, branchId);
      res.json(menu);
    } catch (err: any) {
      console.error('Error fetching menu:', err);
      res.status(500).json({ error: 'Failed to fetch menu items', details: err.message });
    }
  });

  app.get('/api/menu/:id', async (req, res) => {
    try {
      const item = await menuService.getMenuItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Menu item not found' });
      }
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch item', details: err.message });
    }
  });

  app.get('/api/orders', async (req, res) => {
    try {
      const status = (req.query.status as string) || 'all';
      const limit = parseInt((req.query.limit as string) || '50', 10);
      const orders = await orderService.getOrders(undefined, undefined, status, limit);
      res.json(orders);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      res.status(500).json({ error: 'Failed to fetch orders', details: err.message });
    }
  });

  app.get('/api/orders/:id', async (req, res) => {
    try {
      const order = await orderService.getOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      res.json(order);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch order', details: err.message });
    }
  });

  app.post('/api/orders/:id/cancel', async (req, res) => {
    try {
      const { reason } = req.body;
      const order = await orderService.getOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      if (['baking', 'packing', 'out_for_delivery', 'delivered'].includes(order.status)) {
        return res.status(400).json({ error: 'Order cannot be cancelled as kitchen is already preparing/delivering it' });
      }
      const updated = await orderService.updateOrderStatus(req.params.id, 'cancelled', reason || 'Cancelled by customer');
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to cancel order', details: err.message });
    }
  });

  app.post('/api/orders', async (req, res) => {
    try {
      const { items, orderType, customer, paymentMethod } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Order must contain at least one item' });
      }
      if (!orderType || !['delivery', 'takeaway', 'dine_in'].includes(orderType)) {
        return res.status(400).json({ error: 'Valid orderType (delivery, takeaway, dine_in) is required' });
      }
      if (!customer || !customer.phone) {
        return res.status(400).json({ error: 'Customer phone number is required' });
      }
      if (!paymentMethod) {
        return res.status(400).json({ error: 'Payment method is required' });
      }

      // Execute full transactional order creation in PostgreSQL
      const createdOrder = await orderService.createOrder(req.body);
      res.status(201).json(createdOrder);
    } catch (err: any) {
      console.error('Error creating order in PostgreSQL transaction:', err);
      res.status(400).json({
        error: err.message || 'Failed to create order',
        details: err.message,
      });
    }
  });

  app.get('/api/customers/:phone', async (req, res) => {
    try {
      const customer = await customerService.getCustomerByPhone(req.params.phone);
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      res.json(customer);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch customer', details: err.message });
    }
  });

  app.post('/api/customers', async (req, res) => {
    try {
      const customer = await customerService.findOrCreateCustomer(req.body);
      res.json(customer);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to save customer', details: err.message });
    }
  });

  app.get('/api/tables', async (_req, res) => {
    try {
      const tables = await qrService.getRestaurantTables();
      res.json(tables);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch tables', details: err.message });
    }
  });

  app.get('/api/qr/catalog', async (_req, res) => {
    try {
      const catalog = await qrService.getTableCatalog();
      res.json(catalog);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch QR catalog', details: err.message });
    }
  });

  app.get('/api/qr/validate', (req, res) => {
    const token = req.query.token as string;
    const result = qrService.validateSignedToken(token);
    if (!result.valid) {
      return res.status(401).json(result);
    }
    res.json(result);
  });

  app.post('/api/qr/validate', (req, res) => {
    const token = req.body?.token;
    const result = qrService.validateSignedToken(token);
    if (!result.valid) {
      return res.status(401).json(result);
    }
    res.json(result);
  });

  // Razorpay Gateway
  app.get('/api/razorpay/config', (_req, res) => {
    res.json({
      keyId: RAZORPAY_KEY_ID,
      merchantName: 'MOZZ Chinese & Pizzateria',
      currency: 'INR',
    });
  });

  const handleCreateRazorpayOrder = async (req: express.Request, res: express.Response) => {
    try {
      const { amount, currency = 'INR', receipt, notes } = req.body;

      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Valid amount is required' });
      }

      const amountInPaise = Math.round(
        Number(amount) >= 100 && Number.isInteger(Number(amount)) && req.body.isPaise
          ? Number(amount)
          : Number(amount) * 100
      );

      if (amountInPaise < 100) {
        return res.status(400).json({ error: 'Minimum amount must be at least 100 paise (₹1.00)' });
      }

      if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        const simulatedOrderId = `order_sim_${Date.now().toString(36)}`;
        return res.json({
          success: true,
          order_id: simulatedOrderId,
          orderId: simulatedOrderId,
          amount: amountInPaise,
          currency: currency || 'INR',
          key_id: RAZORPAY_KEY_ID || 'rzp_test_placeholder',
          keyId: RAZORPAY_KEY_ID || 'rzp_test_placeholder',
          simulated: true,
        });
      }

      const rzp = getRazorpay();
      const orderOptions = {
        amount: amountInPaise,
        currency: currency || 'INR',
        receipt: receipt || `rcpt_${Date.now().toString().slice(-8)}`,
        notes: notes || {
          restaurant: 'MOZZ Chinese & Pizzateria',
        },
      };

      const order = await rzp.orders.create(orderOptions);
      return res.json({
        success: true,
        order_id: order.id,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: RAZORPAY_KEY_ID,
        keyId: RAZORPAY_KEY_ID,
      });
    } catch (err: any) {
      console.error('Error creating Razorpay order:', err);
      return res.status(500).json({
        error: 'Failed to create Razorpay order',
        details: err?.message || 'Unknown error',
      });
    }
  };

  app.post('/api/create-order', handleCreateRazorpayOrder);
  app.post('/api/razorpay/create-order', handleCreateRazorpayOrder);

  const handleVerifyPayment = async (req: express.Request, res: express.Response) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        order_id,
        payment_id,
        signature,
        app_order_id,
      } = req.body;

      const activeOrderId = razorpay_order_id || order_id;
      const activePaymentId = razorpay_payment_id || payment_id;
      const activeSignature = razorpay_signature || signature;

      if (!activeOrderId || !activePaymentId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required payment verification parameters',
        });
      }

      let isAuthentic = true;
      if (RAZORPAY_KEY_SECRET && activeSignature) {
        const body = `${activeOrderId}|${activePaymentId}`;
        const expectedSignature = crypto
          .createHmac('sha256', RAZORPAY_KEY_SECRET)
          .update(body.toString())
          .digest('hex');

        isAuthentic = expectedSignature === activeSignature;
      }

      if (isAuthentic) {
        if (app_order_id) {
          await orderService.markPaymentSuccess(app_order_id, activePaymentId);
        }

        return res.json({
          success: true,
          message: 'Payment verified successfully and updated in PostgreSQL',
          order_id: activeOrderId,
          payment_id: activePaymentId,
          paymentId: activePaymentId,
        });
      } else {
        return res.status(400).json({
          success: false,
          error: 'Invalid payment signature. Verification failed.',
        });
      }
    } catch (err: any) {
      console.error('Error verifying payment signature:', err);
      return res.status(500).json({
        success: false,
        error: 'Internal error during payment verification',
        details: err?.message,
      });
    }
  };

  app.post('/api/verify-payment', handleVerifyPayment);
  app.post('/api/razorpay/verify-payment', handleVerifyPayment);

  // ==========================================================
  // VITE DEV MIDDLEWARE VS PRODUCTION STATIC SERVING
  // SPA Wildcard fallback ensures /admin, /platform-admin, /
  // and all direct refreshes render cleanly.
  // ==========================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MOZZ Pizzateria SaaS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
