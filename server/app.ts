import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import { initializeDatabase, isPostgresRunning, inMemoryDb } from './db.js';
import * as menuService from './services/menuService.js';
import * as orderService from './services/orderService.js';
import * as customerService from './services/customerService.js';
import * as qrService from './services/qrService.js';
import * as authService from './services/authService.js';
import * as adminService from './services/adminService.js';
import * as printService from './services/printService.js';
import { requireAuth, requireRole, verifyAuthToken } from './middleware/authMiddleware.js';
import { requireDeviceAuth } from './middleware/deviceAuthMiddleware.js';

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

// Singleton database & admin initialization promise
declare global {
  var __appInitPromise: Promise<void> | undefined;
}

export async function ensureInitialized(): Promise<void> {
  if (globalThis.__appInitPromise) {
    return globalThis.__appInitPromise;
  }

  globalThis.__appInitPromise = (async () => {
    try {
      await initializeDatabase();
      await authService.ensureAdminUserInitialized();
    } catch (err) {
      console.error('[App] Database / Admin user initialization error:', err);
      // Reset promise to allow retry on subsequent requests if temporary failure
      globalThis.__appInitPromise = undefined;
      throw err;
    }
  })();

  return globalThis.__appInitPromise;
}

export function createApp(): express.Application {
  const app = express();

  // Basic Middlewares
  app.use(express.json());
  app.use(cookieParser());

  // CORS and Headers configuration for serverless and cross-origin environments
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Ensure DB and default users are initialized before processing API requests
  app.use(async (req, _res, next) => {
    if (req.path.startsWith('/api')) {
      try {
        await ensureInitialized();
      } catch (err) {
        console.warn('[App] Warning during ensureInitialized in request middleware:', err);
      }
    }
    next();
  });

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
        'print_devices',
        'printer_configurations',
        'print_jobs',
        'print_job_attempts',
      ],
      printAgentReady: true,
      stats: {
        totalMenuItems: inMemoryDb.menu_items.length,
        totalOrders: inMemoryDb.orders.length,
        totalTables: inMemoryDb.restaurant_tables.length,
        totalPrintDevices: inMemoryDb.print_devices.length,
        totalPrintJobs: inMemoryDb.print_jobs.length,
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
  // STARTERS4U PRINT AGENT APIS (Desktop Agent Integration)
  // ==========================================================

  // 1. Staff authentication for desktop agent initial setup
  app.post('/api/print-agent/auth/login', async (req, res) => {
    try {
      const { email, password, pin, restaurantSlug } = req.body;
      const pass = password || pin;
      const authResult = await authService.authenticateAdminUser(email, pass, restaurantSlug);
      if (!authResult.success || !authResult.token || !authResult.user) {
        return res.status(401).json({ error: authResult.message || 'Invalid credentials' });
      }

      // Fetch accessible branches for this user's restaurant
      const branches = await adminService.getTenantBranches(authResult.user.restaurantId);
      const restaurants =
        authResult.user.role === 'SUPER_ADMIN'
          ? await adminService.getAllPlatformRestaurants()
          : [
              {
                id: authResult.user.restaurantId,
                name: authResult.user.restaurantName || 'Current Restaurant',
                slug: authResult.user.restaurantSlug || 'mozz',
              },
            ];

      res.json({
        success: true,
        user: authResult.user,
        token: authResult.token,
        restaurants,
        branches,
      });
    } catch (err: any) {
      console.error('[PrintAgent API] Login error:', err);
      res.status(500).json({ error: 'Failed to authenticate user', details: err.message });
    }
  });

  // 2. Register Windows Desktop Device (Manual Admin Registration)
  app.post('/api/print-agent/devices/register', requireAuth, async (req, res) => {
    try {
      const { deviceId, deviceName, restaurantId, branchId, platform = 'win32', appVersion = '1.0.0' } = req.body;

      if (!deviceId || !deviceName) {
        return res.status(400).json({ error: 'deviceId and deviceName are required' });
      }

      const targetRestaurantId = restaurantId || req.user!.restaurantId;
      const targetBranchId = branchId || req.user!.branchId || 'b0000000-0000-0000-0000-000000000001';

      const registration = await printService.registerDevice({
        restaurantId: targetRestaurantId,
        branchId: targetBranchId,
        deviceId,
        deviceName,
        platform,
        appVersion,
      });

      res.status(201).json({
        success: true,
        device: registration.device,
        deviceToken: registration.deviceToken,
      });
    } catch (err: any) {
      console.error('[PrintAgent API] Register device error:', err);
      res.status(500).json({ error: 'Failed to register print device', details: err.message });
    }
  });

  // 2.1. Generate 6-digit registration/pairing code for quick physical desktop POS onboarding
  // Authenticated: requires store manager or owner
  app.post('/api/admin/print-devices/pairing-code', requireAuth, async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const branchId = req.body.branchId || req.user!.branchId || 'b0000000-0000-0000-0000-000000000001';

      const pairing = await printService.createPairingCode({
        restaurantId,
        branchId,
        userId: req.user!.userId,
      });

      res.status(201).json({
        success: true,
        pairingCode: pairing.pairingCode,
        expiresAt: pairing.expiresAt,
        expiresInSeconds: 600, // 10 minutes
        restaurantId: pairing.restaurantId,
        branchId: pairing.branchId,
      });
    } catch (err: any) {
      console.error('[PrintAgent API] Generate pairing code error:', err);
      res.status(500).json({ error: 'Failed to generate pairing code', details: err.message });
    }
  });

  // 2.2. Exchange 6-digit code for device credentials (Called by Mozz Windows Print Agent)
  // Rate limited: max 5 failed attempts per IP per 5 minutes to prevent brute-forcing
  app.post('/api/print-agent/devices/pair', async (req, res) => {
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
      const rateLimit = printService.checkPairingRateLimit(clientIp);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          error: 'Too many registration attempts. Please wait 5 minutes before trying again.',
        });
      }

      const { pairingCode, deviceId, deviceName, platform, appVersion } = req.body;
      if (!pairingCode || !deviceId) {
        return res.status(400).json({ error: 'pairingCode and deviceId are required' });
      }

      const pairResult = await printService.pairDeviceWithCode({
        pairingCode,
        deviceId,
        deviceName: deviceName || 'Windows POS Terminal',
        platform: platform || 'win32',
        appVersion: appVersion || '1.0.0',
      });

      if (!pairResult.success) {
        return res.status(400).json({ error: pairResult.error });
      }

      res.status(201).json(pairResult);
    } catch (err: any) {
      console.error('[PrintAgent API] Pair device error:', err);
      res.status(500).json({ error: 'Failed to pair device', details: err.message });
    }
  });

  // 2.3. Deactivate device (Revokes hardware authorization and terminates active streams)
  app.post('/api/admin/print-devices/:id/deactivate', requireAuth, async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const result = await printService.deactivateDevice(req.params.id, restaurantId);
      if (!result.success) {
        return res.status(404).json({ error: result.message });
      }
      res.json(result);
    } catch (err: any) {
      console.error('[PrintAgent API] Deactivate device error:', err);
      res.status(500).json({ error: 'Failed to deactivate device', details: err.message });
    }
  });

  // 2.4. List all print devices for restaurant
  app.get('/api/admin/print-devices', requireAuth, async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const branchId = req.query.branchId as string | undefined;
      const devices = await printService.getTenantDevices(restaurantId, branchId);
      res.json(devices);
    } catch (err: any) {
      console.error('[PrintAgent API] List devices error:', err);
      res.status(500).json({ error: 'Failed to list print devices', details: err.message });
    }
  });

  // 3. Device Heartbeat
  app.post('/api/print-agent/devices/heartbeat', requireDeviceAuth, async (req, res) => {
    try {
      await printService.touchDeviceHeartbeat(req.device!.id);
      res.json({
        success: true,
        deviceId: req.device!.deviceId,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update heartbeat', details: err.message });
    }
  });

  // Device-initiated logout/deactivation. Revokes the server token before local removal.
  app.post('/api/print-agent/devices/deactivate', requireDeviceAuth, async (req, res) => {
    try {
      const result = await printService.deactivateDevice(
        req.device!.id,
        req.device!.restaurantId
      );
      if (!result.success) {
        return res.status(404).json({ error: result.message });
      }
      res.json(result);
    } catch (err: any) {
      console.error('[PrintAgent API] Device self-deactivation error:', err);
      res.status(500).json({ error: 'Failed to deactivate device', details: err.message });
    }
  });

  // 3.5. Issue short-lived, single-use stream ticket for SSE connections
  app.post('/api/print-agent/stream-ticket', requireDeviceAuth, async (req, res) => {
    try {
      const ticket = await printService.createStreamTicket(req.device!);
      res.json({ ticket, expiresInSeconds: 60 });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to generate stream ticket', details: err.message });
    }
  });

  // 4. Real-time Server-Sent Events (SSE) Stream
  app.get('/api/print-agent/events', requireDeviceAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const unregister = printService.registerSseClient(
      req.device!.restaurantId,
      req.device!.branchId,
      res
    );

    req.on('close', () => {
      unregister();
    });
  });

  // 5. Fallback polling for print jobs
  app.get('/api/print-agent/jobs', requireDeviceAuth, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const limit = parseInt((req.query.limit as string) || '25', 10);
      const jobs = await printService.getPrintJobs(
        req.device!.restaurantId,
        req.device!.branchId,
        status,
        limit
      );
      res.json(jobs);
    } catch (err: any) {
      console.error('[PrintAgent API] Error fetching jobs:', err);
      res.status(500).json({ error: 'Failed to fetch print jobs', details: err.message });
    }
  });

  // 6. Atomically Claim a print job
  app.post('/api/print-agent/jobs/:id/claim', requireDeviceAuth, async (req, res) => {
    try {
      const result = await printService.claimPrintJob(
        req.params.id,
        req.device!.id,
        req.device!.restaurantId,
        req.device!.branchId
      );
      if (!result.claimed) {
        return res.status(409).json({ error: result.error || 'Job could not be claimed' });
      }
      res.json(result);
    } catch (err: any) {
      console.error('[PrintAgent API] Error claiming job:', err);
      res.status(500).json({ error: 'Failed to claim print job', details: err.message });
    }
  });

  // 6.1 Explicit staff retry for a previously failed job on the same device
  app.post('/api/print-agent/jobs/:id/retry', requireDeviceAuth, async (req, res) => {
    try {
      const result = await printService.retryFailedPrintJob(
        req.params.id,
        req.device!.id,
        req.device!.restaurantId,
        req.device!.branchId
      );
      if (!result.claimed) {
        return res.status(409).json({ error: result.error || 'Job cannot be retried' });
      }
      res.json(result);
    } catch (err: any) {
      console.error('[PrintAgent API] Error retrying print job:', err);
      res.status(500).json({ error: 'Failed to retry print job', details: err.message });
    }
  });

  // 7. Update Job Status (PRINTING, PRINTED, FAILED)
  app.post('/api/print-agent/jobs/:id/status', requireDeviceAuth, async (req, res) => {
    try {
      const { status, errorMessage, durationMs, attemptNumber } = req.body;
      if (!['PRINTING', 'PRINTED', 'FAILED'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be PRINTING, PRINTED, or FAILED' });
      }

      const updated = await printService.updatePrintJobStatus(req.params.id, req.device!.id, status, {
        errorMessage,
        durationMs,
        attemptNumber,
      });

      if (!updated) {
        return res.status(404).json({ error: 'Print job not found' });
      }

      res.json({ success: true, job: updated });
    } catch (err: any) {
      console.error('[PrintAgent API] Error updating job status:', err);
      res.status(500).json({ error: 'Failed to update job status', details: err.message });
    }
  });

  // 8. Manual Staff Reprint
  app.post('/api/print-agent/jobs/reprint', async (req, res) => {
    try {
      let restaurantId = '';
      let branchId = '';

      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        const device = await printService.authenticateDeviceToken(token);
        if (device) {
          restaurantId = device.restaurantId;
          branchId = device.branchId;
        } else {
          const user = verifyAuthToken(token);
          if (user) {
            restaurantId = user.restaurantId;
            branchId = user.branchId || 'b0000000-0000-0000-0000-000000000001';
          }
        }
      }

      if (!restaurantId) {
        return res.status(401).json({ error: 'Authentication required to initiate reprint' });
      }

      const { orderId, jobType, station } = req.body;
      if (!orderId || !jobType || !['KOT', 'BILL'].includes(jobType)) {
        return res.status(400).json({ error: 'orderId and valid jobType (KOT or BILL) are required' });
      }

      const order = await orderService.getOrderById(orderId, restaurantId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      const orderBranchId = order.branchId || (order as any).branch_id;
      if (orderBranchId && orderBranchId !== branchId) {
        return res.status(403).json({ error: 'Order belongs to another branch' });
      }

      const reprintJob = await printService.createReprintJob(order, jobType, station);
      res.status(201).json({ success: true, job: reprintJob });
    } catch (err: any) {
      console.error('[PrintAgent API] Error creating reprint:', err);
      res.status(500).json({ error: 'Failed to create reprint job', details: err.message });
    }
  });

  // 9. Get Printer Configurations
  app.get('/api/print-agent/printers/config', requireDeviceAuth, async (req, res) => {
    try {
      const configs = await printService.getPrinterConfigurations(
        req.device!.restaurantId,
        req.device!.branchId,
        req.device!.id
      );
      res.json(configs);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch printer configurations', details: err.message });
    }
  });

  // 10. Save Printer Configurations
  app.post('/api/print-agent/printers/config', requireDeviceAuth, async (req, res) => {
    try {
      const { configs } = req.body;
      if (!Array.isArray(configs)) {
        return res.status(400).json({ error: 'configs must be an array of station mappings' });
      }
      const saved = await printService.savePrinterConfigurations(
        req.device!.restaurantId,
        req.device!.branchId,
        req.device!.id,
        configs
      );
      res.json({ success: true, configs: saved });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to save printer configurations', details: err.message });
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

  return app;
}

export const app = createApp();
