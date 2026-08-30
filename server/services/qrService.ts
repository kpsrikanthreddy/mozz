import crypto from 'crypto';
import { query, inMemoryDb, isPostgresRunning } from '../db.js';

const QR_SIGNING_SECRET = process.env.QR_SIGNING_SECRET || 'mozz_pizzateria_secure_qr_hmac_secret_2026';
const CANONICAL_BASE_URL = process.env.APP_URL || 'https://starters4u.in';
const DEFAULT_RESTAURANT_ID = 'a0000000-0000-0000-0000-000000000001';
const DEFAULT_BRANCH_ID = 'b0000000-0000-0000-0000-000000000001';

// Cryptographic HMAC-SHA256 signature generator
export function generateHmacSignature(data: string, secret: string = QR_SIGNING_SECRET): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export interface QRPayload {
  restaurantId: string;
  restaurantSlug: string;
  branchId?: string;
  mode: 'dine_in' | 'takeaway' | 'delivery';
  source: 'table_qr' | 'counter_qr' | 'online_web';
  table?: string;
  tableId?: string;
  allowedOrderTypes: ('dine_in' | 'takeaway' | 'delivery')[];
  issuedAt: number;
  nonce: string;
}

export interface ValidatedQRResult {
  valid: boolean;
  error?: string;
  source: 'table_qr' | 'counter_qr' | 'online_web';
  orderMode: 'dine_in' | 'takeaway' | 'delivery';
  tableNumber?: string;
  tableId?: string;
  restaurantId?: string;
  restaurantSlug?: string;
  branchId?: string;
  isModeLocked: boolean;
  message?: string;
  fallbackMode?: 'delivery' | 'takeaway' | 'dine_in';
}

export function generateSignedToken(
  mode: 'dine_in' | 'takeaway' | 'delivery',
  table?: string,
  restaurantSlug: string = 'mozz',
  restaurantId: string = DEFAULT_RESTAURANT_ID,
  branchId: string = DEFAULT_BRANCH_ID
) {
  const cleanTable = mode === 'dine_in' ? (table ? table.replace(/^Table\s*/i, '').trim() : '1') : undefined;
  const source = mode === 'dine_in' ? 'table_qr' : mode === 'takeaway' ? 'counter_qr' : 'online_web';

  const payload: QRPayload = {
    restaurantId,
    restaurantSlug,
    branchId,
    mode,
    source,
    table: cleanTable,
    allowedOrderTypes: mode === 'dine_in' ? ['dine_in'] : mode === 'takeaway' ? ['takeaway'] : ['delivery', 'takeaway'],
    issuedAt: Date.now(),
    nonce: crypto.randomBytes(8).toString('hex'),
  };

  const payloadString = JSON.stringify(payload);
  const encodedPayload = Buffer.from(payloadString, 'utf-8').toString('base64url');
  const signature = generateHmacSignature(encodedPayload, QR_SIGNING_SECRET);
  const token = `${encodedPayload}.${signature}`;

  let path = '/';
  if (mode === 'dine_in') {
    path = `/r/${restaurantSlug}/table/${payload.table}`;
  } else if (mode === 'takeaway') {
    path = `/r/${restaurantSlug}/counter`;
  }

  const canonicalUrl = `${CANONICAL_BASE_URL}${path}?token=${token}`;
  const localPath = `${path}?token=${token}`;

  // Register QR token asynchronously in PostgreSQL / Memory store
  registerTokenInDatabase({
    restaurantId,
    branchId,
    codeType: source,
    token,
    targetUrl: canonicalUrl,
  }).catch((err) => console.warn('[QRService] Async token registration notice:', err.message));

  return {
    token,
    payload,
    canonicalUrl,
    localPath,
  };
}

export function validateSignedToken(token?: string, expectedRestaurantSlug: string = 'mozz'): ValidatedQRResult {
  if (!token) {
    return {
      valid: true,
      source: 'online_web',
      orderMode: 'delivery',
      restaurantSlug: expectedRestaurantSlug,
      isModeLocked: false,
      message: 'Direct Online Customer Session (Delivery & Takeaway)',
    };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return {
      valid: false,
      error: 'Malformed QR token structure',
      source: 'online_web',
      orderMode: 'delivery',
      isModeLocked: false,
      fallbackMode: 'delivery',
    };
  }

  const [encodedPayload, providedSig] = parts;
  const expectedSig = generateHmacSignature(encodedPayload, QR_SIGNING_SECRET);

  // Timing safe HMAC comparison to prevent timing attacks
  const providedBuffer = Buffer.from(providedSig);
  const expectedBuffer = Buffer.from(expectedSig);

  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return {
      valid: false,
      error: 'Invalid cryptographic signature. Tampered or counterfeit QR code detected.',
      source: 'online_web',
      orderMode: 'delivery',
      isModeLocked: false,
      fallbackMode: 'delivery',
    };
  }

  try {
    const decodedJson = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
    const payload: QRPayload = JSON.parse(decodedJson);

    // Verify Restaurant Slug match
    if (payload.restaurantSlug && expectedRestaurantSlug && payload.restaurantSlug !== expectedRestaurantSlug) {
      return {
        valid: false,
        error: `QR belongs to a different restaurant (${payload.restaurantSlug}). Cross-restaurant access denied.`,
        source: 'online_web',
        orderMode: 'delivery',
        isModeLocked: false,
      };
    }

    const isDineIn = payload.mode === 'dine_in';
    const isTakeaway = payload.mode === 'takeaway';

    return {
      valid: true,
      source: payload.source || (isDineIn ? 'table_qr' : isTakeaway ? 'counter_qr' : 'online_web'),
      orderMode: payload.mode,
      tableNumber: payload.table ? `Table ${payload.table}` : undefined,
      tableId: payload.tableId,
      restaurantId: payload.restaurantId || DEFAULT_RESTAURANT_ID,
      restaurantSlug: payload.restaurantSlug || expectedRestaurantSlug,
      branchId: payload.branchId || DEFAULT_BRANCH_ID,
      isModeLocked: true,
      message: isDineIn
        ? `Authenticated Table ${payload.table} Dine-In Session`
        : isTakeaway
        ? `Authenticated Takeaway Counter Session`
        : `Online Customer Direct Session`,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: 'Failed to decode QR token payload: ' + err.message,
      source: 'online_web',
      orderMode: 'delivery',
      isModeLocked: false,
      fallbackMode: 'delivery',
    };
  }
}

// Persist / Cache QR token in Database
async function registerTokenInDatabase(data: {
  restaurantId: string;
  branchId?: string;
  tableId?: string;
  codeType: 'table_qr' | 'counter_qr' | 'online_web';
  token: string;
  targetUrl: string;
}) {
  if (isPostgresRunning()) {
    try {
      await query(
        `INSERT INTO qr_codes (restaurant_id, branch_id, table_id, code_type, token, target_url, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (token) DO UPDATE SET target_url = EXCLUDED.target_url;`,
        [data.restaurantId, data.branchId || null, data.tableId || null, data.codeType, data.token, data.targetUrl]
      );
    } catch (err: any) {
      // Non-critical logging for registration
    }
  }
}

export async function getRestaurantTables(
  restaurantId: string = DEFAULT_RESTAURANT_ID,
  branchId: string = DEFAULT_BRANCH_ID
) {
  if (isPostgresRunning()) {
    try {
      const res = await query(
        `SELECT * FROM restaurant_tables WHERE restaurant_id = $1 AND (branch_id = $2 OR branch_id IS NULL) ORDER BY CAST(table_number AS INTEGER) ASC`,
        [restaurantId, branchId]
      );
      return res.rows;
    } catch (err) {
      console.error('[QRService] Error getting tables from PG:', err);
    }
  }

  return inMemoryDb.restaurant_tables.filter(
    (t) => t.restaurant_id === restaurantId && (t.branch_id === branchId || !t.branch_id)
  );
}

export async function getTableCatalog(restaurantId: string = DEFAULT_RESTAURANT_ID, branchId: string = DEFAULT_BRANCH_ID) {
  const counter = generateSignedToken('takeaway', undefined, 'mozz', restaurantId, branchId);
  const tablesDb = await getRestaurantTables(restaurantId, branchId);

  const tableList = tablesDb.map((t: any) => {
    const gen = generateSignedToken('dine_in', String(t.table_number), 'mozz', restaurantId, branchId);
    return {
      id: t.id || `table-${t.table_number}`,
      label: t.table_name || `Table ${t.table_number} Dine-In QR`,
      tableNumber: `Table ${t.table_number}`,
      capacity: t.capacity || 4,
      ...gen,
    };
  });

  return {
    counter: {
      id: 'counter-main',
      label: 'Takeaway Counter QR',
      ...counter,
    },
    tables: tableList,
    website: {
      id: 'web-direct',
      label: 'Online Customer (Direct Web)',
      canonicalUrl: `${CANONICAL_BASE_URL}/`,
      mode: 'delivery',
    },
  };
}
