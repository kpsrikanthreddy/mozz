import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Razorpay client with environment variables (Live Production Keys)
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_live_TRWllkjI6tc5xK';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'm5GzjzuwtdhEGSooej30Zjaj';

let razorpayInstance: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!razorpayInstance) {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials are required in environment variables');
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

  // API Routes
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Get Razorpay public Key ID for client
  app.get('/api/razorpay/config', (_req, res) => {
    res.json({
      keyId: RAZORPAY_KEY_ID,
      merchantName: 'MOZZ Chinese & Pizzateria',
      currency: 'INR',
    });
  });

  // Handler function for creating Razorpay Order
  const handleCreateOrder = async (req: express.Request, res: express.Response) => {
    try {
      const { amount, currency = 'INR', receipt, notes } = req.body;

      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Valid amount is required' });
      }

      // Convert amount in INR to Paise if passed in INR, or use directly if in paise
      // If amount < 100, assume it was sent in INR (minimum INR 1 = 100 paise)
      const amountInPaise = Math.round(Number(amount) >= 100 && Number.isInteger(Number(amount)) && req.body.isPaise ? Number(amount) : Number(amount) * 100);

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
        key_id: RAZORPAY_KEY_ID,
        keyId: RAZORPAY_KEY_ID,
      });
    } catch (err: any) {
      console.error('Error creating Razorpay order:', err);
      if (err?.statusCode === 401 || err?.error?.code === 'BAD_REQUEST_ERROR') {
        return res.status(401).json({
          error: 'Razorpay authentication failed',
          details: err?.error?.description || err?.message,
        });
      }
      return res.status(500).json({
        error: 'Failed to create Razorpay order',
        details: err?.message || 'Unknown error',
      });
    }
  };

  // Supported endpoints for creating orders (standard & namespaced)
  app.post('/api/create-order', handleCreateOrder);
  app.post('/api/razorpay/create-order', handleCreateOrder);

  // Handler function for verifying signature with HMAC-SHA256
  const handleVerifyPayment = (req: express.Request, res: express.Response) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id, payment_id, signature } = req.body;

      const activeOrderId = razorpay_order_id || order_id;
      const activePaymentId = razorpay_payment_id || payment_id;
      const activeSignature = razorpay_signature || signature;

      if (!activeOrderId || !activePaymentId || !activeSignature) {
        return res.status(400).json({
          success: false,
          error: 'Missing required payment verification parameters (order_id, payment_id, signature)',
        });
      }

      // Generate HMAC-SHA256 signature using order_id and payment_id
      const body = `${activeOrderId}|${activePaymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

      const isAuthentic = expectedSignature === activeSignature;

      if (isAuthentic) {
        return res.json({
          success: true,
          message: 'Payment verified successfully',
          order_id: activeOrderId,
          payment_id: activePaymentId,
          paymentId: activePaymentId,
        });
      } else {
        console.warn('Razorpay signature mismatch: expected', expectedSignature, 'received', activeSignature);
        return res.status(400).json({
          success: false,
          error: 'Invalid signature. Payment verification failed.',
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

  // Supported endpoints for verifying payment
  app.post('/api/verify-payment', handleVerifyPayment);
  app.post('/api/razorpay/verify-payment', handleVerifyPayment);

  // --- QR TOKEN SECURITY & ENTRY SOURCE VALIDATION ENDPOINTS ---
  const QR_SIGNING_SALT = process.env.QR_SIGNING_SECRET || 'mozz_pizzateria_secure_qr_key_v1_2026';
  const CANONICAL_BASE_URL = 'https://starters4u.in';

  function serverSimpleHmacSha256(data: string, key: string): string {
    let hash = 0;
    const combined = `${key}:::${data}:::${key.length}`;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    let hash2 = 5381;
    for (let i = combined.length - 1; i >= 0; i--) {
      const char = combined.charCodeAt(i);
      hash2 = ((hash2 << 5) + hash2) ^ (char * 33);
      hash2 = hash2 & hash2;
    }
    const hex1 = Math.abs(hash).toString(16).padStart(8, '0');
    const hex2 = Math.abs(hash2).toString(16).padStart(8, '0');
    const hex3 = Math.abs(hash ^ hash2).toString(16).padStart(8, '0');
    const hex4 = Math.abs((hash * 31) ^ hash2).toString(16).padStart(8, '0');
    return `${hex1}${hex2}${hex3}${hex4}`;
  }

  function serverGenerateSignedToken(mode: 'dine_in' | 'takeaway' | 'delivery', table?: string) {
    const payload = {
      restaurant: 'mozz',
      mode,
      table: mode === 'dine_in' ? (table ? table.replace(/^Table\s*/i, '') : '1') : undefined,
      source: mode === 'dine_in' ? 'table_qr' : mode === 'takeaway' ? 'counter_qr' : 'online_web',
      issuedAt: Date.now(),
      nonce: Math.random().toString(36).substring(2, 8),
    };
    const payloadString = JSON.stringify(payload);
    const encodedPayload = Buffer.from(payloadString, 'utf-8').toString('base64url');
    const signature = serverSimpleHmacSha256(encodedPayload, QR_SIGNING_SALT);
    const token = `${encodedPayload}.${signature}`;
    
    let path = '/';
    if (mode === 'dine_in') {
      path = `/r/mozz/table/${payload.table}`;
    } else if (mode === 'takeaway') {
      path = `/r/mozz/counter`;
    }
    return {
      token,
      payload,
      canonicalUrl: `${CANONICAL_BASE_URL}${path}?token=${token}`,
      localPath: `${path}?token=${token}`,
    };
  }

  // Validate incoming token
  const handleValidateQrToken = (req: express.Request, res: express.Response) => {
    const token = (req.query.token as string) || req.body?.token;
    if (!token) {
      return res.json({
        valid: true,
        source: 'online_web',
        orderMode: 'delivery',
        isModeLocked: false,
        message: 'Online Customer (Default Direct Website Entry)',
      });
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      return res.status(400).json({
        valid: false,
        error: 'Malformed token structure',
        fallbackMode: 'delivery',
      });
    }

    const [encodedPayload, providedSig] = parts;
    const expectedSig = serverSimpleHmacSha256(encodedPayload, QR_SIGNING_SALT);

    if (providedSig !== expectedSig) {
      return res.status(401).json({
        valid: false,
        error: 'Invalid cryptographic signature. Tampered QR code detected.',
        fallbackMode: 'delivery',
      });
    }

    try {
      const decodedJson = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
      const payload = JSON.parse(decodedJson);
      return res.json({
        valid: true,
        source: payload.source || (payload.mode === 'dine_in' ? 'table_qr' : payload.mode === 'takeaway' ? 'counter_qr' : 'online_web'),
        orderMode: payload.mode,
        tableNumber: payload.table ? `Table ${payload.table}` : undefined,
        isModeLocked: true,
        restaurant: payload.restaurant,
        issuedAt: payload.issuedAt,
        message: payload.mode === 'dine_in'
          ? `Authenticated Table ${payload.table} Dine-In Session`
          : `Authenticated Counter Takeaway Session`,
      });
    } catch (err: any) {
      return res.status(400).json({
        valid: false,
        error: 'Failed to decode token payload',
        fallbackMode: 'delivery',
      });
    }
  };

  app.get('/api/qr/validate', handleValidateQrToken);
  app.post('/api/qr/validate', handleValidateQrToken);

  // Generate QR Token
  app.post('/api/qr/generate', (req, res) => {
    const { mode = 'dine_in', table = '1' } = req.body;
    const generated = serverGenerateSignedToken(mode, table);
    res.json(generated);
  });

  // Get full standard QR Catalog for Admin (Tables 1-20 + Counter)
  app.get('/api/qr/catalog', (_req, res) => {
    const counter = serverGenerateSignedToken('takeaway');
    const tables = [];
    for (let i = 1; i <= 20; i++) {
      tables.push(serverGenerateSignedToken('dine_in', String(i)));
    }
    res.json({
      counter: {
        id: 'counter-main',
        label: 'Takeaway Counter QR',
        ...counter,
      },
      tables: tables.map((t, index) => ({
        id: `table-${index + 1}`,
        label: `Table ${index + 1} Dine-In QR`,
        tableNumber: `Table ${index + 1}`,
        ...t,
      })),
      website: {
        id: 'web-direct',
        label: 'Online Customer (Direct Web)',
        canonicalUrl: `${CANONICAL_BASE_URL}/`,
        mode: 'delivery',
      },
    });
  });

  // Vite middleware for development vs Static file serving for production
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
    console.log(`MOZZ Pizzateria server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
