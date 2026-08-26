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
