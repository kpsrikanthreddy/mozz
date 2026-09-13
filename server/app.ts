import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import { initializeDatabase, isPostgresRunning, inMemoryDb, query } from './db.js';
import * as menuService from './services/menuService.js';
import * as orderService from './services/orderService.js';
import * as customerService from './services/customerService.js';
import * as qrService from './services/qrService.js';
import * as authService from './services/authService.js';
import * as adminService from './services/adminService.js';
import * as printService from './services/printService.js';
import { requireAuth, requireRole, verifyAuthToken } from './middleware/authMiddleware.js';
import { requireDeviceAuth } from './middleware/deviceAuthMiddleware.js';
import { getIpHashSecret } from './config.js';

dotenv.config();

// Razorpay client configuration from environment variables
function getRazorpayKeyId(): string {
  return (process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '').trim();
}

function getRazorpayKeySecret(): string {
  return (process.env.RAZORPAY_KEY_SECRET || '').trim();
}

export function isRazorpayConfigured(): boolean {
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();
  return Boolean(
    keyId &&
    keySecret &&
    !keyId.toLowerCase().includes('placeholder') &&
    !keySecret.toLowerCase().includes('placeholder')
  );
}

function getRazorpay(): Razorpay {
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();
  if (!isRazorpayConfigured()) {
    throw new Error('Online payment is temporarily unavailable. Please try again later.');
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
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

  // Enable trust proxy for secure, accurate client IP handling behind reverse proxies (Vercel, Cloud Run, Nginx)
  app.set('trust proxy', 1);

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
  app.post(
    '/api/admin/print-devices/pairing-code',
    requireAuth,
    requireRole(['SUPER_ADMIN', 'RESTAURANT_OWNER', 'BRANCH_MANAGER', 'MANAGER']),
    async (req, res) => {
      try {
        const restaurantId = req.user!.restaurantId;
        let branchId = req.body.branchId || req.user!.branchId;

        // Verify selected branch belongs to logged-in restaurant for strict tenant isolation
        const branches = await adminService.getTenantBranches(restaurantId);
        if (branchId) {
          const branchExists = branches.some((b: any) => b.id === branchId);
          if (!branchExists) {
            return res.status(403).json({ error: 'Selected branch does not belong to your restaurant' });
          }
        } else if (branches.length > 0) {
          branchId = branches[0].id;
        } else {
          branchId = 'b0000000-0000-0000-0000-000000000001';
        }

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
    }
  );

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

  // 2.3. Deactivate / Revoke device (Revokes hardware authorization and terminates active streams)
  const handleDeactivateDevice = async (req: express.Request, res: express.Response) => {
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
  };

  app.post(
    '/api/admin/print-devices/:id/deactivate',
    requireAuth,
    requireRole(['SUPER_ADMIN', 'RESTAURANT_OWNER', 'BRANCH_MANAGER', 'MANAGER']),
    handleDeactivateDevice
  );
  app.post(
    '/api/admin/print-devices/:id/revoke',
    requireAuth,
    requireRole(['SUPER_ADMIN', 'RESTAURANT_OWNER', 'BRANCH_MANAGER', 'MANAGER']),
    handleDeactivateDevice
  );
  app.delete(
    '/api/admin/print-devices/:id',
    requireAuth,
    requireRole(['SUPER_ADMIN', 'RESTAURANT_OWNER', 'BRANCH_MANAGER', 'MANAGER']),
    handleDeactivateDevice
  );

  // 2.4. List all print devices for restaurant
  app.get(
    '/api/admin/print-devices',
    requireAuth,
    requireRole(['SUPER_ADMIN', 'RESTAURANT_OWNER', 'BRANCH_MANAGER', 'MANAGER']),
    async (req, res) => {
      try {
        const restaurantId = req.user!.restaurantId;
        const branchId = req.query.branchId as string | undefined;

        // If filtering by branch, ensure branch belongs to this tenant
        if (branchId) {
          const branches = await adminService.getTenantBranches(restaurantId);
          const branchExists = branches.some((b: any) => b.id === branchId);
          if (!branchExists) {
            return res.status(403).json({ error: 'Branch does not belong to your restaurant' });
          }
        }

        const devices = await printService.getTenantDevices(restaurantId, branchId);
        res.json(devices);
      } catch (err: any) {
        console.error('[PrintAgent API] List devices error:', err);
        res.status(500).json({ error: 'Failed to list print devices', details: err.message });
      }
    }
  );

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

  app.patch('/api/orders/:id/location', async (req, res) => {
    try {
      const { latitude, longitude, address, accuracy, locationCapturedAt, locationSource } = req.body;
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: 'Valid numerical latitude and longitude are required' });
      }
      if (lat < -90 || lat > 90) {
        return res.status(400).json({ error: 'Latitude must be between -90 and 90' });
      }
      if (lng < -180 || lng > 180) {
        return res.status(400).json({ error: 'Longitude must be between -180 and 180' });
      }
      const updated = await orderService.updateOrderCustomerLocation(req.params.id, {
        latitude: lat,
        longitude: lng,
        address: typeof address === 'string' ? address.trim() : undefined,
        accuracy: accuracy !== undefined && accuracy !== null && !isNaN(Number(accuracy)) ? Number(accuracy) : undefined,
        locationCapturedAt: locationCapturedAt ? String(locationCapturedAt) : undefined,
        locationSource: locationSource || 'device_gps',
      });
      if (!updated) {
        return res.status(404).json({ error: 'Order not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update delivery location', details: err.message });
    }
  });

  app.post('/api/orders/:id/cancel', async (req, res) => {
    try {
      const { reason } = req.body;
      const order = await orderService.getOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const statusLower = (order.status || '').toLowerCase();
      // Cancellation is ONLY permitted while the order is in the initial pending/placed state
      if (statusLower !== 'placed' && statusLower !== 'pending') {
        if (statusLower === 'cancelled') {
          return res.status(400).json({ error: 'This order has already been cancelled.' });
        }
        if (statusLower === 'delivered' || statusLower === 'completed') {
          return res.status(400).json({ error: 'This order has already been delivered and cannot be cancelled.' });
        }
        return res.status(400).json({
          error: 'This order can no longer be cancelled because preparation has started. Please contact the restaurant for help.',
        });
      }

      // Atomically update order status ensuring it is still in placed/pending state
      const updated = await orderService.cancelOrderIfPending(
        req.params.id,
        reason || 'Cancelled by customer (wrongly placed)',
        order.restaurantId
      );

      if (!updated) {
        return res.status(400).json({
          error: 'This order can no longer be cancelled because preparation has started. Please contact the restaurant for help.',
        });
      }

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

      if (orderType === 'delivery') {
        const rawLat = req.body.customerLatitude !== undefined ? req.body.customerLatitude : customer?.latitude;
        const rawLng = req.body.customerLongitude !== undefined ? req.body.customerLongitude : customer?.longitude;
        const latNum = Number(rawLat);
        const lngNum = Number(rawLng);

        if (rawLat === undefined || rawLat === null || isNaN(latNum) || latNum < -90 || latNum > 90) {
          return res.status(400).json({
            error: 'Delivery orders require valid customer GPS coordinates. Please click "Use My Current Location" or pinpoint on map.',
          });
        }
        if (rawLng === undefined || rawLng === null || isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
          return res.status(400).json({
            error: 'Delivery orders require valid customer GPS coordinates. Please click "Use My Current Location" or pinpoint on map.',
          });
        }
        if (!customer.address || !customer.address.trim()) {
          return res.status(400).json({
            error: 'Delivery orders require a complete delivery address.',
          });
        }
      }

      // Production Payment Safety: For online payments (Razorpay), verify configuration and signature
      if (paymentMethod === 'razorpay') {
        if (!isRazorpayConfigured()) {
          return res.status(503).json({
            error: 'Online payment is temporarily unavailable. Please try again later.',
            message: 'Online payment is temporarily unavailable. Please try again later.',
          });
        }

        const razorpayOrderId = req.body.razorpay_order_id || req.body.razorpayOrderId;
        const razorpaySignature = req.body.razorpay_signature || req.body.razorpaySignature;
        const paymentId = req.body.paymentId || req.body.razorpay_payment_id;

        if (!paymentId || !razorpayOrderId || !razorpaySignature) {
          return res.status(400).json({
            error: 'Online payment verification required. Missing payment ID, order ID, or signature.',
          });
        }

        const body = `${razorpayOrderId}|${paymentId}`;
        const expectedSignature = crypto
          .createHmac('sha256', getRazorpayKeySecret())
          .update(body.toString())
          .digest('hex');

        if (expectedSignature !== razorpaySignature) {
          return res.status(400).json({
            error: 'Invalid payment signature. Online payment verification failed.',
          });
        }

        req.body.paymentStatus = 'paid';
        req.body.paymentId = paymentId;
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
    if (!isRazorpayConfigured()) {
      return res.status(503).json({
        available: false,
        error: 'Online payment is temporarily unavailable. Please try again later.',
        message: 'Online payment is temporarily unavailable. Please try again later.',
      });
    }
    res.json({
      available: true,
      keyId: getRazorpayKeyId(),
      merchantName: 'MOZZ Chinese & Pizzateria',
      currency: 'INR',
    });
  });

  const handleCreateRazorpayOrder = async (req: express.Request, res: express.Response) => {
    try {
      if (!isRazorpayConfigured()) {
        return res.status(503).json({
          success: false,
          error: 'Online payment is temporarily unavailable. Please try again later.',
          message: 'Online payment is temporarily unavailable. Please try again later.',
        });
      }

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
        key_id: getRazorpayKeyId(),
        keyId: getRazorpayKeyId(),
      });
    } catch (err: any) {
      console.error('Error creating Razorpay order:', err);
      return res.status(503).json({
        success: false,
        error: 'Online payment is temporarily unavailable. Please try again later.',
        message: 'Online payment is temporarily unavailable. Please try again later.',
        details: err?.message || 'Unknown error',
      });
    }
  };

  app.post('/api/create-order', handleCreateRazorpayOrder);
  app.post('/api/razorpay/create-order', handleCreateRazorpayOrder);

  const handleVerifyPayment = async (req: express.Request, res: express.Response) => {
    try {
      if (!isRazorpayConfigured()) {
        return res.status(503).json({
          success: false,
          error: 'Online payment is temporarily unavailable. Please try again later.',
          message: 'Online payment is temporarily unavailable. Please try again later.',
        });
      }

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

      if (!activeOrderId || !activePaymentId || !activeSignature) {
        return res.status(400).json({
          success: false,
          error: 'Missing required payment verification parameters (order_id, payment_id, signature)',
        });
      }

      const keySecret = getRazorpayKeySecret();
      const body = `${activeOrderId}|${activePaymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(body.toString())
        .digest('hex');

      const isAuthentic = expectedSignature === activeSignature;

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
  // DISTRIBUTED RATE LIMITER & SAFE PROXY IP HANDLING
  // ==========================================================
  // Exported helpers for verification & unit testing
  // ==========================================================
  const memoryRateLimitStore = new Map<string, { count: number; resetAt: number }>();

  // ==========================================================
  // CUSTOMER INQUIRIES STAFF PORTAL ENDPOINTS (Tenant-Isolated)
  // ==========================================================
  app.get('/api/admin/inquiries', requireAuth, async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const statusFilter = req.query.status as string;

      if (isPostgresRunning()) {
        let sql = `
          SELECT id, restaurant_id, branch_id, name, phone, order_id, message, status, ip_hash, user_agent, created_at, updated_at
          FROM customer_inquiries
          WHERE restaurant_id = $1
        `;
        const params: any[] = [restaurantId];
        if (statusFilter && ['new', 'in_review', 'resolved', 'spam'].includes(statusFilter)) {
          params.push(statusFilter);
          sql += ` AND status = $${params.length}`;
        }
        sql += ` ORDER BY created_at DESC LIMIT 200`;
        const result = await query(sql, params);
        return res.json(result.rows);
      } else {
        const inquiries = (inMemoryDb as any).customer_inquiries || [];
        let filtered = inquiries.filter((i: any) => i.restaurant_id === restaurantId);
        if (statusFilter && ['new', 'in_review', 'resolved', 'spam'].includes(statusFilter)) {
          filtered = filtered.filter((i: any) => i.status === statusFilter);
        }
        filtered.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return res.json(filtered.slice(0, 200));
      }
    } catch (err: any) {
      console.error('[Admin API] Error fetching inquiries:', err.message);
      res.status(500).json({ error: 'Failed to fetch inquiries', details: err.message });
    }
  });

  app.patch('/api/admin/inquiries/:id/status', requireAuth, async (req, res) => {
    try {
      const restaurantId = req.user!.restaurantId;
      const inquiryId = req.params.id;
      const { status } = req.body;

      if (!status || !['new', 'in_review', 'resolved', 'spam'].includes(status)) {
        return res.status(400).json({
          error: "Invalid status value. Permitted values: 'new', 'in_review', 'resolved', 'spam'.",
        });
      }

      if (isPostgresRunning()) {
        const result = await query(
          `UPDATE customer_inquiries
           SET status = $1, updated_at = NOW()
           WHERE id = $2 AND restaurant_id = $3
           RETURNING *`,
          [status, inquiryId, restaurantId]
        );
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Inquiry not found in your restaurant' });
        }
        return res.json(result.rows[0]);
      } else {
        const inquiries = (inMemoryDb as any).customer_inquiries || [];
        const index = inquiries.findIndex((i: any) => i.id === inquiryId && i.restaurant_id === restaurantId);
        if (index === -1) {
          return res.status(404).json({ error: 'Inquiry not found in your restaurant' });
        }
        inquiries[index].status = status;
        inquiries[index].updated_at = new Date().toISOString();
        return res.json(inquiries[index]);
      }
    } catch (err: any) {
      console.error('[Admin API] Error updating inquiry status:', err.message);
      res.status(500).json({ error: 'Failed to update inquiry status', details: err.message });
    }
  });

  // ==========================================================
  // CUSTOMER CONTACT & INQUIRIES ENDPOINT
  // ==========================================================
  app.post('/api/contact', async (req, res) => {
    try {
      // 1. Honeypot check for automated spam submissions
      if (req.body.website_url || req.body.honeypot) {
        return res.status(400).json({ error: 'Invalid submission parameters detected.' });
      }

      // 2. Input validation & normalization
      const { name, phone, orderId, message, restaurantId: rawRestId, branchId: rawBranchId } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
        return res.status(400).json({ error: 'Please enter a valid name (2 to 100 characters).' });
      }

      if (!message || typeof message !== 'string' || message.trim().length < 10 || message.trim().length > 2000) {
        return res.status(400).json({ error: 'Please enter a message between 10 and 2000 characters.' });
      }

      let normalizedPhone: string | null = null;
      if (phone !== undefined && phone !== null && String(phone).trim().length > 0) {
        const cleanedPhone = String(phone).trim().replace(/[\s\-()]/g, '');
        if (!/^\+?[0-9]{7,15}$/.test(cleanedPhone)) {
          return res.status(400).json({ error: 'Please enter a valid phone number format (7 to 15 digits).' });
        }
        normalizedPhone = cleanedPhone;
      }

      let normalizedOrderId: string | null = null;
      if (orderId !== undefined && orderId !== null && String(orderId).trim().length > 0) {
        const cleanedOrderId = String(orderId).trim().toUpperCase();
        if (!/^[A-Z0-9\-_]{4,50}$/.test(cleanedOrderId)) {
          return res.status(400).json({ error: 'Please enter a valid Order ID format (e.g. MOZZ-8901).' });
        }
        normalizedOrderId = cleanedOrderId;
      }

      // 3. Safe client IP and rate limiting
      let clientIp: string;
      let ipHash: string;
      try {
        clientIp = getSafeClientIp(req);
        ipHash = hashIpForAudit(clientIp);
      } catch (hashErr: any) {
        console.error('[Contact API] IP hashing error:', hashErr.message);
        if (process.env.NODE_ENV === 'production') {
          return res.status(500).json({
            error: 'Server security configuration error. IP hashing unavailable.',
          });
        }
        ipHash = 'dev-unconfigured-ip-hash';
      }

      const rateLimitKey = `contact:${ipHash}`;

      let rateLimit;
      try {
        rateLimit = await checkDistributedRateLimit(rateLimitKey, 5, 15 * 60 * 1000);
      } catch (rlErr: any) {
        console.error('[Contact API] Distributed rate limiter error:', rlErr.message);
        if (rlErr.message === 'DISTRIBUTED_RATE_LIMITER_UNAVAILABLE' || process.env.NODE_ENV === 'production') {
          return res.status(503).json({
            error: 'Inquiry service temporarily unavailable. Distributed rate limiter service offline.',
          });
        }
        rateLimit = { allowed: true, remaining: 1, resetAt: Date.now() + 60000, isDurable: false };
      }

      if (!rateLimit.isDurable) {
        res.setHeader('X-RateLimit-Distributed', 'pending-durable-store');
      }

      if (!rateLimit.allowed) {
        const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000));
        res.setHeader('Retry-After', retryAfterSeconds.toString());
        return res.status(429).json({
          error: 'Too many contact inquiries from your network. Please wait a few minutes before submitting again.',
        });
      }

      // Normalized plain text stored in database (DO NOT permanently HTML-encode before storage to preserve fidelity)
      const cleanName = name.trim();
      const cleanMessage = message.trim();

      // Multi-tenant resolution: derive trusted tenant context, never trust arbitrary client IDs
      const tenantContext = await resolveTrustedTenantForInquiry(normalizedOrderId, rawRestId, rawBranchId);

      const inquiryId = `INQ-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const userAgent = (req.headers['user-agent'] || '').slice(0, 500);
      const isProduction = process.env.NODE_ENV === 'production';

      // 4. Persistence handling
      if (isPostgresRunning()) {
        try {
          await query(
            `INSERT INTO customer_inquiries (
               id, restaurant_id, branch_id, name, phone, order_id, message, status, ip_hash, user_agent, created_at, updated_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'new', $8, $9, NOW(), NOW())`,
            [
              inquiryId,
              tenantContext.restaurantId,
              tenantContext.branchId,
              cleanName,
              normalizedPhone,
              normalizedOrderId,
              cleanMessage,
              ipHash,
              userAgent,
            ]
          );
        } catch (dbErr: any) {
          console.error('[Contact API] PostgreSQL persistence error:', dbErr.message);
          return res.status(503).json({
            error: 'Failed to record customer inquiry in database. Please contact us directly by phone.',
          });
        }
      } else {
        // In-memory storage is permitted only in explicit local development / testing mode
        if (isProduction) {
          console.error('[Contact API] Inquiries cannot be accepted in production without an active database.');
          return res.status(503).json({
            error: 'Inquiry service temporarily unavailable. Production database connection required.',
          });
        }

        if (!(inMemoryDb as any).customer_inquiries) {
          (inMemoryDb as any).customer_inquiries = [];
        }
        (inMemoryDb as any).customer_inquiries.push({
          id: inquiryId,
          restaurant_id: tenantContext.restaurantId,
          branch_id: tenantContext.branchId,
          name: cleanName,
          phone: normalizedPhone,
          order_id: normalizedOrderId,
          message: cleanMessage,
          status: 'new',
          ip_hash: ipHash,
          user_agent: userAgent,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // Safe logging: DO NOT log customer name, phone number, or message content
      console.info(`[Contact API] Inquiry registered successfully: ${inquiryId} [restaurant=${tenantContext.restaurantId}] [ipHash=${ipHash}]`);

      return res.status(201).json({
        success: true,
        inquiryId,
        message: 'Your inquiry has been recorded successfully for the restaurant team to review in the staff portal.',
      });
    } catch (err: any) {
      console.error('[Contact API] Unexpected error handling contact submission:', err.message);
      return res.status(500).json({ error: 'Failed to process inquiry', details: err.message });
    }
  });

  return app;
}

// ==========================================================
// DISTRIBUTED RATE LIMITER & SAFE PROXY IP HANDLING
// ==========================================================
export function normalizeClientIp(rawIp: string): string {
  if (!rawIp) return '127.0.0.1';
  let ip = rawIp.trim();
  // Strip enclosing brackets if IPv6 is bracketed: [::1] or [::ffff:127.0.0.1]
  if (ip.startsWith('[') && ip.endsWith(']')) {
    ip = ip.slice(1, -1).trim();
  }
  // Only remove ::ffff: prefix from IPv4-mapped IPv6 addresses
  if (ip.toLowerCase().startsWith('::ffff:')) {
    return ip.slice(7);
  }
  return ip;
}

export function getSafeClientIp(req: express.Request): string {
  const rawIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  return normalizeClientIp(rawIp);
}

export function hashIpForAudit(ip: string): string {
  const secret = getIpHashSecret();
  return crypto.createHmac('sha256', secret).update(ip).digest('hex').slice(0, 32);
}

export const memoryRateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function clearMemoryRateLimitStore(): void {
  memoryRateLimitStore.clear();
}

export async function checkDistributedRateLimit(
  key: string,
  maxHits = 5,
  windowMs = 15 * 60 * 1000
): Promise<{ allowed: boolean; remaining: number; resetAt: number; isDurable: boolean }> {
  const now = Date.now();
  const resetTime = new Date(now + windowMs);

  if (isPostgresRunning()) {
    try {
      const res = await query(
        `INSERT INTO distributed_rate_limits (key, hit_count, reset_at, created_at, updated_at)
         VALUES ($1, 1, $2, NOW(), NOW())
         ON CONFLICT (key) DO UPDATE
         SET
           hit_count = CASE
             WHEN distributed_rate_limits.reset_at <= NOW() THEN 1
             ELSE distributed_rate_limits.hit_count + 1
           END,
           reset_at = CASE
             WHEN distributed_rate_limits.reset_at <= NOW() THEN EXCLUDED.reset_at
             ELSE distributed_rate_limits.reset_at
           END,
           updated_at = NOW()
         RETURNING hit_count, reset_at`,
        [key, resetTime]
      );

      const row = res.rows[0];
      const hitCount = Number(row.hit_count);
      const rowResetMs = new Date(row.reset_at).getTime();

      if (hitCount > maxHits) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: rowResetMs,
          isDurable: true,
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, maxHits - hitCount),
        resetAt: rowResetMs,
        isDurable: true,
      };
    } catch (dbErr: any) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[RateLimiter] Distributed database rate limit check failed in production:', dbErr.message);
        throw new Error('DISTRIBUTED_RATE_LIMITER_UNAVAILABLE');
      }
      console.warn('[RateLimiter] Distributed database rate limit check failed, using fallback in dev:', dbErr.message);
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('[RateLimiter] Production environment requires active PostgreSQL connection for distributed rate limits.');
    throw new Error('DISTRIBUTED_RATE_LIMITER_UNAVAILABLE');
  }

  // In-memory fallback (local development / testing mode only)
  const mem = memoryRateLimitStore.get(key);
  if (mem && now < mem.resetAt) {
    mem.count += 1;
    if (mem.count > maxHits) {
      return { allowed: false, remaining: 0, resetAt: mem.resetAt, isDurable: false };
    }
    return {
      allowed: true,
      remaining: maxHits - mem.count,
      resetAt: mem.resetAt,
      isDurable: false,
    };
  } else {
    const newReset = now + windowMs;
    memoryRateLimitStore.set(key, { count: 1, resetAt: newReset });
    return {
      allowed: true,
      remaining: maxHits - 1,
      resetAt: newReset,
      isDurable: false,
    };
  }
}

export async function resolveTrustedTenantForInquiry(
  orderId?: string | null,
  clientRestaurantId?: string | null,
  clientBranchId?: string | null
): Promise<{ restaurantId: string; branchId: string }> {
  const DEFAULT_RESTAURANT = 'a0000000-0000-0000-0000-000000000001';
  const DEFAULT_BRANCH = 'b0000000-0000-0000-0000-000000000001';

  // 1. If customer provided an order ID, verify and link to the exact order's tenant
  if (orderId) {
    if (isPostgresRunning()) {
      try {
        const orderRes = await query(
          `SELECT restaurant_id, branch_id FROM orders WHERE order_number = $1 OR id::text = $1 LIMIT 1`,
          [orderId]
        );
        if (orderRes.rows.length > 0) {
          return {
            restaurantId: orderRes.rows[0].restaurant_id,
            branchId: orderRes.rows[0].branch_id || DEFAULT_BRANCH,
          };
        }
      } catch (err: any) {
        console.warn('[Contact API] Order tenant lookup error:', err.message);
      }
    } else {
      const order = inMemoryDb.orders.find(
        (o) => (o as any).order_number === orderId || o.id === orderId || (o as any).orderNumber === orderId
      );
      if (order) {
        return {
          restaurantId: (order as any).restaurant_id || (order as any).restaurantId || DEFAULT_RESTAURANT,
          branchId: (order as any).branch_id || (order as any).branchId || DEFAULT_BRANCH,
        };
      }
    }
  }

  // 2. If client supplied a restaurantId, verify it exists as an active tenant in the database
  if (clientRestaurantId) {
    if (isPostgresRunning()) {
      try {
        const restRes = await query(
          `SELECT id FROM restaurants WHERE id = $1 AND status = 'active' LIMIT 1`,
          [clientRestaurantId]
        );
        if (restRes.rows.length > 0) {
          return {
            restaurantId: restRes.rows[0].id,
            branchId: clientBranchId || DEFAULT_BRANCH,
          };
        }
      } catch {
        // Fall through to default if invalid UUID or not found
      }
    } else {
      const rest = inMemoryDb.restaurants.find(
        (r) => r.id === clientRestaurantId && r.status === 'active'
      );
      if (rest) {
        return {
          restaurantId: rest.id,
          branchId: clientBranchId || DEFAULT_BRANCH,
        };
      }
    }
  }

  // 3. Trusted default tenant for Starters4U flagship
  return {
    restaurantId: DEFAULT_RESTAURANT,
    branchId: DEFAULT_BRANCH,
  };
}

export const app = createApp();
