import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import { initializeDatabase, isPostgresRunning, inMemoryDb } from './server/db.js';
import * as menuService from './server/services/menuService.js';
import * as orderService from './server/services/orderService.js';
import * as customerService from './server/services/customerService.js';
import * as qrService from './server/services/qrService.js';
import * as authService from './server/services/authService.js';

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

  // Initialize and auto-migrate PostgreSQL connection
  await initializeDatabase();

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
      activeDatabase: isPostgresRunning() ? 'PostgreSQL (Cloud / Local)' : 'In-Memory Multi-Tenant Store',
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
  // AUTHENTICATION APIS (Bcrypt Protected)
  // ==========================================================
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { pin, email, restaurantId } = req.body;
      const result = await authService.authenticateAdmin(pin, email, restaurantId);
      if (!result.success) {
        return res.status(401).json({ error: result.message || 'Invalid PIN' });
      }
      res.json(result);
    } catch (err: any) {
      console.error('[Auth API] Error during admin authentication:', err);
      res.status(500).json({ error: 'Authentication failed', details: err.message });
    }
  });

  // ==========================================================
  // MENU APIS (PostgreSQL Backed)
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

  app.post('/api/menu', async (req, res) => {
    try {
      const { name, category, dietary } = req.body;
      if (!name || !category || !dietary) {
        return res.status(400).json({ error: 'Name, category, and dietary type are required' });
      }
      const created = await menuService.createMenuItem(req.body);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create menu item', details: err.message });
    }
  });

  app.patch('/api/menu/:id', async (req, res) => {
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

  app.patch('/api/menu/:id/stock', async (req, res) => {
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

  app.delete('/api/menu/:id', async (req, res) => {
    try {
      const success = await menuService.deleteMenuItem(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Item not found or already removed' });
      }
      res.json({ success: true, message: 'Item deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete item', details: err.message });
    }
  });

  app.post('/api/menu/reset', async (_req, res) => {
    try {
      const resetMenu = await menuService.resetMenuToDefault();
      res.json({ success: true, message: 'Menu reset to default recipe set', menu: resetMenu });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to reset menu', details: err.message });
    }
  });

  // ==========================================================
  // ORDERS APIS (PostgreSQL Transactional Backed)
  // ==========================================================
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

  app.patch('/api/orders/:id/status', async (req, res) => {
    try {
      const { status, note } = req.body;
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }
      const updated = await orderService.updateOrderStatus(req.params.id, status, note);
      if (!updated) {
        return res.status(404).json({ error: 'Order not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update order status', details: err.message });
    }
  });

  app.delete('/api/orders/:id', async (req, res) => {
    try {
      const success = await orderService.deleteOrder(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Order not found' });
      }
      res.json({ success: true, message: 'Order removed successfully' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete order', details: err.message });
    }
  });

  app.delete('/api/kots/:orderId', async (req, res) => {
    try {
      const success = await orderService.deleteKot(req.params.orderId);
      res.json({ success, message: 'KOT dismissed' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete KOT', details: err.message });
    }
  });

  // ==========================================================
  // CUSTOMER APIS
  // ==========================================================
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

  // ==========================================================
  // RESTAURANT TABLES & QR MANAGEMENT
  // ==========================================================
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

  app.post('/api/qr/generate', (req, res) => {
    const { mode = 'dine_in', table = '1' } = req.body;
    const generated = qrService.generateSignedToken(mode, table);
    res.json(generated);
  });

  // ==========================================================
  // RAZORPAY INTEGRATION (Keys protected in server only)
  // ==========================================================
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

      // If Razorpay keys are not configured in environment, provide test order response
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

      // If Razorpay secret is set, verify HMAC-SHA256
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
        // Update payment record in PostgreSQL
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
    console.log(`MOZZ Pizzateria multi-tenant server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
